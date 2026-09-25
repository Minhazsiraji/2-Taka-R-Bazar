-- Safe Step-1 read models for customer/community and pickup operations.
-- These RPCs return aggregates or only the customer contact attached to an order
-- that the current pickup operator is assigned to. They never expose platform-wide PII.

create or replace function public.get_my_community_summary()
returns table(
  community_id uuid,
  household_count bigint,
  active_pool_count bigint,
  month_verified_saving numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_community uuid;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka';
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select p.community_id into v_community from public.profiles p where p.id = v_user;
  if v_community is null then raise exception 'Complete onboarding first'; end if;

  return query
  select
    v_community,
    (select count(*) from public.profiles p where p.community_id = v_community and p.onboarding_completed_at is not null),
    (select count(*) from public.pools po where po.community_id = v_community and po.status in ('open','pricing','final_price','confirmation','ordered','ready_for_pickup')),
    coalesce((select sum(s.amount) from public.savings_ledger s where s.community_id = v_community and s.verified_at >= v_month_start), 0)::numeric;
end;
$$;
revoke all on function public.get_my_community_summary() from public, anon;
grant execute on function public.get_my_community_summary() to authenticated;

create or replace function public.get_pool_demand(p_pool_id uuid)
returns table(pool_item_id uuid, total_quantity bigint, household_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_pool_community uuid;
  v_user_community uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select po.community_id into v_pool_community from public.pools po where po.id = p_pool_id;
  if v_pool_community is null then raise exception 'Pool not found'; end if;
  select p.community_id into v_user_community from public.profiles p where p.id = v_user;
  if not private.has_role(v_user, 'admin') and v_user_community is distinct from v_pool_community then
    raise exception 'Pool is outside your community';
  end if;

  return query
  select c.pool_item_id, coalesce(sum(c.quantity),0)::bigint, count(*)::bigint
  from public.commitments c
  join public.pool_items pi on pi.id = c.pool_item_id
  where pi.pool_id = p_pool_id and c.status in ('active','confirmed')
  group by c.pool_item_id;
end;
$$;
revoke all on function public.get_pool_demand(uuid) from public, anon;
grant execute on function public.get_pool_demand(uuid) to authenticated;

create or replace function public.get_pickup_customer_contacts()
returns table(order_id uuid, full_name text, phone text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not private.has_role(v_user, 'admin') and not private.has_role(v_user, 'pickup_operator') then
    raise exception 'Pickup operator role required';
  end if;

  return query
  select o.id, p.full_name, p.phone
  from public.orders o
  join public.profiles p on p.id = o.customer_id
  where o.status in ('ready_for_pickup','completed')
    and private.is_assigned_pickup(v_user, o.pickup_point_id);
end;
$$;
revoke all on function public.get_pickup_customer_contacts() from public, anon;
grant execute on function public.get_pickup_customer_contacts() to authenticated;
