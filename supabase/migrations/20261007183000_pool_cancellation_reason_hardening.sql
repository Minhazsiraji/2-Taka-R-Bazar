-- E2E hardening: Pool cancellation must always carry an explicit reason.
-- Generic stage changes cannot bypass the dedicated audited cancellation path.

create or replace function public.admin_set_pool_status(p_pool_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_pool public.pools%rowtype; v_item_count int:=0; v_pickup_count int:=0; v_commitment_count int:=0; v_order_count int:=0; v_quote_count int:=0; v_allowed boolean:=false;
  r record; v_qty int; v_best_quote uuid; v_best_threshold int; v_best_ceiling numeric; v_own_price numeric; v_available int;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update; if not found then raise exception 'Pool not found'; end if;

  if p_status='cancelled' then
    raise exception 'Use admin_cancel_pool with a cancellation reason';
  end if;

  select count(*) into v_item_count from public.pool_items where pool_id=p_pool_id and active;
  select count(*) into v_pickup_count from public.pool_pickup_points where pool_id=p_pool_id;
  select count(*) into v_commitment_count from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  select count(*) into v_order_count from public.orders where pool_id=p_pool_id and status<>'cancelled';
  select count(*) into v_quote_count from public.supplier_quotes q join public.pool_items pi on pi.id=q.pool_item_id where pi.pool_id=p_pool_id and q.quote_phase='final';

  if p_status='draft' then
    if v_pool.status not in ('open','pricing') then raise exception 'Only Open or Pricing pools can be returned to Draft'; end if;
    if v_commitment_count>0 or v_order_count>0 or v_quote_count>0 then raise exception 'Cannot return to Draft after commitments, supplier quotes, or orders exist'; end if;
    update public.pools set status='draft' where id=p_pool_id;
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to','draft','reason','safe_admin_reset'));
    return;
  end if;

  v_allowed:=(v_pool.status='draft' and p_status='open')
    or (v_pool.status='open' and p_status='pricing')
    or (v_pool.status='pricing' and p_status='final_price')
    or (v_pool.status='final_price' and p_status='confirmation')
    or (v_pool.status='confirmation' and p_status='ordered')
    or (v_pool.status='ordered' and p_status='ready_for_pickup')
    or (v_pool.status='ready_for_pickup' and p_status='completed');
  if not v_allowed then raise exception 'Invalid pool transition: % -> %',v_pool.status,p_status; end if;

  if v_pool.status='draft' and p_status='open' then
    if v_item_count=0 then raise exception 'Add at least one product before opening this pool'; end if;
    if v_pickup_count=0 then raise exception 'Select at least one pickup option before opening this pool'; end if;
    if v_pool.receiving_pickup_point_id is null or not exists(select 1 from public.pool_pickup_points where pool_id=p_pool_id and pickup_point_id=v_pool.receiving_pickup_point_id) then raise exception 'Choose a valid designated receiving point before opening'; end if;
    if v_pool.commitment_closes_at is null or v_pool.confirmation_closes_at is null or v_pool.supplier_delivery_at is null or v_pool.pickup_at is null then raise exception 'Commitment close, confirmation close, supplier delivery and pickup start are required before opening'; end if;
    if v_pool.opens_at is not null and v_pool.commitment_closes_at<=v_pool.opens_at then raise exception 'Commitment close must be after pool open time'; end if;
    if v_pool.commitment_closes_at<=now() or v_pool.confirmation_closes_at<=v_pool.commitment_closes_at or v_pool.supplier_delivery_at<=v_pool.confirmation_closes_at or v_pool.supplier_delivery_at>=v_pool.pickup_at then raise exception 'Pool timeline is invalid'; end if;
  end if;

  if v_pool.status='draft' and p_status='open' then
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active and pr.source_type='SUPPLIER_POOL' and not exists(select 1 from public.supplier_quotes q where q.pool_item_id=pi.id and q.quote_phase='planning_tier' and (q.valid_until is null or q.valid_until>=current_date))) then raise exception 'Every active supplier-pool item needs a planning price tier before opening'; end if;
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id left join public.own_product_inventory oi on oi.product_id=pi.product_id where pi.pool_id=p_pool_id and pi.active and pr.source_type<>'SUPPLIER_POOL' and (pi.pricing_mode is null or coalesce(oi.stock_on_hand-oi.reserved_quantity,0)<=0)) then raise exception 'Every own-product item needs pricing configuration and available stock before opening'; end if;
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active and pr.source_type<>'SUPPLIER_POOL' and private.resolve_own_product_price(pi.id,pi.min_quantity) is null) then raise exception 'Own-product pricing must provide a valid starting price'; end if;
  end if;

  if v_pool.status='open' and p_status='pricing' then
    if v_commitment_count=0 then raise exception 'No customer commitments exist. Keep the pool open or cancel it instead of moving to Pricing'; end if;
    for r in select pi.id,pi.product_id,pr.source_type from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active loop
      select coalesce(sum(quantity),0)::int into v_qty from public.commitments where pool_item_id=r.id and status in ('active','confirmed');
      if r.source_type='SUPPLIER_POOL' then
        perform private.refresh_pool_item_unlock(r.id);
        select best_unlocked_tier_quote_id,best_unlocked_threshold,best_unlocked_customer_ceiling_price into v_best_quote,v_best_threshold,v_best_ceiling from public.pool_items where id=r.id;
        if v_qty=0 then
          update public.pool_items set frozen_committed_quantity=0,pricing_locked_at=now(),active=false where id=r.id;
        elsif v_best_ceiling is null then
          update public.pool_items set frozen_committed_quantity=v_qty,pricing_locked_at=now(),active=false where id=r.id;
          update public.commitments set status='cancelled' where pool_item_id=r.id and status='active';
        else
          update public.pool_items set frozen_committed_quantity=v_qty,frozen_tier_quote_id=v_best_quote,frozen_tier_threshold=v_best_threshold,frozen_customer_ceiling_price=v_best_ceiling,pricing_locked_at=now() where id=r.id;
        end if;
      else
        if v_qty=0 then
          update public.pool_items set frozen_committed_quantity=0,pricing_locked_at=now(),active=false where id=r.id;
          continue;
        end if;
        v_own_price:=private.resolve_own_product_price(r.id,v_qty);
        if v_own_price is null then
          update public.pool_items set frozen_committed_quantity=v_qty,pricing_locked_at=now(),active=false where id=r.id;
          update public.commitments set status='cancelled' where pool_item_id=r.id and status='active';
          continue;
        end if;
        select stock_on_hand-reserved_quantity into v_available from public.own_product_inventory where product_id=r.product_id for update;
        if coalesce(v_available,0)<v_qty then raise exception 'Own-product stock is below frozen demand for product %',r.product_id; end if;
        update public.pool_items set frozen_committed_quantity=v_qty,frozen_customer_ceiling_price=v_own_price,final_customer_price=v_own_price,pricing_locked_at=now() where id=r.id;
      end if;
      insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
      values(v_user,'pool_item_demand_frozen','pool_item',r.id,jsonb_build_object('quantity',v_qty,'source_type',r.source_type));
    end loop;
    if not exists(select 1 from public.pool_items where pool_id=p_pool_id and active) then raise exception 'No pool item reached a valid price. Keep the pool open or cancel it.'; end if;
  end if;

  if v_pool.status='pricing' and p_status='final_price' then
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active and ((pr.source_type='SUPPLIER_POOL' and (pi.final_customer_price is null or pi.selected_supplier_quote_id is null)) or (pr.source_type<>'SUPPLIER_POOL' and pi.final_customer_price is null))) then raise exception 'Every active item needs a final customer price; supplier items also need a winning quote'; end if;
  end if;

  if v_pool.status='confirmation' and p_status='ordered' and v_order_count=0 then raise exception 'No confirmed customer orders exist. Do not move an empty pool to Ordered'; end if;

  if v_pool.status='ordered' and p_status='ready_for_pickup' and exists(
    select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id
    left join public.supplier_receipts sr on sr.pool_item_id=pi.id and sr.supplier_quote_id=pi.selected_supplier_quote_id
    where pi.pool_id=p_pool_id and pi.active and pr.source_type='SUPPLIER_POOL'
      and (pi.selected_supplier_quote_id is null or sr.id is null or sr.status<>'received' or sr.received_quantity<sr.expected_quantity)
  ) then raise exception 'Required supplier deliveries must be fully received before customer pickup can start'; end if;

  update public.pools set status=p_status where id=p_pool_id;

  if p_status='ordered' then
    update public.orders set status='ordered' where pool_id=p_pool_id and status='confirmed';
    update public.commitments c set status='cancelled'
    from public.pool_items pi
    where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status='active';
  end if;

  if p_status='ready_for_pickup' then
    update public.orders set status='ready_for_pickup',ready_at=now() where pool_id=p_pool_id and status in ('confirmed','ordered');
    update public.fulfilments f set status='ready'
    from public.orders o
    where f.order_id=o.id and o.pool_id=p_pool_id and f.status='pending';
  end if;

  if p_status='completed' and exists(select 1 from public.orders where pool_id=p_pool_id and status not in ('completed','cancelled')) then
    raise exception 'All orders must be completed or cancelled';
  end if;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to',p_status));
end; $$;

revoke all on function public.admin_set_pool_status(uuid,text) from public,anon;
grant execute on function public.admin_set_pool_status(uuid,text) to authenticated;

create or replace function public.admin_cancel_pool(p_pool_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  v_status text;
  v_existing_reason text;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then
    raise exception 'Admin required';
  end if;
  if v_reason is null then raise exception 'Cancellation reason required'; end if;

  select status,cancellation_reason into v_status,v_existing_reason
  from public.pools where id=p_pool_id for update;
  if not found then raise exception 'Pool not found'; end if;
  if v_status='completed' then raise exception 'Completed pool cannot be cancelled'; end if;

  if v_status='cancelled' then
    if v_existing_reason is null then
      update public.pools
      set cancellation_reason=v_reason,cancelled_at=coalesce(cancelled_at,now()),cancelled_by=coalesce(cancelled_by,v_user)
      where id=p_pool_id;
      update public.orders
      set cancellation_reason=coalesce(cancellation_reason,v_reason)
      where pool_id=p_pool_id and status='cancelled';
      insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
      values(v_user,'pool_cancellation_reason_backfilled','pool',p_pool_id,jsonb_build_object('reason',v_reason));
    end if;
    return;
  end if;

  update public.pools
  set status='cancelled',
      is_paused=false,paused_at=null,pause_reason=null,paused_by=null,
      cancelled_at=now(),cancellation_reason=v_reason,cancelled_by=v_user
  where id=p_pool_id;

  update public.orders
  set status='cancelled',cancelled_at=now(),cancellation_reason=v_reason,updated_at=now()
  where pool_id=p_pool_id and status<>'completed';

  update public.fulfilments f
  set status='cancelled',updated_at=now()
  from public.orders o
  where f.order_id=o.id and o.pool_id=p_pool_id and f.status not in ('collected','delivered');

  update public.commitments c
  set status='cancelled',updated_at=now()
  from public.pool_items pi
  where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status in ('active','confirmed');

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_status,'to','cancelled','reason',v_reason));

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pool_cancelled_with_reason','pool',p_pool_id,jsonb_build_object('from',v_status,'reason',v_reason));
end; $$;

revoke all on function public.admin_cancel_pool(uuid,text) from public,anon;
grant execute on function public.admin_cancel_pool(uuid,text) to authenticated;
