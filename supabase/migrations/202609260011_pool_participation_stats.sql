create or replace function public.get_pool_participation(p_pool_id uuid)
returns table(joined_households bigint,total_committed_units bigint)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_pool_community uuid;
  v_user_community uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select community_id into v_pool_community from public.pools where id=p_pool_id;
  if v_pool_community is null then raise exception 'Pool not found'; end if;
  select community_id into v_user_community from public.profiles where id=v_user;
  if not private.has_role(v_user,'admin') and v_user_community is distinct from v_pool_community then raise exception 'Pool is outside your community'; end if;

  return query
  select count(distinct c.customer_id)::bigint, coalesce(sum(c.quantity),0)::bigint
  from public.commitments c
  join public.pool_items pi on pi.id=c.pool_item_id
  where pi.pool_id=p_pool_id and c.status in ('active','confirmed');
end;
$$;
revoke all on function public.get_pool_participation(uuid) from public;
grant execute on function public.get_pool_participation(uuid) to authenticated;
