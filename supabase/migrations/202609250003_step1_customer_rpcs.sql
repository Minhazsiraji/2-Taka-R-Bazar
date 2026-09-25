create or replace function public.commit_to_pool(p_pool_item_id uuid, p_quantity integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_commitment uuid;
  v_pool_status text;
  v_pool_community uuid;
  v_user_community uuid;
  v_max integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_quantity < 1 then raise exception 'Quantity must be positive'; end if;

  select po.status, po.community_id, pi.max_quantity
    into v_pool_status, v_pool_community, v_max
  from public.pool_items pi join public.pools po on po.id = pi.pool_id
  where pi.id = p_pool_item_id and pi.active = true;
  if not found then raise exception 'Pool item not found'; end if;
  if v_pool_status <> 'open' then raise exception 'Pool is not accepting commitments'; end if;
  if p_quantity > v_max then raise exception 'Quantity exceeds pool limit'; end if;
  select community_id into v_user_community from public.profiles where id = v_user;
  if v_user_community is distinct from v_pool_community then raise exception 'Pool is outside your community'; end if;

  insert into public.commitments(pool_item_id, customer_id, quantity, status, committed_at)
  values(p_pool_item_id, v_user, p_quantity, 'active', now())
  on conflict(pool_item_id, customer_id) do update
    set quantity = excluded.quantity, status = 'active', committed_at = now(), confirmed_at = null
  returning id into v_commitment;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'commitment_upserted','commitment',v_commitment,jsonb_build_object('quantity',p_quantity));
  return v_commitment;
end;
$$;
revoke all on function public.commit_to_pool(uuid,integer) from public, anon;
grant execute on function public.commit_to_pool(uuid,integer) to authenticated;

create or replace function public.confirm_commitment_order(p_commitment_id uuid)
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
  v_order_item_id uuid;
  v_pickup uuid;
  v_amount numeric(12,2);
  v_saving numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_c from public.commitments where id = p_commitment_id and customer_id = v_user for update;
  if not found or v_c.status <> 'active' then raise exception 'Active commitment not found'; end if;
  select * into v_pi from public.pool_items where id = v_c.pool_item_id;
  select * into v_pool from public.pools where id = v_pi.pool_id;
  if v_pool.status <> 'confirmation' then raise exception 'Pool is not in confirmation'; end if;
  if v_pi.final_customer_price is null then raise exception 'Final price is not published'; end if;
  select * into v_profile from public.profiles where id = v_user;
  if v_profile.community_id is distinct from v_pool.community_id then raise exception 'Community mismatch'; end if;

  v_pickup := v_profile.pickup_point_id;
  if v_pickup is null or not exists(select 1 from public.pickup_points p where p.id=v_pickup and p.community_id=v_pool.community_id and p.active) then
    select id into v_pickup from public.pickup_points where community_id=v_pool.community_id and active order by created_at limit 1;
  end if;
  if v_pickup is null then raise exception 'No active pickup point for community'; end if;

  insert into public.orders(customer_id,pool_id,pickup_point_id,status,payment_status,confirmed_at)
  values(v_user,v_pool.id,v_pickup,'confirmed','unpaid',now())
  on conflict(customer_id,pool_id) do update
    set confirmed_at = public.orders.confirmed_at
    where public.orders.status = 'confirmed'
  returning id into v_order_id;
  if v_order_id is null then raise exception 'Existing order is no longer accepting confirmation'; end if;

  v_amount := round(v_pi.final_customer_price * v_c.quantity, 2);
  v_saving := greatest(round((v_pi.benchmark_price_snapshot - v_pi.final_customer_price) * v_c.quantity, 2), 0);
  insert into public.order_items(order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price,expected_saving)
  values(v_order_id,v_pi.id,v_pi.product_id,v_c.quantity,v_pi.benchmark_price_snapshot,v_pi.final_customer_price,v_saving)
  on conflict(order_id,pool_item_id) do nothing
  returning id into v_order_item_id;
  if v_order_item_id is null then raise exception 'This commitment is already confirmed'; end if;

  update public.orders set total_amount = total_amount + v_amount where id = v_order_id;
  update public.commitments set status='confirmed', confirmed_at=now() where id=v_c.id;
  insert into public.fulfilments(order_id,pickup_point_id,status) values(v_order_id,v_pickup,'pending') on conflict(order_id) do nothing;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'order_item_confirmed','order',v_order_id,jsonb_build_object('commitment_id',v_c.id,'order_item_id',v_order_item_id,'amount',v_amount));
  return v_order_id;
end;
$$;
revoke all on function public.confirm_commitment_order(uuid) from public, anon;
grant execute on function public.confirm_commitment_order(uuid) to authenticated;

create or replace function public.admin_approve_benchmark(p_product_id uuid, p_community_id uuid, p_price numeric, p_method text default 'median/reasonable verified local-market price')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin') then raise exception 'Admin required'; end if;
  if p_price <= 0 then raise exception 'Benchmark must be positive'; end if;
  update public.market_price_benchmarks set superseded_at=now() where product_id=p_product_id and community_id=p_community_id and approved and superseded_at is null;
  insert into public.market_price_benchmarks(product_id,community_id,benchmark_price,method,approved,approved_by,approved_at)
  values(p_product_id,p_community_id,p_price,coalesce(nullif(p_method,''),'approved local-market benchmark'),true,v_user,now()) returning id into v_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'benchmark_approved','market_price_benchmark',v_id,jsonb_build_object('price',p_price));
  return v_id;
end;
$$;
revoke all on function public.admin_approve_benchmark(uuid,uuid,numeric,text) from public, anon;
grant execute on function public.admin_approve_benchmark(uuid,uuid,numeric,text) to authenticated;

create or replace function public.admin_finalize_pool_item(p_pool_item_id uuid, p_quote_id uuid, p_final_customer_price numeric, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_quote_item uuid;
begin
  if v_user is null or not private.has_role(v_user,'admin') then raise exception 'Admin required'; end if;
  if p_final_customer_price <= 0 then raise exception 'Final price must be positive'; end if;
  select pool_item_id into v_quote_item from public.supplier_quotes where id=p_quote_id;
  if v_quote_item is distinct from p_pool_item_id then raise exception 'Quote does not belong to pool item'; end if;
  update public.supplier_quotes set selected=false where pool_item_id=p_pool_item_id;
  update public.supplier_quotes set selected=true, selection_reason=p_reason where id=p_quote_id;
  update public.pool_items set selected_supplier_quote_id=p_quote_id, final_customer_price=p_final_customer_price where id=p_pool_item_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pool_item_finalized','pool_item',p_pool_item_id,jsonb_build_object('quote_id',p_quote_id,'final_customer_price',p_final_customer_price,'reason',p_reason));
end;
$$;
revoke all on function public.admin_finalize_pool_item(uuid,uuid,numeric,text) from public, anon;
grant execute on function public.admin_finalize_pool_item(uuid,uuid,numeric,text) to authenticated;
