-- Secure Group Deals + supplier demand network.
-- This migration intentionally keeps the existing Pool engine unchanged.
-- Customer price, group counts, location eligibility, supplier access and fraud gates remain database-owned.

create extension if not exists postgis with schema extensions;

alter table public.communities
  add column if not exists center_latitude numeric(10,7),
  add column if not exists center_longitude numeric(10,7),
  add column if not exists match_radius_m integer not null default 1500,
  add column if not exists location_matching_enabled boolean not null default false;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='communities_center_latitude_check') then
    alter table public.communities add constraint communities_center_latitude_check
      check(center_latitude is null or center_latitude between -90 and 90);
  end if;
  if not exists(select 1 from pg_constraint where conname='communities_center_longitude_check') then
    alter table public.communities add constraint communities_center_longitude_check
      check(center_longitude is null or center_longitude between -180 and 180);
  end if;
  if not exists(select 1 from pg_constraint where conname='communities_match_radius_check') then
    alter table public.communities add constraint communities_match_radius_check
      check(match_radius_m between 100 and 10000);
  end if;
end $$;

create table if not exists public.community_geo_zones (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  boundary extensions.geometry(MultiPolygon,4326) not null,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists community_geo_zones_boundary_gix on public.community_geo_zones using gist(boundary);
create index if not exists community_geo_zones_community_idx on public.community_geo_zones(community_id,active,priority);

create table if not exists public.group_deals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  title text not null,
  status text not null default 'draft'
    check(status in ('draft','open','locked','procurement','fulfilling','completed','cancelled')),
  market_price_snapshot numeric(12,2) not null check(market_price_snapshot>0),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  pickup_at timestamptz not null,
  min_group_size integer not null default 5 check(min_group_size>=5),
  circle_capacity integer not null default 10 check(circle_capacity in (5,10)),
  max_quantity_per_buyer integer not null default 20 check(max_quantity_per_buyer between 1 and 100),
  locked_buyer_count integer,
  locked_unit_quantity integer,
  locked_unit_price numeric(12,2),
  locked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(closes_at>opens_at),
  check(pickup_at>closes_at),
  check(circle_capacity>=min_group_size),
  check(locked_buyer_count is null or locked_buyer_count>=0),
  check(locked_unit_quantity is null or locked_unit_quantity>=0),
  check(locked_unit_price is null or locked_unit_price>0)
);

create table if not exists public.group_deal_tiers (
  id uuid primary key default gen_random_uuid(),
  group_deal_id uuid not null references public.group_deals(id) on delete cascade,
  buyer_threshold integer not null check(buyer_threshold>=5),
  customer_unit_price numeric(12,2) not null check(customer_unit_price>0),
  created_at timestamptz not null default now(),
  unique(group_deal_id,buyer_threshold)
);

create table if not exists public.group_deal_communities (
  group_deal_id uuid not null references public.group_deals(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(group_deal_id,community_id)
);

create table if not exists public.group_circles (
  id uuid primary key default gen_random_uuid(),
  group_deal_id uuid not null references public.group_deals(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete restrict,
  target_size integer not null default 10 check(target_size in (5,10)),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists group_circles_deal_community_idx on public.group_circles(group_deal_id,community_id,created_at);

create table if not exists public.group_deal_commitments (
  id uuid primary key default gen_random_uuid(),
  group_deal_id uuid not null references public.group_deals(id) on delete cascade,
  circle_id uuid not null references public.group_circles(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null check(quantity between 1 and 100),
  status text not null default 'forming' check(status in ('forming','qualified','cancelled','fulfilled')),
  qualification_version text not null default 'geo-risk-v1',
  qualified_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  updated_at timestamptz not null default now(),
  unique(group_deal_id,customer_id)
);
create index if not exists group_commitments_deal_status_idx on public.group_deal_commitments(group_deal_id,status);
create index if not exists group_commitments_circle_status_idx on public.group_deal_commitments(circle_id,status);
create index if not exists group_commitments_customer_idx on public.group_deal_commitments(customer_id,updated_at desc);

create table if not exists public.supplier_memberships (
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'analyst' check(role in ('owner','manager','analyst')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(supplier_id,user_id)
);
create index if not exists supplier_memberships_user_idx on public.supplier_memberships(user_id,active);

create table if not exists public.supplier_products (
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  relationship_type text not null default 'supplier'
    check(relationship_type in ('manufacturer','distributor','supplier','vendor')),
  supplier_sku text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(supplier_id,product_id)
);
create index if not exists supplier_products_product_idx on public.supplier_products(product_id,active);

create table if not exists private.customer_location_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  location extensions.geography(Point,4326) not null,
  accuracy_m numeric(8,2) not null check(accuracy_m>0),
  distance_m numeric(12,2),
  verification_method text not null default 'gps-community',
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists customer_location_verifications_location_gix
  on private.customer_location_verifications using gist(location);

create table if not exists private.group_circle_locations (
  circle_id uuid primary key references public.group_circles(id) on delete cascade,
  anchor_location extensions.geography(Point,4326) not null,
  created_at timestamptz not null default now()
);
create index if not exists group_circle_locations_anchor_gix
  on private.group_circle_locations using gist(anchor_location);

create table if not exists private.customer_risk_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  risk_score integer not null default 20 check(risk_score between 0 and 100),
  trust_level text not null default 'new' check(trust_level in ('new','trusted','restricted','blocked')),
  completed_orders integer not null default 0 check(completed_orders>=0),
  cod_failures integer not null default 0 check(cod_failures>=0),
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists private.group_security_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  group_deal_id uuid references public.group_deals(id) on delete set null,
  event_type text not null,
  decision text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists group_security_events_user_time_idx
  on private.group_security_events(user_id,event_type,created_at desc);

revoke all on table private.customer_location_verifications from public,anon,authenticated,service_role;
revoke all on table private.group_circle_locations from public,anon,authenticated,service_role;
revoke all on table private.customer_risk_profiles from public,anon,authenticated,service_role;
revoke all on table private.group_security_events from public,anon,authenticated,service_role;

drop trigger if exists group_deals_touch on public.group_deals;
create trigger group_deals_touch before update on public.group_deals
for each row execute function private.touch_updated_at();

drop trigger if exists group_commitments_touch on public.group_deal_commitments;
create trigger group_commitments_touch before update on public.group_deal_commitments
for each row execute function private.touch_updated_at();

drop trigger if exists supplier_products_touch on public.supplier_products;
create trigger supplier_products_touch before update on public.supplier_products
for each row execute function private.touch_updated_at();

create or replace function private.is_ops(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_user is not null and (
    private.has_role(p_user,'admin') or private.has_role(p_user,'super_admin')
  );
$$;
revoke all on function private.is_ops(uuid) from public,anon,authenticated,service_role;
grant execute on function private.is_ops(uuid) to authenticated;

create or replace function private.is_supplier_member(p_user uuid,p_supplier uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.supplier_memberships sm
    join public.suppliers s on s.id=sm.supplier_id
    where sm.user_id=p_user and sm.supplier_id=p_supplier and sm.active and s.active
  );
$$;
revoke all on function private.is_supplier_member(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.is_supplier_member(uuid,uuid) to authenticated;

create or replace function private.can_read_group_deal(p_deal uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.group_deal_communities dc
    join public.profiles p on p.id=auth.uid()
    where dc.group_deal_id=p_deal
      and dc.community_id=p.community_id
      and p.onboarding_completed_at is not null
  );
$$;
revoke all on function private.can_read_group_deal(uuid) from public,anon,authenticated,service_role;
grant execute on function private.can_read_group_deal(uuid) to authenticated;

create or replace function private.has_valid_group_location(p_user uuid,p_community uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.customer_location_verifications v
    where v.user_id=p_user and v.community_id=p_community and v.expires_at>now()
  );
$$;
revoke all on function private.has_valid_group_location(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.group_deal_price(p_deal uuid,p_buyers bigint)
returns numeric language sql stable security definer set search_path='' as $$
  select t.customer_unit_price
  from public.group_deal_tiers t
  where t.group_deal_id=p_deal and t.buyer_threshold<=p_buyers
  order by t.buyer_threshold desc
  limit 1;
$$;
revoke all on function private.group_deal_price(uuid,bigint) from public,anon,authenticated,service_role;

alter table public.community_geo_zones enable row level security;
alter table public.group_deals enable row level security;
alter table public.group_deal_tiers enable row level security;
alter table public.group_deal_communities enable row level security;
alter table public.group_circles enable row level security;
alter table public.group_deal_commitments enable row level security;
alter table public.supplier_memberships enable row level security;
alter table public.supplier_products enable row level security;

drop policy if exists community_geo_zones_ops on public.community_geo_zones;
create policy community_geo_zones_ops on public.community_geo_zones
for select to authenticated using(private.is_ops((select auth.uid())));

drop policy if exists group_deals_read on public.group_deals;
create policy group_deals_read on public.group_deals
for select to authenticated using(
  private.is_ops((select auth.uid())) or private.can_read_group_deal(id)
);

drop policy if exists group_deal_tiers_read on public.group_deal_tiers;
create policy group_deal_tiers_read on public.group_deal_tiers
for select to authenticated using(
  private.is_ops((select auth.uid())) or private.can_read_group_deal(group_deal_id)
);

drop policy if exists group_deal_communities_read on public.group_deal_communities;
create policy group_deal_communities_read on public.group_deal_communities
for select to authenticated using(
  private.is_ops((select auth.uid())) or
  community_id=(select p.community_id from public.profiles p where p.id=(select auth.uid()))
);

drop policy if exists group_circles_ops on public.group_circles;
create policy group_circles_ops on public.group_circles
for select to authenticated using(private.is_ops((select auth.uid())));

drop policy if exists group_commitments_read on public.group_deal_commitments;
create policy group_commitments_read on public.group_deal_commitments
for select to authenticated using(
  customer_id=(select auth.uid()) or private.is_ops((select auth.uid()))
);

drop policy if exists supplier_memberships_read on public.supplier_memberships;
create policy supplier_memberships_read on public.supplier_memberships
for select to authenticated using(
  user_id=(select auth.uid()) or private.is_ops((select auth.uid()))
);

drop policy if exists supplier_products_read on public.supplier_products;
create policy supplier_products_read on public.supplier_products
for select to authenticated using(
  private.is_ops((select auth.uid())) or
  private.is_supplier_member((select auth.uid()),supplier_id)
);

grant select on public.community_geo_zones to authenticated;
grant select on public.group_deals to authenticated;
grant select on public.group_deal_tiers to authenticated;
grant select on public.group_deal_communities to authenticated;
grant select on public.group_circles to authenticated;
grant select on public.group_deal_commitments to authenticated;
grant select on public.supplier_memberships to authenticated;
grant select on public.supplier_products to authenticated;

create or replace function public.admin_update_community_geo(
  p_community_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_radius_m integer,
  p_enabled boolean
)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if p_enabled and (p_latitude is null or p_longitude is null) then
    raise exception 'Latitude and longitude are required when location matching is enabled';
  end if;
  if p_latitude is not null and (p_latitude<-90 or p_latitude>90) then raise exception 'Invalid latitude'; end if;
  if p_longitude is not null and (p_longitude<-180 or p_longitude>180) then raise exception 'Invalid longitude'; end if;
  if p_radius_m is null or p_radius_m<100 or p_radius_m>10000 then raise exception 'Radius must be between 100 and 10000 metres'; end if;
  update public.communities set
    center_latitude=p_latitude,
    center_longitude=p_longitude,
    match_radius_m=p_radius_m,
    location_matching_enabled=coalesce(p_enabled,false),
    updated_at=now()
  where id=p_community_id;
  if not found then raise exception 'Community not found'; end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_geo_updated','community',p_community_id,
    jsonb_build_object('radius_m',p_radius_m,'enabled',coalesce(p_enabled,false)));
end $$;
revoke all on function public.admin_update_community_geo(uuid,numeric,numeric,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function public.admin_update_community_geo(uuid,numeric,numeric,integer,boolean) to authenticated;

create or replace function public.verify_my_community_location(
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m numeric
)
returns table(
  verified boolean,
  configured boolean,
  community_name text,
  distance_meters numeric,
  accuracy_meters numeric,
  expires_at timestamptz,
  reason text
)
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_community uuid;
  v_name text;
  v_enabled boolean;
  v_lat numeric;
  v_lng numeric;
  v_radius integer;
  v_point extensions.geography(Point,4326);
  v_match boolean:=false;
  v_configured boolean:=false;
  v_has_polygon boolean:=false;
  v_distance numeric;
  v_attempts integer;
  v_max_accuracy numeric;
  v_expiry timestamptz;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_latitude is null or p_longitude is null or p_accuracy_m is null
     or p_latitude<-90 or p_latitude>90 or p_longitude<-180 or p_longitude>180 or p_accuracy_m<=0 then
    return query select false,false,null::text,null::numeric,p_accuracy_m,null::timestamptz,'Invalid location reading';
    return;
  end if;

  insert into private.group_security_events(user_id,event_type,decision,metadata)
  values(v_user,'location_verify','attempt',jsonb_build_object('accuracy_m',round(p_accuracy_m,1)));

  select count(*) into v_attempts
  from private.group_security_events
  where user_id=v_user and event_type='location_verify' and created_at>now()-interval '1 hour';
  if v_attempts>12 then
    update private.group_security_events set decision='rate_limited'
      where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='location_verify');
    return query select false,false,null::text,null::numeric,p_accuracy_m,null::timestamptz,'Too many location checks. Try again later.';
    return;
  end if;

  select p.community_id,c.name,c.location_matching_enabled,c.center_latitude,c.center_longitude,c.match_radius_m
    into v_community,v_name,v_enabled,v_lat,v_lng,v_radius
  from public.profiles p join public.communities c on c.id=p.community_id
  where p.id=v_user and p.onboarding_completed_at is not null and c.active;
  if v_community is null then
    return query select false,false,null::text,null::numeric,p_accuracy_m,null::timestamptz,'Complete onboarding first';
    return;
  end if;

  v_point:=extensions.st_setsrid(extensions.st_makepoint(p_longitude,p_latitude),4326)::extensions.geography;
  select exists(select 1 from public.community_geo_zones z where z.community_id=v_community and z.active)
    into v_has_polygon;
  v_configured:=v_enabled and (
    v_has_polygon or (v_lat is not null and v_lng is not null) or exists(
      select 1 from public.pickup_points pp
      where pp.community_id=v_community and pp.active and pp.latitude is not null and pp.longitude is not null
    )
  );

  if not v_configured then
    return query select false,false,v_name,null::numeric,p_accuracy_m,null::timestamptz,'Community location matching is not configured yet';
    return;
  end if;

  v_max_accuracy:=least(500::numeric,greatest(100::numeric,v_radius::numeric/2));
  if p_accuracy_m>v_max_accuracy then
    update private.group_security_events set decision='accuracy_rejected'
      where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='location_verify');
    return query select false,true,v_name,null::numeric,p_accuracy_m,null::timestamptz,
      'GPS accuracy is too weak. Move near a window/outdoors and try again.';
    return;
  end if;

  if v_has_polygon then
    select exists(
      select 1 from public.community_geo_zones z
      where z.community_id=v_community and z.active
        and extensions.st_covers(z.boundary,v_point::extensions.geometry)
    ) into v_match;
    if v_match then v_distance:=0; end if;
  elsif v_lat is not null and v_lng is not null then
    v_distance:=round(extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(v_lng,v_lat),4326)::extensions.geography,
      v_point
    )::numeric,2);
    v_match:=v_distance<=v_radius;
  else
    select min(extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(pp.longitude,pp.latitude),4326)::extensions.geography,
      v_point
    ))::numeric
    into v_distance
    from public.pickup_points pp
    where pp.community_id=v_community and pp.active and pp.latitude is not null and pp.longitude is not null;
    v_match:=coalesce(v_distance<=v_radius,false);
  end if;

  if not v_match then
    update private.group_security_events set decision='outside_zone',
      metadata=metadata||jsonb_build_object('distance_m',case when v_distance is null then null else round(v_distance,0) end)
    where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='location_verify');
    return query select false,true,v_name,
      case when v_distance is null then null else round(v_distance,0) end,p_accuracy_m,null::timestamptz,
      'You appear to be outside this community buying zone.';
    return;
  end if;

  v_expiry:=now()+interval '7 days';
  insert into private.customer_location_verifications(
    user_id,community_id,location,accuracy_m,distance_m,verified_at,expires_at
  )
  values(v_user,v_community,v_point,p_accuracy_m,v_distance,now(),v_expiry)
  on conflict(user_id) do update set
    community_id=excluded.community_id,location=excluded.location,accuracy_m=excluded.accuracy_m,
    distance_m=excluded.distance_m,verified_at=excluded.verified_at,expires_at=excluded.expires_at;

  update private.group_security_events set decision='verified',
    metadata=metadata||jsonb_build_object('distance_m',case when v_distance is null then 0 else round(v_distance,0) end)
  where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='location_verify');

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_location_verified','community',v_community,
    jsonb_build_object('accuracy_m',round(p_accuracy_m,0),'expires_at',v_expiry));

  return query select true,true,v_name,
    case when v_distance is null then 0 else round(v_distance,0) end,p_accuracy_m,v_expiry,'Location verified';
end $$;
revoke all on function public.verify_my_community_location(numeric,numeric,numeric) from public,anon,authenticated,service_role;
grant execute on function public.verify_my_community_location(numeric,numeric,numeric) to authenticated;

create or replace function public.get_my_location_status()
returns table(
  configured boolean,
  verified boolean,
  community_name text,
  accuracy_meters numeric,
  verified_at timestamptz,
  expires_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select
    c.location_matching_enabled and (
      exists(select 1 from public.community_geo_zones z where z.community_id=c.id and z.active)
      or (c.center_latitude is not null and c.center_longitude is not null)
      or exists(select 1 from public.pickup_points pp where pp.community_id=c.id and pp.active and pp.latitude is not null and pp.longitude is not null)
    ) as configured,
    (v.user_id is not null and v.expires_at>now()) as verified,
    c.name,
    v.accuracy_m,
    v.verified_at,
    v.expires_at
  from public.profiles p
  join public.communities c on c.id=p.community_id
  left join private.customer_location_verifications v on v.user_id=p.id and v.community_id=c.id
  where p.id=auth.uid();
$$;
revoke all on function public.get_my_location_status() from public,anon,authenticated,service_role;
grant execute on function public.get_my_location_status() to authenticated;

create or replace function public.join_group_deal(p_group_deal_id uuid,p_quantity integer)
returns table(
  accepted boolean,
  message text,
  commitment_id uuid,
  circle_id uuid,
  circle_members bigint,
  circle_target integer,
  community_buyers bigint,
  current_price numeric,
  next_threshold integer,
  next_price numeric,
  buyers_needed integer
)
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_deal public.group_deals%rowtype;
  v_community uuid;
  v_location extensions.geography(Point,4326);
  v_risk integer;
  v_trust text;
  v_attempts integer;
  v_commitment uuid;
  v_circle uuid;
  v_circle_target integer;
  v_circle_members bigint;
  v_buyers bigint;
  v_price numeric;
  v_next_threshold integer;
  v_next_price numeric;
  v_existing_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  insert into private.group_security_events(user_id,group_deal_id,event_type,decision)
  values(v_user,p_group_deal_id,'group_join','attempt');

  select count(*) into v_attempts from private.group_security_events
  where user_id=v_user and event_type='group_join' and created_at>now()-interval '1 hour';
  if v_attempts>20 then
    update private.group_security_events set decision='rate_limited'
    where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='group_join');
    return query select false,'Too many join attempts. Try again later.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;

  if p_quantity is null or p_quantity<1 then
    return query select false,'Choose a valid quantity.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;

  select * into v_deal from public.group_deals where id=p_group_deal_id for update;
  if not found or v_deal.status<>'open' or now()<v_deal.opens_at or now()>=v_deal.closes_at then
    return query select false,'This Group Deal is not accepting commitments.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;
  if p_quantity>v_deal.max_quantity_per_buyer then
    return query select false,'Quantity exceeds this deal limit.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;

  select community_id into v_community from public.profiles
  where id=v_user and onboarding_completed_at is not null;
  if v_community is null or not exists(
    select 1 from public.group_deal_communities dc
    where dc.group_deal_id=p_group_deal_id and dc.community_id=v_community
  ) then
    return query select false,'This deal is not available in your community.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;

  select location into v_location from private.customer_location_verifications
  where user_id=v_user and community_id=v_community and expires_at>now();
  if v_location is null then
    update private.group_security_events set decision='location_required'
    where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='group_join');
    return query select false,'Verify your community location before joining a Group Deal.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;

  insert into private.customer_risk_profiles(user_id) values(v_user) on conflict do nothing;
  select risk_score,trust_level into v_risk,v_trust from private.customer_risk_profiles where user_id=v_user for update;
  if v_trust='blocked' or v_risk>=70 then
    update private.group_security_events set decision='risk_blocked',
      metadata=jsonb_build_object('risk_band','high')
    where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='group_join');
    return query select false,'This account needs Operations review before joining Group Deals.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  elsif v_trust='restricted' or v_risk>=50 then
    update private.group_security_events set decision='extra_verification'
    where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='group_join');
    return query select false,'Additional account verification is required before this commitment can count.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_group_deal_id::text||':'||v_community::text,0));

  select id,circle_id,status into v_commitment,v_circle,v_existing_status
  from public.group_deal_commitments
  where group_deal_id=p_group_deal_id and customer_id=v_user
  for update;

  if v_commitment is null then
    select c.id into v_circle
    from public.group_circles c
    join private.group_circle_locations gl on gl.circle_id=c.id
    where c.group_deal_id=p_group_deal_id
      and c.community_id=v_community
      and c.closed_at is null
      and (select count(*) from public.group_deal_commitments gc where gc.circle_id=c.id and gc.status in ('forming','qualified'))<c.target_size
    order by extensions.st_distance(gl.anchor_location,v_location),
      (select count(*) from public.group_deal_commitments gc where gc.circle_id=c.id and gc.status in ('forming','qualified')) desc,
      c.created_at
    limit 1
    for update of c;

    if v_circle is null then
      insert into public.group_circles(group_deal_id,community_id,target_size,created_by)
      values(p_group_deal_id,v_community,v_deal.circle_capacity,v_user)
      returning id into v_circle;
      insert into private.group_circle_locations(circle_id,anchor_location) values(v_circle,v_location);
    end if;

    insert into public.group_deal_commitments(group_deal_id,circle_id,customer_id,quantity,status,qualified_at)
    values(p_group_deal_id,v_circle,v_user,p_quantity,'forming',now())
    returning id into v_commitment;
  else
    if v_existing_status='cancelled' then
      select c.id into v_circle
      from public.group_circles c
      join private.group_circle_locations gl on gl.circle_id=c.id
      where c.group_deal_id=p_group_deal_id
        and c.community_id=v_community
        and c.closed_at is null
        and (select count(*) from public.group_deal_commitments gc where gc.circle_id=c.id and gc.status in ('forming','qualified'))<c.target_size
      order by extensions.st_distance(gl.anchor_location,v_location),
        (select count(*) from public.group_deal_commitments gc where gc.circle_id=c.id and gc.status in ('forming','qualified')) desc,
        c.created_at
      limit 1
      for update of c;
      if v_circle is null then
        insert into public.group_circles(group_deal_id,community_id,target_size,created_by)
        values(p_group_deal_id,v_community,v_deal.circle_capacity,v_user)
        returning id into v_circle;
        insert into private.group_circle_locations(circle_id,anchor_location) values(v_circle,v_location);
      end if;
      update public.group_deal_commitments
      set circle_id=v_circle,status='forming',quantity=p_quantity,qualified_at=now(),cancelled_at=null,cancellation_reason=null
      where id=v_commitment;
    else
      update public.group_deal_commitments set quantity=p_quantity where id=v_commitment;
    end if;
  end if;

  select target_size into v_circle_target from public.group_circles where id=v_circle;
  select count(*) into v_circle_members from public.group_deal_commitments where circle_id=v_circle and status in ('forming','qualified');
  if v_circle_members>=v_deal.min_group_size then
    update public.group_deal_commitments
    set status='qualified',qualified_at=now()
    where circle_id=v_circle and status='forming';
  end if;
  if v_circle_members>=v_circle_target then update public.group_circles set closed_at=coalesce(closed_at,now()) where id=v_circle; end if;

  select count(distinct customer_id) into v_buyers
  from public.group_deal_commitments where group_deal_id=p_group_deal_id and status='qualified';
  v_price:=private.group_deal_price(p_group_deal_id,v_buyers);
  select buyer_threshold,customer_unit_price into v_next_threshold,v_next_price
  from public.group_deal_tiers
  where group_deal_id=p_group_deal_id and buyer_threshold>v_buyers
  order by buyer_threshold limit 1;

  update private.group_security_events set decision=case when v_circle_members>=v_deal.min_group_size then 'accepted' else 'forming' end,
    metadata=jsonb_build_object('quantity',p_quantity,'community_buyers',v_buyers,'circle_members',v_circle_members,'minimum_circle_size',v_deal.min_group_size)
  where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='group_join');

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'group_deal_commitment_qualified','group_deal',p_group_deal_id,
    jsonb_build_object('quantity',p_quantity,'circle_id',v_circle,'community_buyers',v_buyers));

  return query select true,
    case when v_circle_members>=v_deal.min_group_size then 'Commitment qualified.' else 'Circle is forming; it will count after at least 5 active people join.' end,
    v_commitment,v_circle,v_circle_members,v_circle_target,
    v_buyers,v_price,v_next_threshold,v_next_price,
    case when v_next_threshold is null then 0 else greatest(v_next_threshold-v_buyers,0)::integer end;
end $$;
revoke all on function public.join_group_deal(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.join_group_deal(uuid,integer) to authenticated;

create or replace function public.leave_group_deal(p_group_deal_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_deal_status text;
  v_min_group_size integer;
  v_circle uuid;
  v_remaining integer;
  v_target integer;
  v_changed integer;
  v_cancellations integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select status,min_group_size into v_deal_status,v_min_group_size from public.group_deals where id=p_group_deal_id for update;
  if v_deal_status<>'open' then return 'This deal is already locked; contact Operations for a correction.'; end if;
  select circle_id into v_circle from public.group_deal_commitments
    where group_deal_id=p_group_deal_id and customer_id=v_user and status in ('forming','qualified') for update;

  update public.group_deal_commitments
  set status='cancelled',cancelled_at=now(),cancellation_reason='customer_withdrew'
  where group_deal_id=p_group_deal_id and customer_id=v_user and status in ('forming','qualified');
  get diagnostics v_changed=row_count;
  if v_changed=0 then return 'No active commitment found.'; end if;

  if v_circle is not null then
    select count(*),c.target_size into v_remaining,v_target
    from public.group_circles c
    left join public.group_deal_commitments gc on gc.circle_id=c.id and gc.status in ('forming','qualified')
    where c.id=v_circle
    group by c.id,c.target_size;
    if coalesce(v_remaining,0)<v_min_group_size then
      update public.group_deal_commitments set status='forming'
      where circle_id=v_circle and status='qualified';
    end if;
    if coalesce(v_remaining,0)<coalesce(v_target,0) then
      update public.group_circles set closed_at=null where id=v_circle;
    end if;
  end if;

  insert into private.group_security_events(user_id,group_deal_id,event_type,decision)
  values(v_user,p_group_deal_id,'group_leave','accepted');

  select count(*) into v_cancellations
  from private.group_security_events
  where user_id=v_user and event_type='group_leave' and created_at>now()-interval '30 days';
  if v_cancellations>=3 then
    insert into private.customer_risk_profiles(user_id,risk_score)
    values(v_user,25)
    on conflict(user_id) do update set
      risk_score=least(100,private.customer_risk_profiles.risk_score+5),
      updated_at=now();
  end if;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'group_deal_commitment_cancelled','group_deal',p_group_deal_id,'{}'::jsonb);
  return 'Group Deal commitment cancelled.';
end $$;
revoke all on function public.leave_group_deal(uuid) from public,anon,authenticated,service_role;
grant execute on function public.leave_group_deal(uuid) to authenticated;

create or replace function public.get_my_group_deals()
returns table(
  deal_id uuid,
  title text,
  product_id uuid,
  product_name text,
  brand text,
  package_size text,
  unit text,
  image_url text,
  market_price numeric,
  status text,
  closes_at timestamptz,
  pickup_at timestamptz,
  buyer_count bigint,
  total_units bigint,
  current_price numeric,
  current_threshold integer,
  next_threshold integer,
  next_price numeric,
  buyers_needed integer,
  my_quantity integer,
  circle_members bigint,
  circle_target integer,
  location_verified boolean
)
language sql stable security definer set search_path='' as $$
  with viewer as (
    select p.id,p.community_id,
      private.has_valid_group_location(p.id,p.community_id) as location_verified
    from public.profiles p where p.id=auth.uid() and p.onboarding_completed_at is not null
  )
  select
    d.id,d.title,pr.id,pr.name,pr.brand,pr.package_size,pr.unit,pr.image_url,d.market_price_snapshot,
    d.status,d.closes_at,d.pickup_at,
    stats.buyers,stats.units,
    coalesce(d.locked_unit_price,private.group_deal_price(d.id,stats.buyers)) as current_price,
    (select max(t.buyer_threshold) from public.group_deal_tiers t where t.group_deal_id=d.id and t.buyer_threshold<=stats.buyers) as current_threshold,
    nexttier.buyer_threshold,nexttier.customer_unit_price,
    case when nexttier.buyer_threshold is null then 0 else greatest(nexttier.buyer_threshold-stats.buyers,0)::integer end,
    mine.quantity,
    coalesce(circle_stats.members,0),
    circle_stats.target_size,
    v.location_verified
  from viewer v
  join public.group_deal_communities dc on dc.community_id=v.community_id
  join public.group_deals d on d.id=dc.group_deal_id
  join public.products pr on pr.id=d.product_id
  left join lateral (
    select count(distinct gc.customer_id)::bigint as buyers,coalesce(sum(gc.quantity),0)::bigint as units
    from public.group_deal_commitments gc
    where gc.group_deal_id=d.id and gc.status in ('qualified','fulfilled')
  ) stats on true
  left join lateral (
    select gc.quantity,gc.circle_id from public.group_deal_commitments gc
    where gc.group_deal_id=d.id and gc.customer_id=v.id and gc.status in ('forming','qualified','fulfilled')
    limit 1
  ) mine on true
  left join lateral (
    select count(*)::bigint as members,c.target_size
    from public.group_circles c
    left join public.group_deal_commitments gc on gc.circle_id=c.id and gc.status in ('forming','qualified')
    where c.id=mine.circle_id
    group by c.id,c.target_size
  ) circle_stats on true
  left join lateral (
    select t.buyer_threshold,t.customer_unit_price
    from public.group_deal_tiers t
    where t.group_deal_id=d.id and t.buyer_threshold>stats.buyers
    order by t.buyer_threshold limit 1
  ) nexttier on true
  where d.status in ('open','locked','procurement','fulfilling')
    and (d.status<>'open' or now()>=d.opens_at)
  order by case when d.status='open' then 0 else 1 end,d.closes_at,d.created_at desc;
$$;
revoke all on function public.get_my_group_deals() from public,anon,authenticated,service_role;
grant execute on function public.get_my_group_deals() to authenticated;

create or replace function public.admin_create_group_deal(
  p_product_id uuid,
  p_title text,
  p_market_price numeric,
  p_opens_at timestamptz,
  p_closes_at timestamptz,
  p_pickup_at timestamptz,
  p_min_group_size integer,
  p_circle_capacity integer,
  p_max_quantity integer,
  p_community_ids uuid[],
  p_tiers jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_deal uuid;
  v_community uuid;
  r record;
  v_prev_price numeric;
  v_has_min boolean:=false;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if p_product_id is null or nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'Product and title are required'; end if;
  if p_market_price is null or p_market_price<=0 then raise exception 'Market price must be positive'; end if;
  if p_min_group_size is null or p_min_group_size<5 then raise exception 'Minimum group size cannot be below 5'; end if;
  if p_circle_capacity not in (5,10) or p_circle_capacity<p_min_group_size then raise exception 'Circle capacity must be 5 or 10 and not below minimum group size'; end if;
  if p_max_quantity is null or p_max_quantity<1 or p_max_quantity>100 then raise exception 'Invalid per-buyer quantity limit'; end if;
  if p_opens_at is null or p_closes_at is null or p_pickup_at is null or p_closes_at<=p_opens_at or p_pickup_at<=p_closes_at then
    raise exception 'Use a valid open, close and pickup timeline';
  end if;
  if coalesce(array_length(p_community_ids,1),0)=0 then raise exception 'Choose at least one community'; end if;
  if jsonb_typeof(p_tiers)<>'array' or jsonb_array_length(p_tiers)=0 then raise exception 'Add at least one price tier'; end if;

  for r in
    select (x->>'threshold')::integer as threshold,(x->>'price')::numeric as price
    from jsonb_array_elements(p_tiers) x order by (x->>'threshold')::integer
  loop
    if r.threshold<p_min_group_size or r.price<=0 or r.price>p_market_price then
      raise exception 'Every tier must meet the minimum group size and stay at/below market price';
    end if;
    if r.threshold=p_min_group_size then v_has_min:=true; end if;
    if v_prev_price is not null and r.price>v_prev_price then
      raise exception 'Price cannot increase as the buyer threshold grows';
    end if;
    v_prev_price:=r.price;
  end loop;
  if not v_has_min then raise exception 'The first unlock must include the minimum group size'; end if;

  insert into public.group_deals(
    product_id,title,market_price_snapshot,opens_at,closes_at,pickup_at,
    min_group_size,circle_capacity,max_quantity_per_buyer,created_by
  ) values(
    p_product_id,btrim(p_title),p_market_price,p_opens_at,p_closes_at,p_pickup_at,
    p_min_group_size,p_circle_capacity,p_max_quantity,v_user
  ) returning id into v_deal;

  foreach v_community in array p_community_ids loop
    if not exists(select 1 from public.communities c where c.id=v_community and c.active) then
      raise exception 'An inactive/unknown community was selected';
    end if;
    insert into public.group_deal_communities(group_deal_id,community_id) values(v_deal,v_community);
  end loop;

  insert into public.group_deal_tiers(group_deal_id,buyer_threshold,customer_unit_price)
  select v_deal,(x->>'threshold')::integer,(x->>'price')::numeric
  from jsonb_array_elements(p_tiers) x;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'group_deal_created','group_deal',v_deal,
    jsonb_build_object('communities',array_length(p_community_ids,1),'tiers',jsonb_array_length(p_tiers)));

  return v_deal;
end $$;
revoke all on function public.admin_create_group_deal(uuid,text,numeric,timestamptz,timestamptz,timestamptz,integer,integer,integer,uuid[],jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_create_group_deal(uuid,text,numeric,timestamptz,timestamptz,timestamptz,integer,integer,integer,uuid[],jsonb) to authenticated;

create or replace function public.admin_set_group_deal_status(
  p_group_deal_id uuid,
  p_status text,
  p_reason text default null
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_deal public.group_deals%rowtype;
  v_buyers bigint;
  v_units bigint;
  v_price numeric;
  v_allowed boolean:=false;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  select * into v_deal from public.group_deals where id=p_group_deal_id for update;
  if not found then raise exception 'Group Deal not found'; end if;

  v_allowed:=(v_deal.status='draft' and p_status in ('open','cancelled'))
    or (v_deal.status='open' and p_status in ('locked','cancelled'))
    or (v_deal.status='locked' and p_status in ('procurement','cancelled'))
    or (v_deal.status='procurement' and p_status in ('fulfilling','cancelled'))
    or (v_deal.status='fulfilling' and p_status in ('completed','cancelled'));
  if not v_allowed then raise exception 'Invalid Group Deal transition: % -> %',v_deal.status,p_status; end if;

  if p_status='open' then
    if v_deal.closes_at<=now() then raise exception 'Close time must still be in the future'; end if;
    if not exists(select 1 from public.group_deal_communities where group_deal_id=p_group_deal_id) then raise exception 'Add a community first'; end if;
    if not exists(select 1 from public.group_deal_tiers where group_deal_id=p_group_deal_id and buyer_threshold=v_deal.min_group_size) then
      raise exception 'Minimum unlock tier is missing';
    end if;
  elsif p_status='locked' then
    select count(distinct customer_id),coalesce(sum(quantity),0)
      into v_buyers,v_units
    from public.group_deal_commitments where group_deal_id=p_group_deal_id and status='qualified';
    if v_buyers<v_deal.min_group_size then raise exception 'At least % qualified buyers are required to lock this deal',v_deal.min_group_size; end if;
    v_price:=private.group_deal_price(p_group_deal_id,v_buyers);
    if v_price is null then raise exception 'No unlocked price exists for the qualified buyer count'; end if;
    update public.group_deals set
      status='locked',locked_buyer_count=v_buyers,locked_unit_quantity=v_units,
      locked_unit_price=v_price,locked_at=now()
    where id=p_group_deal_id;
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(v_user,'group_deal_locked','group_deal',p_group_deal_id,
      jsonb_build_object('qualified_buyers',v_buyers,'units',v_units,'locked_price',v_price));
    return;
  end if;

  update public.group_deals
  set status=p_status,
      cancellation_reason=case when p_status='cancelled' then nullif(btrim(coalesce(p_reason,'')),'') else cancellation_reason end
  where id=p_group_deal_id;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'group_deal_status_changed','group_deal',p_group_deal_id,
    jsonb_build_object('from',v_deal.status,'to',p_status,'reason',p_reason));
end $$;
revoke all on function public.admin_set_group_deal_status(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_set_group_deal_status(uuid,text,text) to authenticated;

create or replace function public.admin_link_supplier_account(
  p_supplier_id uuid,p_user_id uuid,p_role text
)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if p_role not in ('owner','manager','analyst') then raise exception 'Invalid supplier role'; end if;
  if not exists(select 1 from public.suppliers where id=p_supplier_id and active) then raise exception 'Supplier is inactive or missing'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
  insert into public.supplier_memberships(supplier_id,user_id,role,active)
  values(p_supplier_id,p_user_id,p_role,true)
  on conflict(supplier_id,user_id) do update set role=excluded.role,active=true;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supplier_account_linked','supplier',p_supplier_id,jsonb_build_object('user_id',p_user_id,'role',p_role));
end $$;
revoke all on function public.admin_link_supplier_account(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_link_supplier_account(uuid,uuid,text) to authenticated;

create or replace function public.admin_link_supplier_product(
  p_supplier_id uuid,p_product_id uuid,p_relationship_type text,p_supplier_sku text default null
)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if p_relationship_type not in ('manufacturer','distributor','supplier','vendor') then raise exception 'Invalid supplier relationship'; end if;
  if not exists(select 1 from public.suppliers where id=p_supplier_id and active) then raise exception 'Supplier is inactive or missing'; end if;
  if not exists(select 1 from public.products where id=p_product_id and active) then raise exception 'Product is inactive or missing'; end if;
  insert into public.supplier_products(supplier_id,product_id,relationship_type,supplier_sku,active)
  values(p_supplier_id,p_product_id,p_relationship_type,nullif(btrim(coalesce(p_supplier_sku,'')),''),true)
  on conflict(supplier_id,product_id) do update set
    relationship_type=excluded.relationship_type,supplier_sku=excluded.supplier_sku,active=true,updated_at=now();
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supplier_product_linked','supplier',p_supplier_id,
    jsonb_build_object('product_id',p_product_id,'relationship_type',p_relationship_type));
end $$;
revoke all on function public.admin_link_supplier_product(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_link_supplier_product(uuid,uuid,text,text) to authenticated;

create or replace function public.get_my_supplier_context()
returns table(supplier_id uuid,business_name text,member_role text)
language sql stable security definer set search_path='' as $$
  select s.id,s.business_name,sm.role
  from public.supplier_memberships sm
  join public.suppliers s on s.id=sm.supplier_id
  where sm.user_id=auth.uid() and sm.active and s.active
  order by s.business_name;
$$;
revoke all on function public.get_my_supplier_context() from public,anon,authenticated,service_role;
grant execute on function public.get_my_supplier_context() to authenticated;

create or replace function public.get_supplier_demand_summary(p_days integer default 7)
returns table(
  supplier_id uuid,
  business_name text,
  demand_date date,
  product_id uuid,
  product_name text,
  sku text,
  pool_required_units bigint,
  group_required_units bigint,
  sold_units bigint
)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_days integer:=greatest(1,least(coalesce(p_days,7),90));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.supplier_memberships where user_id=v_user and active) then raise exception 'Supplier access required'; end if;
  return query
  with days as (
    select generate_series(current_date-(v_days-1),current_date,interval '1 day')::date as day
  ),
  allowed as (
    select sm.supplier_id,s.business_name,sp.product_id,p.name,p.sku
    from public.supplier_memberships sm
    join public.suppliers s on s.id=sm.supplier_id and s.active
    join public.supplier_products sp on sp.supplier_id=sm.supplier_id and sp.active
    join public.products p on p.id=sp.product_id and p.active
    where sm.user_id=v_user and sm.active
  )
  select a.supplier_id,a.business_name,d.day,a.product_id,a.name,a.sku,
    coalesce((
      select sum(c.quantity)::bigint
      from public.commitments c
      join public.pool_items pi on pi.id=c.pool_item_id
      join public.pools po on po.id=pi.pool_id
      where pi.product_id=a.product_id and c.status in ('active','confirmed')
        and po.status<>'cancelled' and c.committed_at::date=d.day
    ),0)::bigint,
    coalesce((
      select sum(gc.quantity)::bigint
      from public.group_deal_commitments gc
      join public.group_deals gd on gd.id=gc.group_deal_id
      where gd.product_id=a.product_id and gc.status in ('qualified','fulfilled')
        and gd.status<>'cancelled' and gc.qualified_at::date=d.day
    ),0)::bigint,
    coalesce((
      select sum(oi.quantity)::bigint
      from public.order_items oi
      join public.orders o on o.id=oi.order_id
      where oi.product_id=a.product_id and o.status<>'cancelled' and o.created_at::date=d.day
    ),0)::bigint
  from allowed a cross join days d
  order by a.business_name,a.name,d.day desc;
end $$;
revoke all on function public.get_supplier_demand_summary(integer) from public,anon,authenticated,service_role;
grant execute on function public.get_supplier_demand_summary(integer) to authenticated;

create or replace function public.get_supplier_open_demand()
returns table(
  supplier_id uuid,
  demand_source text,
  reference_id uuid,
  title text,
  product_name text,
  sku text,
  buyer_count bigint,
  required_units bigint,
  closes_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.supplier_memberships where user_id=v_user and active) then raise exception 'Supplier access required'; end if;
  return query
  with allowed as (
    select sm.supplier_id,sp.product_id,p.name,p.sku
    from public.supplier_memberships sm
    join public.supplier_products sp on sp.supplier_id=sm.supplier_id and sp.active
    join public.products p on p.id=sp.product_id and p.active
    join public.suppliers s on s.id=sm.supplier_id and s.active
    where sm.user_id=v_user and sm.active
  )
  select a.supplier_id,'pool'::text,po.id,po.title,a.name,a.sku,
    count(distinct c.customer_id)::bigint,coalesce(sum(c.quantity),0)::bigint,po.commitment_closes_at
  from allowed a
  join public.pool_items pi on pi.product_id=a.product_id and pi.active
  join public.pools po on po.id=pi.pool_id and po.status='open'
  join public.commitments c on c.pool_item_id=pi.id and c.status in ('active','confirmed')
  group by a.supplier_id,po.id,po.title,a.name,a.sku,po.commitment_closes_at
  having count(distinct c.customer_id)>=5

  union all

  select a.supplier_id,'group_deal'::text,gd.id,gd.title,a.name,a.sku,
    count(distinct gc.customer_id)::bigint,coalesce(sum(gc.quantity),0)::bigint,gd.closes_at
  from allowed a
  join public.group_deals gd on gd.product_id=a.product_id and gd.status='open'
  join public.group_deal_commitments gc on gc.group_deal_id=gd.id and gc.status='qualified'
  group by a.supplier_id,gd.id,gd.title,a.name,a.sku,gd.closes_at
  having count(distinct gc.customer_id)>=5

  order by closes_at;
end $$;
revoke all on function public.get_supplier_open_demand() from public,anon,authenticated,service_role;
grant execute on function public.get_supplier_open_demand() to authenticated;

create or replace function private.update_group_trust_after_order()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    insert into private.customer_risk_profiles(user_id,risk_score,trust_level,completed_orders,updated_at)
    values(new.customer_id,15,'new',1,now())
    on conflict(user_id) do update set
      completed_orders=private.customer_risk_profiles.completed_orders+1,
      risk_score=greatest(0,private.customer_risk_profiles.risk_score-5),
      trust_level=case
        when private.customer_risk_profiles.trust_level='blocked' then 'blocked'
        when private.customer_risk_profiles.completed_orders+1>=2 and private.customer_risk_profiles.risk_score<50 then 'trusted'
        else private.customer_risk_profiles.trust_level
      end,
      updated_at=now();
  end if;
  return new;
end $$;
revoke all on function private.update_group_trust_after_order() from public,anon,authenticated,service_role;

drop trigger if exists orders_group_trust_refresh on public.orders;
create trigger orders_group_trust_refresh
after update of status on public.orders
for each row when (new.status='completed' and old.status is distinct from 'completed')
execute function private.update_group_trust_after_order();

-- Future objects stay fail-closed.
alter default privileges for role postgres in schema public
  revoke select,insert,update,delete on tables from anon,authenticated,service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema private
  revoke execute on functions from public,anon,authenticated,service_role;
