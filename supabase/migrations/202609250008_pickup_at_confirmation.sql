-- Pickup point is selected at purchase confirmation, not during onboarding.
-- Existing confirmed orders keep their original pickup point.

create or replace function public.confirm_commitment_order(
  p_commitment_id uuid,
  p_pickup_point_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_c public.commitments%rowtype;
  v_pi public.pool_items%rowtype;
  v_pool public.pools%rowtype;
  v_profile public.profiles%rowtype;
  v_order_id uuid;
  v_order_status text;
  v_order_item_id uuid;
  v_pickup uuid;
  v_amount numeric(12,2);
  v_saving numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_c
  from public.commitments
  where id = p_commitment_id and customer_id = v_user
  for update;
  if not found or v_c.status <> 'active' then raise exception 'Active commitment not found'; end if;

  select * into v_pi from public.pool_items where id = v_c.pool_item_id;
  select * into v_pool from public.pools where id = v_pi.pool_id;
  if v_pool.status <> 'confirmation' then raise exception 'Pool is not in confirmation'; end if;
  if v_pi.final_customer_price is null then raise exception 'Final price is not published'; end if;

  select * into v_profile from public.profiles where id = v_user;
  if v_profile.community_id is distinct from v_pool.community_id then raise exception 'Community mismatch'; end if;

  select id, pickup_point_id, status
    into v_order_id, v_pickup, v_order_status
  from public.orders
  where customer_id = v_user and pool_id = v_pool.id
  for update;

  if found then
    if v_order_status <> 'confirmed' then raise exception 'Existing order is no longer accepting confirmation'; end if;
  else
    v_pickup := p_pickup_point_id;
    if v_pickup is null or not exists(
      select 1 from public.pickup_points p
      where p.id = v_pickup
        and p.community_id = v_pool.community_id
        and p.active = true
    ) then
      raise exception 'Choose an active pickup point inside your community';
    end if;

    insert into public.orders(customer_id,pool_id,pickup_point_id,status,payment_status,confirmed_at)
    values(v_user,v_pool.id,v_pickup,'confirmed','unpaid',now())
    returning id into v_order_id;
  end if;

  v_amount := round(v_pi.final_customer_price * v_c.quantity, 2);
  v_saving := greatest(round((v_pi.benchmark_price_snapshot - v_pi.final_customer_price) * v_c.quantity, 2), 0);

  insert into public.order_items(order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price,expected_saving)
  values(v_order_id,v_pi.id,v_pi.product_id,v_c.quantity,v_pi.benchmark_price_snapshot,v_pi.final_customer_price,v_saving)
  on conflict(order_id,pool_item_id) do nothing
  returning id into v_order_item_id;
  if v_order_item_id is null then raise exception 'This commitment is already confirmed'; end if;

  update public.orders set total_amount = total_amount + v_amount where id = v_order_id;
  update public.commitments set status='confirmed', confirmed_at=now() where id=v_c.id;
  insert into public.fulfilments(order_id,pickup_point_id,status)
  values(v_order_id,v_pickup,'pending')
  on conflict(order_id) do nothing;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'order_item_confirmed','order',v_order_id,jsonb_build_object(
    'commitment_id',v_c.id,
    'order_item_id',v_order_item_id,
    'amount',v_amount,
    'pickup_point_id',v_pickup
  ));

  return v_order_id;
end;
$$;

revoke all on function public.confirm_commitment_order(uuid,uuid) from public, anon;
grant execute on function public.confirm_commitment_order(uuid,uuid) to authenticated;
revoke execute on function public.confirm_commitment_order(uuid) from authenticated;
