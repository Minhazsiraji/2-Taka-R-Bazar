-- Delivery preference is not an order and not a priced shipping quote.
create table if not exists public.simple_sale_commitment_delivery(
 offer_id uuid not null references public.simple_sale_offers(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete cascade,
 community_id uuid not null references public.communities(id) on delete restrict,
 fulfillment text not null check(fulfillment in ('pickup','home_delivery')),
 pickup_point_id uuid references public.pickup_points(id),
 home_address text,
 delivery_fee numeric(12,2) check(delivery_fee is null or delivery_fee>=0),
 delivery_quoted_at timestamptz,
 customer_accepted_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(offer_id,customer_id),
 constraint commitment_delivery_location_check check(
  (fulfillment='pickup' and pickup_point_id is not null and home_address is null)
  or (fulfillment='home_delivery' and pickup_point_id is null and char_length(btrim(home_address)) between 10 and 350)
 )
);
alter table public.simple_sale_commitment_delivery enable row level security;
revoke all on public.simple_sale_commitment_delivery from public,anon,authenticated;
create policy customer_read_delivery_preference on public.simple_sale_commitment_delivery
 for select to authenticated using(customer_id=(select auth.uid()));
grant select on public.simple_sale_commitment_delivery to authenticated;
create or replace function public.save_simple_sale_delivery_preference(
 p_offer uuid,p_fulfillment text,p_pickup_point uuid default null,p_home_address text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();nominee uuid;point_uuid uuid; address_text text;
begin
 if u is null then raise exception 'Sign in before choosing delivery';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||u::text,84108));
 perform 1 from public.simple_sale_offers o
 where o.id=p_offer and o.kind in ('COMMUNITY_POOL','GROUP_DEAL') and o.published
 and (o.closes_at is null or o.closes_at>now()) for share;
 if not found then raise exception 'This commitment is no longer open for changes';end if;
 select j.community_id into nominee from public.simple_sale_offer_joins j
 where j.offer_id=p_offer and j.customer_id=u and j.status='active' limit 1;
 if nominee is null then raise exception 'Join this community offer before selecting delivery';end if;
 if p_fulfillment='pickup' then
  select p.id into point_uuid from public.pickup_points p where p.id=p_pickup_point
   and p.active and p.community_id=nominee;
  if point_uuid is null then raise exception 'Choose an active pickup point in your nominated community';end if;
  address_text:=null;
 elsif p_fulfillment='home_delivery' then
  address_text:=btrim(coalesce(p_home_address,''));
  if char_length(address_text) not between 10 and 350 then raise exception 'Enter a home delivery address (10–350 characters)';end if;
  point_uuid:=null;
 else
  raise exception 'Choose community pickup or home delivery';
 end if;
 insert into public.simple_sale_commitment_delivery
  (offer_id,customer_id,community_id,fulfillment,pickup_point_id,home_address,delivery_fee,delivery_quoted_at,customer_accepted_at)
 values(p_offer,u,nominee,p_fulfillment,point_uuid,address_text,null,null,null)
 on conflict(offer_id,customer_id) do update set
  community_id=excluded.community_id,fulfillment=excluded.fulfillment,
  pickup_point_id=excluded.pickup_point_id,home_address=excluded.home_address,
  delivery_fee=null,delivery_quoted_at=null,customer_accepted_at=null,updated_at=now();
 return true;
end $$;
revoke all on function public.save_simple_sale_delivery_preference(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.save_simple_sale_delivery_preference(uuid,text,uuid,text) to authenticated;
