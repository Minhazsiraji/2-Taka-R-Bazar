-- Owner-visible flag for legacy shared-offer requests placed before quote consent.
-- No extra privileges: owners only; admins are not needed to read another customer's flag.
create or replace function public.launch_order_has_unsettled_shared_item(p_order uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.launch_orders o where o.id=p_order and o.customer_id=auth.uid()
 ) then return false; end if;
 return exists(
  select 1 from public.launch_order_items i
  join public.simple_sale_offers o on o.id=i.offer_id
  where i.order_id=p_order and o.kind in ('GROUP_DEAL','COMMUNITY_POOL')
 );
end $$;
revoke all on function public.launch_order_has_unsettled_shared_item(uuid) from public,anon,authenticated,service_role;
grant execute on function public.launch_order_has_unsettled_shared_item(uuid) to authenticated;
