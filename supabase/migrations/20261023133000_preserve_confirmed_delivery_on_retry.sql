-- A duplicate/stale delivery submission must not silently discard a staff-issued
-- price quote. A deliberate change of fulfillment or destination still requests
-- a fresh staff quote. Nothing here creates a charge, payment or order.
create or replace function public.customer_set_simple_sale_quote_delivery(
 p_quote uuid,p_fulfillment text,p_pickup_point uuid default null,p_home_address text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;c public.simple_sale_cycles%rowtype;
 address_text text; point_uuid uuid;
begin
 if u is null then raise exception 'Sign in first';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote and customer_id=u for update;
 if q.id is null or q.status not in ('awaiting_delivery','quoted') then
  raise exception 'Delivery selection is closed';end if;
 select * into c from public.simple_sale_cycles where id=q.cycle_id and status='closed';
 if c.id is null then raise exception 'Cycle is not yet closed';end if;
 if p_fulfillment='pickup' then
  select p.id into point_uuid from public.pickup_points p
  where p.id=p_pickup_point and p.active and p.community_id=c.community_id;
  if point_uuid is null then raise exception 'Choose an active community pickup point';end if;
  address_text=null;
 elsif p_fulfillment='home_delivery' then
  address_text=btrim(coalesce(p_home_address,''));
  if char_length(address_text) not between 10 and 350 then
   raise exception 'Enter a valid home address';end if;
  point_uuid=null;
 else raise exception 'Choose pickup or home delivery';end if;
 -- The same preference is an idempotent retry. In particular, preserve a
 -- confirmed delivery fee, quoted_by and quoted_at if staff already quoted it.
 if q.fulfillment is not distinct from p_fulfillment
  and q.pickup_point_id is not distinct from point_uuid
  and q.home_address is not distinct from address_text then
  return true;
 end if;
 -- An actual change before customer consent invalidates the old staff fee.
 update public.simple_sale_cycle_quotes set status='awaiting_delivery',
  fulfillment=p_fulfillment,pickup_point_id=point_uuid,home_address=address_text,
  delivery_fee=null,quoted_by=null,quoted_at=null,accepted_at=null,
  updated_at=now() where id=p_quote;
 return true;
end $$;
revoke all on function public.customer_set_simple_sale_quote_delivery(uuid,text,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.customer_set_simple_sale_quote_delivery(uuid,text,uuid,text) to authenticated;
