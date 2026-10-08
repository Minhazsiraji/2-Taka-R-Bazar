-- Fix PL/pgSQL output-parameter/column name ambiguity in join_group_deal.
-- Fully qualify commitment columns so circle_id cannot resolve to the RETURNS TABLE output field.

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

  select gc.id,gc.circle_id,gc.status into v_commitment,v_circle,v_existing_status
  from public.group_deal_commitments gc
  where gc.group_deal_id=p_group_deal_id and gc.customer_id=v_user
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
  select count(*) into v_circle_members
  from public.group_deal_commitments gc
  where gc.circle_id=v_circle and gc.status in ('forming','qualified');
  if v_circle_members>=v_deal.min_group_size then
    update public.group_deal_commitments gc
    set status='qualified',qualified_at=now()
    where gc.circle_id=v_circle and gc.status='forming';
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
