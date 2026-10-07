-- Runtime hardening for desktop geolocation UAT and supplier demand ordering.
-- Normal GPS remains the only location proof accepted for live/non-demo Group Deals.

alter table private.customer_location_verifications
  add column if not exists verification_scope text not null default 'all';

do $$ begin
  if not exists(select 1 from pg_constraint where conname='customer_location_verification_scope_check') then
    alter table private.customer_location_verifications
      add constraint customer_location_verification_scope_check
      check(verification_scope in ('all','demo_only'));
  end if;
end $$;

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
    user_id,community_id,location,accuracy_m,distance_m,verification_method,verification_scope,verified_at,expires_at
  )
  values(v_user,v_community,v_point,p_accuracy_m,v_distance,'gps-community','all',now(),v_expiry)
  on conflict(user_id) do update set
    community_id=excluded.community_id,location=excluded.location,accuracy_m=excluded.accuracy_m,
    distance_m=excluded.distance_m,verification_method='gps-community',verification_scope='all',verified_at=excluded.verified_at,expires_at=excluded.expires_at;

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

create or replace function public.admin_verify_my_uat_location()
returns table(
  verified boolean,
  community_name text,
  expires_at timestamptz,
  reason text
)
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_community uuid;
  v_name text;
  v_lat numeric;
  v_lng numeric;
  v_point extensions.geography(Point,4326);
  v_expiry timestamptz;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;

  select p.community_id,c.name,c.center_latitude,c.center_longitude
    into v_community,v_name,v_lat,v_lng
  from public.profiles p
  join public.communities c on c.id=p.community_id
  where p.id=v_user and p.onboarding_completed_at is not null
    and c.active and c.location_matching_enabled;

  if v_community is null or v_lat is null or v_lng is null then
    return query select false,coalesce(v_name,'Unknown community'),null::timestamptz,
      'Community UAT location is not configured.';
    return;
  end if;

  if not exists(
    select 1
    from public.group_deals d
    join public.group_deal_communities dc on dc.group_deal_id=d.id
    join public.products p on p.id=d.product_id
    where dc.community_id=v_community
      and d.status='open' and now()>=d.opens_at and now()<d.closes_at
      and p.is_demo
  ) then
    return query select false,v_name,null::timestamptz,
      'No open demo Group Deal is available for UAT.';
    return;
  end if;

  v_point:=extensions.st_setsrid(extensions.st_makepoint(v_lng,v_lat),4326)::extensions.geography;
  v_expiry:=now()+interval '30 minutes';

  insert into private.customer_location_verifications(
    user_id,community_id,location,accuracy_m,distance_m,
    verification_method,verification_scope,verified_at,expires_at
  )
  values(
    v_user,v_community,v_point,1,0,
    'admin-uat-preview','demo_only',now(),v_expiry
  )
  on conflict(user_id) do update set
    community_id=excluded.community_id,
    location=excluded.location,
    accuracy_m=excluded.accuracy_m,
    distance_m=excluded.distance_m,
    verification_method=excluded.verification_method,
    verification_scope=excluded.verification_scope,
    verified_at=excluded.verified_at,
    expires_at=excluded.expires_at;

  insert into private.group_security_events(user_id,event_type,decision,metadata)
  values(v_user,'location_verify','admin_uat_demo_only',
    jsonb_build_object('community_id',v_community,'expires_at',v_expiry));

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'admin_uat_location_verified','community',v_community,
    jsonb_build_object('scope','demo_only','expires_at',v_expiry));

  return query select true,v_name,v_expiry,
    'Admin UAT location enabled for demo Group Deals only.';
end $$;
revoke all on function public.admin_verify_my_uat_location() from public,anon,authenticated,service_role;
grant execute on function public.admin_verify_my_uat_location() to authenticated;

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
  v_location_scope text;
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

  select location,verification_scope into v_location,v_location_scope from private.customer_location_verifications
  where user_id=v_user and community_id=v_community and expires_at>now();
  if v_location is null then
    update private.group_security_events set decision='location_required'
    where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='group_join');
    return query select false,'Verify your community location before joining a Group Deal.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
    return;
  end if;

  if v_location_scope='demo_only' and not exists(
    select 1 from public.products p where p.id=v_deal.product_id and p.is_demo
  ) then
    update private.group_security_events set decision='secure_gps_required'
    where id=(select max(id) from private.group_security_events where user_id=v_user and event_type='group_join');
    return query select false,'Secure device GPS verification is required for live Group Deals.',null::uuid,null::uuid,0::bigint,0,0::bigint,null::numeric,null::integer,null::numeric,0;
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
      and extensions.st_dwithin(gl.anchor_location,v_location,v_deal.circle_radius_m)
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
        and extensions.st_dwithin(gl.anchor_location,v_location,v_deal.circle_radius_m)
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
  ),
  combined as (
  select a.supplier_id as supplier_id,'pool'::text as demand_source,po.id as reference_id,po.title as title,a.name as product_name,a.sku as sku,
    count(distinct c.customer_id)::bigint,coalesce(sum(c.quantity),0)::bigint,po.commitment_closes_at
  from allowed a
  join public.pool_items pi on pi.product_id=a.product_id and pi.active
  join public.pools po on po.id=pi.pool_id and po.status='open'
  join public.commitments c on c.pool_item_id=pi.id and c.status in ('active','confirmed')
  group by a.supplier_id,po.id,po.title,a.name,a.sku,po.commitment_closes_at
  having count(distinct c.customer_id)>=5

  union all

  select a.supplier_id as supplier_id,'group_deal'::text as demand_source,gd.id as reference_id,gd.title as title,a.name as product_name,a.sku as sku,
    count(distinct gc.customer_id)::bigint,coalesce(sum(gc.quantity),0)::bigint,gd.closes_at
  from allowed a
  join public.group_deals gd on gd.product_id=a.product_id and gd.status='open'
  join public.group_deal_commitments gc on gc.group_deal_id=gd.id and gc.status='qualified'
  group by a.supplier_id,gd.id,gd.title,a.name,a.sku,gd.closes_at
  having count(distinct gc.customer_id)>=5
  )
  select c.supplier_id,c.demand_source,c.reference_id,c.title,c.product_name,c.sku,
         c.buyer_count,c.required_units,c.closes_at
  from combined c
  order by c.closes_at;
end $$;
revoke all on function public.get_supplier_open_demand() from public,anon,authenticated,service_role;
grant execute on function public.get_supplier_open_demand() to authenticated;
