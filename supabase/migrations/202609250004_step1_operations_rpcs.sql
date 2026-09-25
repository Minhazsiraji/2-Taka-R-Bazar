create or replace function public.admin_set_pool_status(p_pool_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_old text; v_allowed boolean := false;
begin
  if v_user is null or not private.has_role(v_user,'admin') then raise exception 'Admin required'; end if;
  select status into v_old from public.pools where id=p_pool_id for update;
  if not found then raise exception 'Pool not found'; end if;
  v_allowed := (v_old='draft' and p_status in ('open','cancelled'))
    or (v_old='open' and p_status in ('pricing','cancelled'))
    or (v_old='pricing' and p_status in ('final_price','cancelled'))
    or (v_old='final_price' and p_status in ('confirmation','cancelled'))
    or (v_old='confirmation' and p_status in ('ordered','cancelled'))
    or (v_old='ordered' and p_status in ('ready_for_pickup','cancelled'))
    or (v_old='ready_for_pickup' and p_status in ('completed','cancelled'));
  if not v_allowed then raise exception 'Invalid pool transition: % -> %',v_old,p_status; end if;
  if p_status in ('final_price','confirmation') and exists(select 1 from public.pool_items where pool_id=p_pool_id and active and final_customer_price is null) then
    raise exception 'All active pool items require a final price first';
  end if;
  update public.pools set status=p_status where id=p_pool_id;
  if p_status='ordered' then
    update public.orders set status='ordered' where pool_id=p_pool_id and status='confirmed';
    update public.commitments c set status='cancelled'
      from public.pool_items pi where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status='active';
  end if;
  if p_status='ready_for_pickup' then
    update public.orders set status='ready_for_pickup', ready_at=now() where pool_id=p_pool_id and status in ('confirmed','ordered');
    update public.fulfilments f set status='ready' from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status='pending';
  end if;
  if p_status='cancelled' then
    update public.orders set status='cancelled', cancelled_at=now(), cancellation_reason=coalesce(cancellation_reason,'Pool cancelled by operations')
      where pool_id=p_pool_id and status <> 'completed';
    update public.fulfilments f set status='cancelled'
      from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status <> 'collected';
    update public.commitments c set status='cancelled'
      from public.pool_items pi where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  end if;
  if p_status='completed' and exists(select 1 from public.orders where pool_id=p_pool_id and status not in ('completed','cancelled')) then raise exception 'All orders must be completed or cancelled'; end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_old,'to',p_status));
end;
$$;
revoke all on function public.admin_set_pool_status(uuid,text) from public, anon;
grant execute on function public.admin_set_pool_status(uuid,text) to authenticated;

create or replace function public.admin_update_payment(
  p_order_id uuid, p_status text, p_method text default null,
  p_reference text default null, p_amount numeric default null, p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not private.has_role(v_user,'admin') then raise exception 'Admin required'; end if;
  if p_status not in ('unpaid','payment_pending','paid_manually','cash_on_pickup','refunded','waived_test_order') then raise exception 'Invalid payment status'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'Payment amount cannot be negative'; end if;
  update public.orders set payment_status=p_status,payment_method=nullif(p_method,''),payment_reference=nullif(p_reference,'') where id=p_order_id;
  if not found then raise exception 'Order not found'; end if;
  insert into public.payment_records(order_id,status,method,reference_number,amount,recorded_by,notes)
  values(p_order_id,p_status,nullif(p_method,''),nullif(p_reference,''),p_amount,v_user,nullif(p_notes,''));
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'payment_updated','order',p_order_id,jsonb_build_object('status',p_status,'method',p_method,'reference',p_reference,'amount',p_amount));
end;
$$;
revoke all on function public.admin_update_payment(uuid,text,text,text,numeric,text) from public, anon;
grant execute on function public.admin_update_payment(uuid,text,text,text,numeric,text) to authenticated;

create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_status text;
begin
  if v_user is null or not private.has_role(v_user,'admin') then raise exception 'Admin required'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Cancellation reason required'; end if;
  select status into v_status from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_status='completed' then raise exception 'Completed order cannot be cancelled'; end if;
  if v_status='cancelled' then return; end if;
  update public.orders set status='cancelled',cancelled_at=now(),cancellation_reason=p_reason where id=p_order_id;
  update public.fulfilments set status='cancelled' where order_id=p_order_id and status <> 'collected';
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'order_cancelled','order',p_order_id,jsonb_build_object('reason',p_reason,'from',v_status));
end;
$$;
revoke all on function public.admin_cancel_order(uuid,text) from public, anon;
grant execute on function public.admin_cancel_order(uuid,text) to authenticated;

create or replace function public.mark_order_collected(p_order_id uuid, p_notes text default null)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_community uuid;
  v_total_saving numeric(12,2) := 0;
  v_item record;
  v_amount numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.is_assigned_pickup(v_user,v_order.pickup_point_id) then raise exception 'Pickup assignment required'; end if;
  if v_order.status <> 'ready_for_pickup' then raise exception 'Order is not ready for pickup'; end if;
  if exists(select 1 from public.fulfilments where order_id=p_order_id and status='collected') then raise exception 'Order already collected'; end if;
  select community_id into v_community from public.pools where id=v_order.pool_id;

  update public.fulfilments set status='collected',collected_at=now(),collected_by=v_user,notes=p_notes where order_id=p_order_id;
  update public.orders set status='completed',completed_at=now() where id=p_order_id;

  for v_item in select * from public.order_items where order_id=p_order_id loop
    v_amount := greatest(round((v_item.benchmark_price_snapshot-v_item.unit_price)*v_item.quantity,2),0);
    if v_amount > 0 then
      insert into public.savings_ledger(customer_id,community_id,order_id,order_item_id,benchmark_price,pool_unit_price,fulfilled_quantity,amount,verified_at)
      values(v_order.customer_id,v_community,p_order_id,v_item.id,v_item.benchmark_price_snapshot,v_item.unit_price,v_item.quantity,v_amount,now())
      on conflict(order_item_id) do nothing;
      if found then v_total_saving := v_total_saving + v_amount; end if;
    end if;
  end loop;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pickup_completed','order',p_order_id,jsonb_build_object('verified_saving',v_total_saving));
  return v_total_saving;
end;
$$;
revoke all on function public.mark_order_collected(uuid,text) from public, anon;
grant execute on function public.mark_order_collected(uuid,text) to authenticated;

-- Broad table privileges are still constrained by RLS. No service-role key is exposed to clients.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Explicitly prevent ordinary users from directly writing derived financial tables; policies above grant no such write path.
revoke insert, update, delete on public.savings_ledger from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;
revoke insert, update, delete on public.order_items from authenticated;

-- Commitments are written through guarded RPCs so customers cannot forge status transitions.
revoke insert, update, delete on public.commitments from authenticated;
