create or replace function public.admin_set_pool_status(p_pool_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_pool public.pools%rowtype;
  v_item_count integer := 0;
  v_pickup_count integer := 0;
  v_commitment_count integer := 0;
  v_order_count integer := 0;
  v_quote_count integer := 0;
  v_allowed boolean := false;
begin
  if v_user is null or not private.has_role(v_user,'admin') then raise exception 'Admin required'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update;
  if not found then raise exception 'Pool not found'; end if;

  select count(*) into v_item_count from public.pool_items where pool_id=p_pool_id and active;
  select count(*) into v_pickup_count from public.pool_pickup_points where pool_id=p_pool_id;
  select count(*) into v_commitment_count from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  select count(*) into v_order_count from public.orders where pool_id=p_pool_id and status <> 'cancelled';
  select count(*) into v_quote_count from public.supplier_quotes q join public.pool_items pi on pi.id=q.pool_item_id where pi.pool_id=p_pool_id;

  if p_status='draft' then
    if v_pool.status not in ('open','pricing') then raise exception 'Only Open or Pricing pools can be returned to Draft'; end if;
    if v_commitment_count>0 or v_order_count>0 or v_quote_count>0 then raise exception 'Cannot return to Draft after commitments, supplier quotes, or orders exist'; end if;
    update public.pools set status='draft' where id=p_pool_id;
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to','draft','reason','safe_admin_reset'));
    return;
  end if;

  v_allowed := (v_pool.status='draft' and p_status in ('open','cancelled'))
    or (v_pool.status='open' and p_status in ('pricing','cancelled'))
    or (v_pool.status='pricing' and p_status in ('final_price','cancelled'))
    or (v_pool.status='final_price' and p_status in ('confirmation','cancelled'))
    or (v_pool.status='confirmation' and p_status in ('ordered','cancelled'))
    or (v_pool.status='ordered' and p_status in ('ready_for_pickup','cancelled'))
    or (v_pool.status='ready_for_pickup' and p_status in ('completed','cancelled'));
  if not v_allowed then raise exception 'Invalid pool transition: % -> %',v_pool.status,p_status; end if;

  if v_pool.status='draft' and p_status='open' then
    if v_item_count=0 then raise exception 'Add at least one product before opening this pool'; end if;
    if v_pickup_count=0 then raise exception 'Select at least one pickup option before opening this pool'; end if;
    if v_pool.commitment_closes_at is null or v_pool.confirmation_closes_at is null or v_pool.pickup_at is null then raise exception 'Commitment close, confirmation close, and pickup target are required before opening'; end if;
    if v_pool.opens_at is not null and v_pool.commitment_closes_at <= v_pool.opens_at then raise exception 'Commitment close must be after pool open time'; end if;
    if v_pool.commitment_closes_at <= now() then raise exception 'Commitment close must be in the future'; end if;
    if v_pool.confirmation_closes_at <= v_pool.commitment_closes_at then raise exception 'Confirmation close must be after commitment close'; end if;
    if v_pool.pickup_at <= v_pool.confirmation_closes_at then raise exception 'Pickup target must be after confirmation close'; end if;
  end if;

  if v_pool.status='open' and p_status='pricing' and v_commitment_count=0 then raise exception 'No customer commitments exist. Keep the pool open or cancel it instead of moving to Pricing'; end if;
  if v_pool.status='pricing' and p_status='final_price' then
    if v_item_count=0 then raise exception 'Pool has no active items'; end if;
    if exists(select 1 from public.pool_items where pool_id=p_pool_id and active and (final_customer_price is null or selected_supplier_quote_id is null)) then raise exception 'Every active pool item needs a winning supplier quote and final customer price'; end if;
  end if;
  if v_pool.status='confirmation' and p_status='ordered' and v_order_count=0 then raise exception 'No confirmed customer orders exist. Do not move an empty pool to Ordered'; end if;

  update public.pools set status=p_status where id=p_pool_id;
  if p_status='ordered' then
    update public.orders set status='ordered' where pool_id=p_pool_id and status='confirmed';
    update public.commitments c set status='cancelled' from public.pool_items pi where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status='active';
  end if;
  if p_status='ready_for_pickup' then
    update public.orders set status='ready_for_pickup', ready_at=now() where pool_id=p_pool_id and status in ('confirmed','ordered');
    update public.fulfilments f set status='ready' from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status='pending';
  end if;
  if p_status='cancelled' then
    update public.orders set status='cancelled', cancelled_at=now(), cancellation_reason=coalesce(cancellation_reason,'Pool cancelled by operations') where pool_id=p_pool_id and status <> 'completed';
    update public.fulfilments f set status='cancelled' from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status <> 'collected';
    update public.commitments c set status='cancelled' from public.pool_items pi where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  end if;
  if p_status='completed' and exists(select 1 from public.orders where pool_id=p_pool_id and status not in ('completed','cancelled')) then raise exception 'All orders must be completed or cancelled'; end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to',p_status));
end;
$function$;
