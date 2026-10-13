-- Issue #64 Smart Location: customer-owned saved addresses and verified delivery grouping.
-- No auth account changes, no finance writes, no automatic residency inference.
-- Run first in a disposable database. DO NOT apply to Production without release gates.
create table if not exists public.delivery_buildings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  zone_code text not null check (length(zone_code) between 1 and 60),
  building_code text not null check (length(building_code) between 1 and 60),
  display_name text not null check (length(display_name) between 2 and 180),
  active boolean not null default true,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(community_id,zone_code,building_code),
  unique(id,community_id)
);
alter table public.delivery_buildings enable row level security;
revoke all on public.delivery_buildings from public,anon,authenticated;
-- Only privileged operational migrations/services provision trusted building IDs.

create table if not exists public.customer_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete restrict,
  building_id uuid,
  building_label text not null check (length(building_label) between 2 and 120),
  unit_label text not null check (length(unit_label) between 1 and 80),
  street_line text not null check (length(street_line) between 3 and 240),
  landmark text check (landmark is null or length(landmark) <= 240),
  address_text text not null check (length(address_text) between 8 and 680),
  verification_status text not null default 'customer_confirmed'
    check(verification_status in ('customer_confirmed','operator_verified','rejected')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(building_id,community_id) references public.delivery_buildings(id,community_id) on delete restrict
);
create index if not exists customer_delivery_addresses_customer_idx on public.customer_delivery_addresses(customer_id,updated_at desc);
create unique index if not exists customer_delivery_addresses_default_unique
  on public.customer_delivery_addresses(customer_id) where is_default;
alter table public.customer_delivery_addresses enable row level security;
revoke all on public.customer_delivery_addresses from public,anon,authenticated;
grant select on public.customer_delivery_addresses to authenticated;
drop policy if exists customer_delivery_addresses_own_read on public.customer_delivery_addresses;
create policy customer_delivery_addresses_own_read on public.customer_delivery_addresses
 for select to authenticated using ((select auth.uid())=customer_id);
-- Callers cannot self-certify a house, change community, or mutate coordinates.

create or replace function public.save_my_delivery_address(
 p_building_label text,p_unit_label text,p_street_line text,
 p_landmark text default null,p_default boolean default true
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_community uuid; v_id uuid;
        v_building text:=btrim(coalesce(p_building_label,''));
        v_unit text:=btrim(coalesce(p_unit_label,''));
        v_street text:=btrim(coalesce(p_street_line,''));
        v_landmark text:=nullif(btrim(coalesce(p_landmark,'')),'');
        v_address text;
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 if length(v_building) not between 2 and 120 or length(v_unit) not between 1 and 80
    or length(v_street) not between 3 and 240 or length(coalesce(v_landmark,''))>240
 then raise exception 'Please confirm a valid building, flat and street'; end if;
 -- Serialize each customer's changes to the default address.
 select community_id into v_community from public.profiles where id=v_uid
   and onboarding_completed_at is not null for update;
 if v_community is null then raise exception 'Complete community onboarding first'; end if;
 v_address:=concat_ws(', ',v_unit,v_building,v_street,v_landmark);
 select id into v_id from public.customer_delivery_addresses
  where customer_id=v_uid and community_id=v_community
    and lower(address_text)=lower(v_address) limit 1;
 if p_default then
  update public.customer_delivery_addresses set is_default=false,updated_at=now()
  where customer_id=v_uid and is_default;
 end if;
 if v_id is null then
  insert into public.customer_delivery_addresses(
    customer_id,community_id,building_label,unit_label,street_line,landmark,
    address_text,verification_status,is_default)
  values(v_uid,v_community,v_building,v_unit,v_street,v_landmark,
    v_address,'customer_confirmed',coalesce(p_default,false))
  returning id into v_id;
 else
  update public.customer_delivery_addresses
    set is_default=coalesce(p_default,false),updated_at=now()
  where id=v_id and customer_id=v_uid;
 end if;
 return v_id;
end $$;
revoke all on function public.save_my_delivery_address(text,text,text,text,boolean) from public,anon;
grant execute on function public.save_my_delivery_address(text,text,text,text,boolean) to authenticated;

-- Operational candidate engine: only verified building IDs can be bundled.
-- Supplier group and time window are supplied by trusted fulfillment planning.
alter table public.orders add column if not exists delivery_address_id uuid
 references public.customer_delivery_addresses(id) on delete restrict;

create table if not exists public.delivery_bundles (
 id uuid primary key default gen_random_uuid(),
 community_id uuid not null references public.communities(id),
 building_id uuid not null references public.delivery_buildings(id),
 supplier_group_id text not null check(length(supplier_group_id) between 1 and 72),
 delivery_date date not null,
 delivery_window text not null check(length(delivery_window) between 1 and 72),
 capacity integer not null default 50 check(capacity between 1 and 500),
 status text not null default 'planning' check(status in ('planning','sealed','dispatched','completed','cancelled')),
 created_at timestamptz not null default now(),
 unique(community_id,building_id,supplier_group_id,delivery_date,delivery_window)
);
create table if not exists public.delivery_bundle_orders(
 bundle_id uuid not null references public.delivery_bundles(id) on delete restrict,
 order_id uuid not null unique references public.orders(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(bundle_id,order_id)
);
create index if not exists delivery_bundle_orders_order_idx on public.delivery_bundle_orders(order_id);
alter table public.delivery_bundles enable row level security;
alter table public.delivery_bundle_orders enable row level security;
revoke all on public.delivery_bundles from public,anon,authenticated;
revoke all on public.delivery_bundle_orders from public,anon,authenticated;

create or replace function private.allocate_verified_delivery_bundle(
 p_order_id uuid,p_supplier_group text,p_delivery_date date,p_window text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_community uuid;v_building uuid;v_bundle uuid;v_count integer;v_cap integer;
begin
 if auth.role() <> 'service_role' then raise exception 'Operations-only allocation'; end if;
 if p_order_id is null or p_delivery_date is null
    or coalesce(p_supplier_group,'') !~ '^[a-zA-Z0-9_-]{1,72}$'
    or coalesce(p_window,'') !~ '^[a-zA-Z0-9_-]{1,72}$'
 then raise exception 'Invalid allocation request'; end if;
 select a.community_id,a.building_id into v_community,v_building
 from public.orders o join public.pools p on p.id=o.pool_id
 join public.customer_delivery_addresses a on a.id=o.delivery_address_id
 join public.delivery_buildings b on b.id=a.building_id and b.community_id=a.community_id
 where o.id=p_order_id and o.customer_id=a.customer_id
   and p.community_id=a.community_id and o.fulfillment_method='home_delivery'
   and o.status not in ('cancelled','completed')
   and a.verification_status='operator_verified' and b.active and b.verified_at is not null
   and o.delivery_address=a.address_text;
 if v_community is null or v_building is null then
  raise exception 'Verified household delivery address required';
 end if;
 select bundle_id into v_bundle from public.delivery_bundle_orders where order_id=p_order_id;
 if v_bundle is not null then return v_bundle; end if;
 insert into public.delivery_bundles(community_id,building_id,supplier_group_id,delivery_date,delivery_window)
 values(v_community,v_building,p_supplier_group,p_delivery_date,p_window)
 on conflict(community_id,building_id,supplier_group_id,delivery_date,delivery_window)
 do nothing;
 select id,capacity into v_bundle,v_cap from public.delivery_bundles
 where community_id=v_community and building_id=v_building and supplier_group_id=p_supplier_group
   and delivery_date=p_delivery_date and delivery_window=p_window and status='planning'
 for update;
 if v_bundle is null then raise exception 'Delivery bundle closed'; end if;
 select count(*) into v_count from public.delivery_bundle_orders where bundle_id=v_bundle;
 if v_count>=v_cap then raise exception 'Delivery bundle capacity reached'; end if;
 insert into public.delivery_bundle_orders(bundle_id,order_id) values(v_bundle,p_order_id)
 on conflict(order_id) do nothing;
 select bundle_id into v_bundle from public.delivery_bundle_orders where order_id=p_order_id;
 return v_bundle;
end $$;
revoke all on function private.allocate_verified_delivery_bundle(uuid,text,date,text)
 from public,anon,authenticated;
grant execute on function private.allocate_verified_delivery_bundle(uuid,text,date,text) to service_role;
