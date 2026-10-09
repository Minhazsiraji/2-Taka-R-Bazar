-- Supply handover verification + fraud control.
-- Separation of duties: source staff dispatch, optional carrier acknowledges custody,
-- Community Ops receives, and an independent Admin resolves any variance.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.supply_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null default 'store'
    check(location_type in ('store','warehouse','hub')),
  address text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supply_location_memberships (
  location_id uuid not null references public.supply_locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'storekeeper'
    check(role in ('manager','storekeeper','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(location_id,user_id)
);

create table if not exists public.supply_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_code text not null unique default ('DSP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  source_reference text not null,
  source_kind text not null check(source_kind in ('supplier','2tbr_store')),
  source_supplier_id uuid references public.suppliers(id) on delete restrict,
  source_location_id uuid references public.supply_locations(id) on delete restrict,
  destination_community_id uuid not null references public.communities(id) on delete restrict,
  status text not null default 'draft'
    check(status in ('draft','sealed','in_transit','verified','variance','security_hold','resolved','returned','cancelled')),
  package_count integer check(package_count is null or package_count>0),
  seal_reference text,
  carrier_user_id uuid references auth.users(id) on delete set null,
  carrier_acknowledged_at timestamptz,
  authorized_by uuid references auth.users(id) on delete set null,
  authorized_at timestamptz,
  authorization_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  sealed_by uuid references auth.users(id) on delete set null,
  sealed_at timestamptz,
  received_by uuid references auth.users(id) on delete set null,
  received_at timestamptz,
  observed_package_count integer check(observed_package_count is null or observed_package_count>=0),
  observed_seal_reference text,
  receiver_note text,
  variance_reason text,
  resolution text,
  resolution_reason text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(
    (source_kind='supplier' and source_supplier_id is not null and source_location_id is null)
    or
    (source_kind='2tbr_store' and source_location_id is not null and source_supplier_id is null)
  )
);

create table if not exists public.supply_dispatch_items (
  dispatch_id uuid not null references public.supply_dispatches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  dispatched_quantity integer not null check(dispatched_quantity between 1 and 100000),
  created_at timestamptz not null default now(),
  primary key(dispatch_id,product_id)
);

create table if not exists public.supply_dispatch_receipts (
  dispatch_id uuid not null references public.supply_dispatches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  received_quantity integer not null check(received_quantity>=0),
  damaged_quantity integer not null default 0 check(damaged_quantity>=0),
  returned_quantity integer not null default 0 check(returned_quantity>=0),
  net_accepted_quantity integer generated always as (received_quantity-damaged_quantity-returned_quantity) stored,
  created_at timestamptz not null default now(),
  primary key(dispatch_id,product_id),
  check(damaged_quantity+returned_quantity<=received_quantity)
);

create table if not exists public.supply_chain_events (
  id bigint generated always as identity primary key,
  dispatch_id uuid not null references public.supply_dispatches(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.supply_dispatch_secrets (
  dispatch_id uuid primary key references public.supply_dispatches(id) on delete cascade,
  code_hash bytea not null,
  expires_at timestamptz not null,
  failed_attempts integer not null default 0 check(failed_attempts>=0),
  consumed_at timestamptz,
  last_attempt_at timestamptz,
  issued_at timestamptz not null default now()
);

create table if not exists private.supply_fraud_events (
  id bigint generated always as identity primary key,
  dispatch_id uuid references public.supply_dispatches(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null check(severity in ('low','medium','high','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.supply_actor_risk_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  risk_score integer not null default 0 check(risk_score between 0 and 100),
  failed_code_attempts integer not null default 0 check(failed_code_attempts>=0),
  confirmed_variances integer not null default 0 check(confirmed_variances>=0),
  fraud_holds integer not null default 0 check(fraud_holds>=0),
  trust_level text not null default 'new'
    check(trust_level in ('new','trusted','watch','restricted','blocked')),
  updated_at timestamptz not null default now()
);

alter table public.community_ops_inbound
  add column if not exists source_dispatch_id uuid references public.supply_dispatches(id) on delete restrict;
create unique index if not exists community_ops_inbound_dispatch_product_uniq
  on public.community_ops_inbound(source_dispatch_id,product_id)
  where source_dispatch_id is not null;

create index if not exists supply_location_memberships_user_idx
  on public.supply_location_memberships(user_id,active);
create index if not exists supply_dispatch_destination_status_idx
  on public.supply_dispatches(destination_community_id,status,created_at desc);
create unique index if not exists supply_dispatch_supplier_reference_uniq
  on public.supply_dispatches(source_supplier_id,lower(source_reference))
  where source_kind='supplier';
create unique index if not exists supply_dispatch_location_reference_uniq
  on public.supply_dispatches(source_location_id,lower(source_reference))
  where source_kind='2tbr_store';
create index if not exists supply_dispatch_source_supplier_idx
  on public.supply_dispatches(source_supplier_id,status,created_at desc) where source_supplier_id is not null;
create index if not exists supply_dispatch_source_location_idx
  on public.supply_dispatches(source_location_id,status,created_at desc) where source_location_id is not null;
create index if not exists supply_chain_events_dispatch_idx
  on public.supply_chain_events(dispatch_id,created_at);
create index if not exists supply_fraud_events_time_idx
  on private.supply_fraud_events(created_at desc,severity);

alter table public.supply_locations enable row level security;
alter table public.supply_location_memberships enable row level security;
alter table public.supply_dispatches enable row level security;
alter table public.supply_dispatch_items enable row level security;
alter table public.supply_dispatch_receipts enable row level security;
alter table public.supply_chain_events enable row level security;

revoke all on public.supply_locations,public.supply_location_memberships,public.supply_dispatches,
  public.supply_dispatch_items,public.supply_dispatch_receipts,public.supply_chain_events
  from anon,authenticated,service_role;
revoke all on private.supply_dispatch_secrets,private.supply_fraud_events,private.supply_actor_risk_profiles
  from public,anon,authenticated,service_role;

create trigger supply_locations_touch before update on public.supply_locations
for each row execute function private.touch_updated_at();
create trigger supply_dispatches_touch before update on public.supply_dispatches
for each row execute function private.touch_updated_at();

create or replace function private.can_manage_supply_source(p_user uuid,p_kind text,p_source uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
  select p_user is not null and (
    (
      p_kind='supplier' and exists(
        select 1 from public.supplier_memberships sm
        join public.suppliers s on s.id=sm.supplier_id
        where sm.user_id=p_user and sm.supplier_id=p_source and sm.active and s.active
          and sm.role in ('owner','manager')
      )
    )
    or (
      p_kind='2tbr_store' and exists(
        select 1 from public.supply_location_memberships lm
        join public.supply_locations l on l.id=lm.location_id
        where lm.user_id=p_user and lm.location_id=p_source and lm.active and l.active
          and lm.role in ('manager','storekeeper')
      )
    )
  );
$fn$;
revoke all on function private.can_manage_supply_source(uuid,text,uuid) from public,anon,authenticated,service_role;

create or replace function private.can_view_supply_source(p_user uuid,p_kind text,p_source uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
  select p_user is not null and (
    private.is_ops(p_user)
    or (
      p_kind='supplier' and private.is_supplier_member(p_user,p_source)
    )
    or (
      p_kind='2tbr_store' and exists(
        select 1 from public.supply_location_memberships lm
        join public.supply_locations l on l.id=lm.location_id
        where lm.user_id=p_user and lm.location_id=p_source and lm.active and l.active
      )
    )
  );
$fn$;
revoke all on function private.can_view_supply_source(uuid,text,uuid) from public,anon,authenticated,service_role;

create or replace function private.supply_source_name(p_kind text,p_supplier uuid,p_location uuid)
returns text language sql stable security definer set search_path='' as $fn$
  select case
    when p_kind='supplier' then (select s.business_name from public.suppliers s where s.id=p_supplier)
    else (select l.name from public.supply_locations l where l.id=p_location)
  end;
$fn$;
revoke all on function private.supply_source_name(text,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.raise_supply_risk(
  p_user uuid,p_points integer,p_event_type text,p_dispatch uuid,p_meta jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_score integer;
begin
  if p_user is null then return; end if;
  insert into private.supply_actor_risk_profiles(
    user_id,risk_score,failed_code_attempts,confirmed_variances,fraud_holds,trust_level,updated_at
  )
  values(
    p_user,greatest(0,least(coalesce(p_points,0),100)),
    case when p_event_type='handover_code_failed' then 1 else 0 end,
    case when p_event_type='confirmed_variance' then 1 else 0 end,
    case when p_event_type='fraud_hold' then 1 else 0 end,
    case when coalesce(p_points,0)>=70 then 'restricted' when coalesce(p_points,0)>=40 then 'watch' else 'new' end,
    now()
  )
  on conflict(user_id) do update set
    risk_score=least(100,private.supply_actor_risk_profiles.risk_score+greatest(0,coalesce(p_points,0))),
    failed_code_attempts=private.supply_actor_risk_profiles.failed_code_attempts+
      case when p_event_type='handover_code_failed' then 1 else 0 end,
    confirmed_variances=private.supply_actor_risk_profiles.confirmed_variances+
      case when p_event_type='confirmed_variance' then 1 else 0 end,
    fraud_holds=private.supply_actor_risk_profiles.fraud_holds+
      case when p_event_type='fraud_hold' then 1 else 0 end,
    updated_at=now();
  select risk_score into v_score from private.supply_actor_risk_profiles where user_id=p_user;
  update private.supply_actor_risk_profiles set
    trust_level=case
      when v_score>=90 then 'blocked'
      when v_score>=70 then 'restricted'
      when v_score>=40 then 'watch'
      when private.supply_actor_risk_profiles.trust_level='trusted' and v_score<=10 then 'trusted'
      else 'new'
    end
  where user_id=p_user;
  insert into private.supply_fraud_events(dispatch_id,actor_user_id,event_type,severity,metadata)
  values(p_dispatch,p_user,p_event_type,
    case when coalesce(p_points,0)>=25 then 'critical'
         when coalesce(p_points,0)>=15 then 'high'
         when coalesce(p_points,0)>=5 then 'medium'
         else 'low' end,
    coalesce(p_meta,'{}'::jsonb));
end;
$fn$;
revoke all on function private.raise_supply_risk(uuid,integer,text,uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function private.notify_supply_admins(
  p_kind text,p_title text,p_body text,p_href text,p_key text
)
returns void language plpgsql security definer set search_path='' as $fn$
declare r record;
begin
  for r in
    select distinct ur.user_id from public.user_roles ur where ur.role in ('admin','super_admin')
  loop
    perform private.enqueue_notification(r.user_id,p_kind,p_title,p_body,p_href,p_key||':'||r.user_id::text,'high',null,null);
  end loop;
end;
$fn$;
revoke all on function private.notify_supply_admins(text,text,text,text,text) from public,anon,authenticated,service_role;

create or replace function public.admin_create_supply_location(
  p_name text,p_location_type text,p_address text default null
)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Location name is required'; end if;
  if p_location_type not in ('store','warehouse','hub') then raise exception 'Invalid location type'; end if;
  insert into public.supply_locations(name,location_type,address,created_by)
  values(btrim(p_name),p_location_type,nullif(btrim(coalesce(p_address,'')),''),v_user)
  returning id into v_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_location_created','supply_location',v_id,jsonb_build_object('type',p_location_type));
  return v_id;
end;
$fn$;
revoke all on function public.admin_create_supply_location(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_create_supply_location(text,text,text) to authenticated;

create or replace function public.admin_assign_supply_location_member(
  p_location_id uuid,p_user_id uuid,p_role text
)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid();
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if p_role not in ('manager','storekeeper','viewer') then raise exception 'Invalid location member role'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'User profile not found'; end if;
  if not exists(select 1 from public.supply_locations where id=p_location_id and active) then raise exception 'Supply location not found or inactive'; end if;
  insert into public.supply_location_memberships(location_id,user_id,role,active)
  values(p_location_id,p_user_id,p_role,true)
  on conflict(location_id,user_id) do update set role=excluded.role,active=true;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_location_member_assigned','supply_location',p_location_id,
    jsonb_build_object('user_id',p_user_id,'role',p_role));
end;
$fn$;
revoke all on function public.admin_assign_supply_location_member(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_assign_supply_location_member(uuid,uuid,text) to authenticated;

create or replace function public.get_my_supply_sources()
returns table(source_kind text,source_id uuid,source_name text,member_role text)
language sql stable security definer set search_path='' as $fn$
  select 'supplier'::text,s.id,s.business_name,sm.role
  from public.supplier_memberships sm
  join public.suppliers s on s.id=sm.supplier_id
  where sm.user_id=auth.uid() and sm.active and s.active
  union all
  select '2tbr_store'::text,l.id,l.name,lm.role
  from public.supply_location_memberships lm
  join public.supply_locations l on l.id=lm.location_id
  where lm.user_id=auth.uid() and lm.active and l.active
  order by 3;
$fn$;
revoke all on function public.get_my_supply_sources() from public,anon,authenticated,service_role;
grant execute on function public.get_my_supply_sources() to authenticated;

create or replace function public.get_supply_source_products(p_source_kind text,p_source_id uuid)
returns table(product_id uuid,product_name text,brand text,package_size text,sku text)
language plpgsql stable security definer set search_path='' as $fn$
begin
  if not private.can_view_supply_source(auth.uid(),p_source_kind,p_source_id) then raise exception 'Supply source access required'; end if;
  if p_source_kind='supplier' then
    return query
    select p.id,p.name,p.brand,p.package_size,p.sku
    from public.supplier_products sp join public.products p on p.id=sp.product_id
    where sp.supplier_id=p_source_id and sp.active and p.active
    order by p.name;
  elsif p_source_kind='2tbr_store' then
    return query
    select p.id,p.name,p.brand,p.package_size,p.sku from public.products p where p.active order by p.name;
  else
    raise exception 'Invalid source type';
  end if;
end;
$fn$;
revoke all on function public.get_supply_source_products(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_supply_source_products(text,uuid) to authenticated;

create or replace function public.create_supply_dispatch(
  p_source_kind text,p_source_id uuid,p_source_reference text,p_destination_community_id uuid,p_items jsonb,p_notes text default null
)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid:=auth.uid(); v_id uuid; x jsonb; v_product uuid; v_qty integer;
  v_count integer:=0; v_distinct integer:=0;
begin
  if not private.can_manage_supply_source(v_user,p_source_kind,p_source_id) then raise exception 'Dispatch permission required'; end if;
  if nullif(btrim(coalesce(p_source_reference,'')),'') is null or length(btrim(p_source_reference))>120 then
    raise exception 'Source challan/invoice/transfer reference is required and must be 120 characters or fewer';
  end if;
  if (p_source_kind='supplier' and exists(
        select 1 from public.supply_dispatches where source_supplier_id=p_source_id and lower(source_reference)=lower(btrim(p_source_reference))
      ))
     or (p_source_kind='2tbr_store' and exists(
        select 1 from public.supply_dispatches where source_location_id=p_source_id and lower(source_reference)=lower(btrim(p_source_reference))
      )) then
    raise exception 'This source challan/invoice/transfer reference has already been used';
  end if;
  if not exists(select 1 from public.communities where id=p_destination_community_id and active) then raise exception 'Destination community is inactive or missing'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then
    raise exception 'Dispatch must contain 1 to 50 products';
  end if;

  insert into public.supply_dispatches(
    source_reference,source_kind,source_supplier_id,source_location_id,destination_community_id,created_by,notes
  ) values(
    btrim(p_source_reference),p_source_kind,
    case when p_source_kind='supplier' then p_source_id else null end,
    case when p_source_kind='2tbr_store' then p_source_id else null end,
    p_destination_community_id,v_user,nullif(btrim(coalesce(p_notes,'')),'')
  ) returning id into v_id;

  for x in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product=(x->>'product_id')::uuid;
      v_qty=(x->>'quantity')::integer;
    exception when others then
      raise exception 'Invalid product or quantity in dispatch';
    end;
    if v_qty<1 or v_qty>100000 then raise exception 'Dispatch quantity must be between 1 and 100000'; end if;
    if not exists(select 1 from public.products where id=v_product and active) then raise exception 'Product is inactive or missing'; end if;
    if p_source_kind='supplier' and not exists(
      select 1 from public.supplier_products where supplier_id=p_source_id and product_id=v_product and active
    ) then raise exception 'Supplier is not approved for one of the selected products'; end if;

    insert into public.supply_dispatch_items(dispatch_id,product_id,dispatched_quantity)
    values(v_id,v_product,v_qty);
    v_count:=v_count+1;
  end loop;

  select count(distinct product_id) into v_distinct from public.supply_dispatch_items where dispatch_id=v_id;
  if v_count<>v_distinct then raise exception 'Duplicate products are not allowed in one dispatch'; end if;

  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(v_id,v_user,'dispatch_created','draft',jsonb_build_object('item_count',v_count,'destination_community_id',p_destination_community_id,'source_reference',btrim(p_source_reference)));
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_dispatch_created','supply_dispatch',v_id,jsonb_build_object('source_kind',p_source_kind,'item_count',v_count));
  return v_id;
end;
$fn$;
revoke all on function public.create_supply_dispatch(text,uuid,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.create_supply_dispatch(text,uuid,text,uuid,jsonb,text) to authenticated;

create or replace function public.seal_supply_dispatch(
  p_dispatch_id uuid,p_package_count integer,p_seal_reference text default null
)
returns text language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid:=auth.uid(); d public.supply_dispatches%rowtype; v_source uuid;
  v_code text; v_risk text;
begin
  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  v_source=case when d.source_kind='supplier' then d.source_supplier_id else d.source_location_id end;
  if not private.can_manage_supply_source(v_user,d.source_kind,v_source) then raise exception 'Dispatch permission required'; end if;
  if d.status<>'draft' then raise exception 'Only a draft dispatch can be sealed'; end if;
  if d.source_kind='supplier' and d.authorized_at is null then
    raise exception 'External supplier dispatch requires Admin authorization before sealing';
  end if;
  if p_package_count is null or p_package_count<1 or p_package_count>10000 then raise exception 'Package count must be between 1 and 10000'; end if;
  if not exists(select 1 from public.supply_dispatch_items where dispatch_id=d.id) then raise exception 'Dispatch has no products'; end if;

  select trust_level into v_risk from private.supply_actor_risk_profiles where user_id=v_user;
  if v_risk in ('restricted','blocked') then
    raise exception 'Supply account is under risk review. Admin approval is required before dispatching.';
  end if;

  v_code=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
  insert into private.supply_dispatch_secrets(dispatch_id,code_hash,expires_at)
  values(d.id,extensions.digest(v_code,'sha256'),now()+interval '24 hours')
  on conflict(dispatch_id) do update set
    code_hash=excluded.code_hash,expires_at=excluded.expires_at,failed_attempts=0,consumed_at=null,last_attempt_at=null,issued_at=now();

  update public.supply_dispatches set
    status='sealed',package_count=p_package_count,seal_reference=nullif(btrim(coalesce(p_seal_reference,'')),''),
    sealed_by=v_user,sealed_at=now()
  where id=d.id;
  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(d.id,v_user,'dispatch_sealed','sealed',jsonb_build_object('package_count',p_package_count,'seal_reference',nullif(btrim(coalesce(p_seal_reference,'')),'')));
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_dispatch_sealed','supply_dispatch',d.id,jsonb_build_object('package_count',p_package_count));
  return v_code;
end;
$fn$;
revoke all on function public.seal_supply_dispatch(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.seal_supply_dispatch(uuid,integer,text) to authenticated;

create or replace function public.admin_authorize_supply_dispatch(p_dispatch_id uuid,p_note text default null)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid(); d public.supply_dispatches%rowtype; v_note text:=nullif(btrim(coalesce(p_note,'')),'');
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if d.source_kind<>'supplier' then raise exception 'Admin authorization is only required for external supplier dispatches'; end if;
  if d.status<>'draft' then raise exception 'Only a draft supplier dispatch can be authorized'; end if;
  if d.created_by=v_user or exists(
    select 1 from public.supplier_memberships sm
    where sm.supplier_id=d.source_supplier_id and sm.user_id=v_user and sm.active
  ) then
    raise exception 'Independent Admin required: dispatch creator or supplier staff cannot authorize this supplier dispatch';
  end if;
  if not exists(select 1 from public.supply_dispatch_items where dispatch_id=d.id) then raise exception 'Dispatch has no products'; end if;
  update public.supply_dispatches set authorized_by=v_user,authorized_at=now(),authorization_note=v_note where id=d.id;
  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(d.id,v_user,'supplier_dispatch_authorized','draft',jsonb_build_object('note',v_note));
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_dispatch_authorized','supply_dispatch',d.id,jsonb_build_object('note',v_note));
  perform private.enqueue_notification(d.created_by,'supply_authorized','Supplier dispatch authorized',
    d.dispatch_code||' was authorized by 2-TAKA-R-BAZAR and can now be sealed.',
    '/supply','supply:'||d.id::text||':authorized','normal',null,null);
end;
$fn$;
revoke all on function public.admin_authorize_supply_dispatch(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_authorize_supply_dispatch(uuid,text) to authenticated;

create or replace function public.admin_assign_supply_carrier(p_dispatch_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid(); d public.supply_dispatches%rowtype;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if d.status not in ('draft','sealed') then raise exception 'Carrier can only be assigned before transit begins'; end if;
  if p_user_id=d.created_by then raise exception 'Dispatch creator cannot also be the carrier'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Carrier profile not found'; end if;
  update public.supply_dispatches set carrier_user_id=p_user_id where id=p_dispatch_id;
  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(p_dispatch_id,v_user,'carrier_assigned',d.status,jsonb_build_object('carrier_user_id',p_user_id));
end;
$fn$;
revoke all on function public.admin_assign_supply_carrier(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_assign_supply_carrier(uuid,uuid) to authenticated;

create or replace function public.carrier_acknowledge_supply_dispatch(p_dispatch_id uuid)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid(); d public.supply_dispatches%rowtype;
begin
  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if d.carrier_user_id is distinct from v_user then raise exception 'You are not the assigned carrier'; end if;
  if d.created_by=v_user then raise exception 'Dispatch creator cannot acknowledge carrier custody'; end if;
  if d.status<>'sealed' then raise exception 'Only a sealed dispatch can enter transit'; end if;
  update public.supply_dispatches set status='in_transit',carrier_acknowledged_at=now() where id=d.id;
  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status)
  values(d.id,v_user,'carrier_custody_acknowledged','in_transit');
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_carrier_acknowledged','supply_dispatch',d.id,'{}'::jsonb);
end;
$fn$;
revoke all on function public.carrier_acknowledge_supply_dispatch(uuid) from public,anon,authenticated,service_role;
grant execute on function public.carrier_acknowledge_supply_dispatch(uuid) to authenticated;

create or replace function public.get_my_supply_dispatches()
returns table(
  dispatch_id uuid,dispatch_code text,source_reference text,source_kind text,source_name text,destination_name text,status text,
  package_count integer,seal_reference text,carrier_user_id uuid,authorized_at timestamptz,authorization_note text,created_at timestamptz,sealed_at timestamptz,
  received_at timestamptz,variance_reason text,resolution text,items jsonb
)
language sql stable security definer set search_path='' as $fn$
  select d.id,d.dispatch_code,d.source_reference,d.source_kind,
    private.supply_source_name(d.source_kind,d.source_supplier_id,d.source_location_id),
    c.name,d.status,d.package_count,d.seal_reference,d.carrier_user_id,d.authorized_at,d.authorization_note,d.created_at,d.sealed_at,d.received_at,d.variance_reason,d.resolution,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'product_id',di.product_id,'product_name',p.name,'package_size',p.package_size,'quantity',di.dispatched_quantity
    ) order by p.name),'[]'::jsonb)
     from public.supply_dispatch_items di join public.products p on p.id=di.product_id where di.dispatch_id=d.id)
  from public.supply_dispatches d
  join public.communities c on c.id=d.destination_community_id
  where
    (d.source_kind='supplier' and private.can_view_supply_source(auth.uid(),'supplier',d.source_supplier_id))
    or
    (d.source_kind='2tbr_store' and private.can_view_supply_source(auth.uid(),'2tbr_store',d.source_location_id))
    or d.carrier_user_id=auth.uid()
    or private.is_ops(auth.uid())
  order by d.created_at desc
  limit 200;
$fn$;
revoke all on function public.get_my_supply_dispatches() from public,anon,authenticated,service_role;
grant execute on function public.get_my_supply_dispatches() to authenticated;

create or replace function public.get_my_inbound_supply_dispatches(p_day_id uuid)
returns table(
  dispatch_id uuid,dispatch_code text,source_kind text,source_name text,status text,
  package_count integer,seal_reference text,carrier_name text,sealed_at timestamptz,items jsonb,
  variance_reason text
)
language plpgsql stable security definer set search_path='' as $fn$
declare dday public.community_ops_days%rowtype;
begin
  select * into dday from public.community_ops_days where id=p_day_id;
  if not found then raise exception 'Community operations day not found'; end if;
  if not private.is_community_operator(auth.uid(),dday.community_id) then raise exception 'Community assignment required'; end if;
  return query
  select d.id,d.dispatch_code,d.source_kind,
    private.supply_source_name(d.source_kind,d.source_supplier_id,d.source_location_id),
    d.status,null::integer,null::text,pr.full_name,d.sealed_at,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'product_id',di.product_id,'product_name',p.name,'package_size',p.package_size,
      'received_quantity',dr.received_quantity,'damaged_quantity',dr.damaged_quantity,'returned_quantity',dr.returned_quantity
    ) order by p.name),'[]'::jsonb)
     from public.supply_dispatch_items di
     join public.products p on p.id=di.product_id
     left join public.supply_dispatch_receipts dr on dr.dispatch_id=di.dispatch_id and dr.product_id=di.product_id
     where di.dispatch_id=d.id),
    d.variance_reason
  from public.supply_dispatches d
  left join public.profiles pr on pr.id=d.carrier_user_id
  where d.destination_community_id=dday.community_id
    and d.status in ('sealed','in_transit','variance','security_hold')
  order by d.created_at;
end;
$fn$;
revoke all on function public.get_my_inbound_supply_dispatches(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_inbound_supply_dispatches(uuid) to authenticated;

create or replace function private.post_verified_dispatch_to_community(p_dispatch_id uuid,p_day_id uuid)
returns void language plpgsql security definer set search_path='' as $fn$
declare d public.supply_dispatches%rowtype; r record; v_name text;
begin
  select * into d from public.supply_dispatches where id=p_dispatch_id;
  if not found then raise exception 'Dispatch not found'; end if;
  v_name=private.supply_source_name(d.source_kind,d.source_supplier_id,d.source_location_id);
  for r in
    select di.product_id,di.dispatched_quantity,dr.received_quantity,dr.damaged_quantity,dr.returned_quantity
    from public.supply_dispatch_items di
    join public.supply_dispatch_receipts dr on dr.dispatch_id=di.dispatch_id and dr.product_id=di.product_id
    where di.dispatch_id=p_dispatch_id
  loop
    insert into public.community_ops_inbound(
      day_id,product_id,source_type,source_name,expected_quantity,received_quantity,damaged_quantity,returned_quantity,
      exception_code,exception_reason,notes,received_by,source_dispatch_id
    ) values(
      p_day_id,r.product_id,d.source_kind,v_name,r.dispatched_quantity,r.received_quantity,r.damaged_quantity,r.returned_quantity,
      case when r.received_quantity-r.damaged_quantity-r.returned_quantity<>r.dispatched_quantity then 'verified_dispatch_variance' else null end,
      d.resolution_reason,'Verified supply handover '||d.dispatch_code,d.received_by,p_dispatch_id
    )
    on conflict(source_dispatch_id,product_id) where source_dispatch_id is not null do nothing;
  end loop;
end;
$fn$;
revoke all on function private.post_verified_dispatch_to_community(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.receive_supply_dispatch(
  p_day_id uuid,p_dispatch_id uuid,p_handover_code text,p_observed_package_count integer,
  p_observed_seal_reference text,p_items jsonb,p_receiver_note text default null
)
returns text language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid:=auth.uid(); d public.supply_dispatches%rowtype; dday public.community_ops_days%rowtype;
  sec private.supply_dispatch_secrets%rowtype; x jsonb; v_product uuid; v_received integer; v_damaged integer; v_returned integer;
  v_expected_count integer; v_payload_count integer; v_distinct integer; v_variance boolean:=false; v_reason text:='';
begin
  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  select * into dday from public.community_ops_days where id=p_day_id;
  if not found then raise exception 'Community operations day not found'; end if;
  if dday.community_id<>d.destination_community_id then raise exception 'Dispatch belongs to a different community'; end if;
  if not private.is_community_operator(v_user,dday.community_id) then raise exception 'Community assignment required'; end if;
  if d.created_by=v_user or d.sealed_by=v_user or d.carrier_user_id=v_user
     or (d.source_kind='supplier' and exists(
          select 1 from public.supplier_memberships sm
          where sm.supplier_id=d.source_supplier_id and sm.user_id=v_user and sm.active
        ))
     or (d.source_kind='2tbr_store' and exists(
          select 1 from public.supply_location_memberships lm
          where lm.location_id=d.source_location_id and lm.user_id=v_user and lm.active
        )) then
    update public.supply_dispatches
      set status='security_hold',variance_reason='Separation of duties violation at receiving'
      where id=d.id;
    perform private.raise_supply_risk(v_user,25,'separation_of_duties_violation',d.id,jsonb_build_object('stage','receive'));
    perform private.notify_supply_admins('supply_security_hold','Supply dispatch blocked by separation-of-duties control',
      d.dispatch_code||' was presented for receiving by a sender/source/carrier identity.',
      '/admin/supply-control','supply:'||d.id::text||':sod-receive');
    return 'security_hold';
  end if;
  if d.status not in ('sealed','in_transit') then raise exception 'Dispatch is not available for receiving'; end if;
  if p_observed_package_count is null or p_observed_package_count<0 then raise exception 'Observed package count is required'; end if;
  if jsonb_typeof(p_items)<>'array' then raise exception 'Receipt items are required'; end if;

  select count(*) into v_expected_count from public.supply_dispatch_items where dispatch_id=d.id;
  v_payload_count=jsonb_array_length(p_items);
  if v_payload_count<>v_expected_count then raise exception 'Count every product in the dispatch before verifying'; end if;

  create temporary table if not exists pg_temp.supply_receipt_input(
    product_id uuid primary key,received integer,damaged integer,returned integer
  ) on commit drop;
  truncate pg_temp.supply_receipt_input;

  for x in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product=(x->>'product_id')::uuid;
      v_received=(x->>'received_quantity')::integer;
      v_damaged=coalesce((x->>'damaged_quantity')::integer,0);
      v_returned=coalesce((x->>'returned_quantity')::integer,0);
    exception when others then raise exception 'Invalid receipt quantity'; end;
    if v_received<0 or v_damaged<0 or v_returned<0 or v_damaged+v_returned>v_received then
      raise exception 'Invalid received/damaged/returned quantities';
    end if;
    if not exists(select 1 from public.supply_dispatch_items where dispatch_id=d.id and product_id=v_product) then
      raise exception 'Receipt contains a product not in this dispatch';
    end if;
    insert into pg_temp.supply_receipt_input values(v_product,v_received,v_damaged,v_returned);
  end loop;
  select count(*) into v_distinct from pg_temp.supply_receipt_input;
  if v_distinct<>v_expected_count then raise exception 'Duplicate or missing receipt products'; end if;

  select * into sec from private.supply_dispatch_secrets where dispatch_id=d.id for update;
  if not found then raise exception 'Handover verification code is missing. Contact Admin.'; end if;
  if sec.consumed_at is not null then
    perform private.raise_supply_risk(v_user,15,'handover_code_reuse',d.id,jsonb_build_object('consumed_at',sec.consumed_at));
    return 'code_already_used';
  end if;
  if sec.expires_at<=now() then
    update public.supply_dispatches set status='security_hold',variance_reason='Handover code expired before verification' where id=d.id;
    perform private.raise_supply_risk(d.created_by,10,'handover_code_expired',d.id,'{}'::jsonb);
    perform private.notify_supply_admins('supply_security_hold','Supply dispatch on security hold',
      d.dispatch_code||' has an expired handover code. Admin review is required.',
      '/admin/supply-control','supply:'||d.id::text||':expired');
    return 'security_hold';
  end if;
  if extensions.digest(upper(btrim(coalesce(p_handover_code,''))),'sha256')<>sec.code_hash then
    update private.supply_dispatch_secrets set failed_attempts=failed_attempts+1,last_attempt_at=now() where dispatch_id=d.id;
    perform private.raise_supply_risk(v_user,5,'handover_code_failed',d.id,jsonb_build_object('attempt',sec.failed_attempts+1));
    if sec.failed_attempts+1>=5 then
      update public.supply_dispatches set status='security_hold',variance_reason='Too many invalid handover-code attempts' where id=d.id;
      perform private.raise_supply_risk(v_user,25,'fraud_hold',d.id,jsonb_build_object('reason','five_invalid_handover_codes'));
      perform private.notify_supply_admins('supply_security_hold','Supply dispatch locked after invalid codes',
        d.dispatch_code||' reached the maximum invalid handover-code attempts.',
        '/admin/supply-control','supply:'||d.id::text||':invalid-code-hold');
      return 'security_hold';
    end if;
    return 'invalid_code';
  end if;

  update private.supply_dispatch_secrets set consumed_at=now(),last_attempt_at=now() where dispatch_id=d.id;
  delete from public.supply_dispatch_receipts where dispatch_id=d.id;
  insert into public.supply_dispatch_receipts(dispatch_id,product_id,received_quantity,damaged_quantity,returned_quantity)
  select d.id,product_id,received,damaged,returned from pg_temp.supply_receipt_input;

  if p_observed_package_count<>coalesce(d.package_count,0) then
    v_variance:=true; v_reason:=v_reason||'Package count mismatch. ';
  end if;
  if coalesce(nullif(btrim(d.seal_reference),''),'')<>coalesce(nullif(btrim(p_observed_seal_reference),''),'') then
    v_variance:=true; v_reason:=v_reason||'Seal reference mismatch. ';
  end if;
  if exists(
    select 1 from public.supply_dispatch_items di
    join public.supply_dispatch_receipts dr on dr.dispatch_id=di.dispatch_id and dr.product_id=di.product_id
    where di.dispatch_id=d.id and dr.net_accepted_quantity<>di.dispatched_quantity
  ) then
    v_variance:=true; v_reason:=v_reason||'Product quantity/damage/return mismatch. ';
  end if;

  update public.supply_dispatches set
    received_by=v_user,received_at=now(),observed_package_count=p_observed_package_count,
    observed_seal_reference=nullif(btrim(coalesce(p_observed_seal_reference,'')),''),
    receiver_note=nullif(btrim(coalesce(p_receiver_note,'')),''),
    status=case when v_variance then 'variance' else 'verified' end,
    variance_reason=case when v_variance then btrim(v_reason) else null end
  where id=d.id;

  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(d.id,v_user,'community_receipt_recorded',case when v_variance then 'variance' else 'verified' end,
    jsonb_build_object('observed_packages',p_observed_package_count,'variance',v_variance,'reason',nullif(btrim(v_reason),'')));

  if v_variance then
    insert into private.supply_fraud_events(dispatch_id,actor_user_id,event_type,severity,metadata)
    values(d.id,v_user,'supply_variance','medium',jsonb_build_object('reason',btrim(v_reason)));
    perform private.notify_supply_admins('supply_variance','Supply handover variance needs review',
      d.dispatch_code||' was received with a mismatch: '||btrim(v_reason),
      '/admin/supply-control','supply:'||d.id::text||':variance');
    perform private.enqueue_notification(d.created_by,'supply_variance','Dispatch received with variance',
      d.dispatch_code||' was received with a mismatch. Admin review is required.',
      '/supply','supply:'||d.id::text||':sender-variance','high',null,null);
    return 'variance';
  end if;

  perform private.post_verified_dispatch_to_community(d.id,p_day_id);
  perform private.enqueue_notification(d.created_by,'supply_verified','Dispatch handover verified',
    d.dispatch_code||' was independently received and matched the sealed dispatch.',
    '/supply','supply:'||d.id::text||':verified','normal',null,null);
  perform private.enqueue_notification(v_user,'supply_verified','Inbound supply verified',
    d.dispatch_code||' matched the sender record and was posted into Community Ops stock.',
    '/community-ops?day='||p_day_id::text,'supply:'||d.id::text||':receiver-verified','normal',null,null);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_dispatch_verified','supply_dispatch',d.id,jsonb_build_object('day_id',p_day_id));
  return 'verified';
end;
$fn$;
revoke all on function public.receive_supply_dispatch(uuid,uuid,text,integer,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.receive_supply_dispatch(uuid,uuid,text,integer,text,jsonb,text) to authenticated;

create or replace function public.admin_get_supply_locations()
returns table(location_id uuid,name text,location_type text,address text,active boolean,members jsonb)
language plpgsql stable security definer set search_path='' as $fn$
begin
  if not private.is_ops(auth.uid()) then raise exception 'Admin required'; end if;
  return query
  select l.id,l.name,l.location_type,l.address,l.active,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',lm.user_id,'name',p.full_name,'phone',p.phone,'role',lm.role,'active',lm.active
    ) order by p.full_name),'[]'::jsonb)
     from public.supply_location_memberships lm left join public.profiles p on p.id=lm.user_id where lm.location_id=l.id)
  from public.supply_locations l order by l.name;
end;
$fn$;
revoke all on function public.admin_get_supply_locations() from public,anon,authenticated,service_role;
grant execute on function public.admin_get_supply_locations() to authenticated;

create or replace function public.admin_get_supply_dispatches(p_limit integer default 200)
returns table(
  dispatch_id uuid,dispatch_code text,source_reference text,source_kind text,source_name text,destination_name text,status text,
  created_by uuid,creator_name text,carrier_user_id uuid,carrier_name text,received_by uuid,receiver_name text,
  package_count integer,observed_package_count integer,seal_reference text,observed_seal_reference text,
  authorized_by uuid,authorized_at timestamptz,authorization_note text,
  variance_reason text,resolution text,resolution_reason text,created_at timestamptz,sealed_at timestamptz,received_at timestamptz,
  items jsonb
)
language plpgsql stable security definer set search_path='' as $fn$
begin
  if not private.is_ops(auth.uid()) then raise exception 'Admin required'; end if;
  return query
  select d.id,d.dispatch_code,d.source_reference,d.source_kind,private.supply_source_name(d.source_kind,d.source_supplier_id,d.source_location_id),
    c.name,d.status,d.created_by,pc.full_name,d.carrier_user_id,pca.full_name,d.received_by,pr.full_name,
    d.package_count,d.observed_package_count,d.seal_reference,d.observed_seal_reference,d.authorized_by,d.authorized_at,d.authorization_note,d.variance_reason,d.resolution,d.resolution_reason,
    d.created_at,d.sealed_at,d.received_at,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'product_id',di.product_id,'product_name',p.name,'package_size',p.package_size,
      'dispatched_quantity',di.dispatched_quantity,'received_quantity',dr.received_quantity,
      'damaged_quantity',dr.damaged_quantity,'returned_quantity',dr.returned_quantity,
      'net_accepted_quantity',dr.net_accepted_quantity
    ) order by p.name),'[]'::jsonb)
     from public.supply_dispatch_items di join public.products p on p.id=di.product_id
     left join public.supply_dispatch_receipts dr on dr.dispatch_id=di.dispatch_id and dr.product_id=di.product_id
     where di.dispatch_id=d.id)
  from public.supply_dispatches d
  join public.communities c on c.id=d.destination_community_id
  left join public.profiles pc on pc.id=d.created_by
  left join public.profiles pca on pca.id=d.carrier_user_id
  left join public.profiles pr on pr.id=d.received_by
  order by case d.status when 'security_hold' then 0 when 'variance' then 1 else 2 end,d.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500));
end;
$fn$;
revoke all on function public.admin_get_supply_dispatches(integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_get_supply_dispatches(integer) to authenticated;

create or replace function public.admin_get_supply_fraud_events(p_limit integer default 100)
returns table(event_id bigint,dispatch_id uuid,dispatch_code text,actor_user_id uuid,actor_name text,event_type text,severity text,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $fn$
begin
  if not private.is_ops(auth.uid()) then raise exception 'Admin required'; end if;
  return query
  select e.id,e.dispatch_id,d.dispatch_code,e.actor_user_id,p.full_name,e.event_type,e.severity,e.metadata,e.created_at
  from private.supply_fraud_events e
  left join public.supply_dispatches d on d.id=e.dispatch_id
  left join public.profiles p on p.id=e.actor_user_id
  order by e.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
end;
$fn$;
revoke all on function public.admin_get_supply_fraud_events(integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_get_supply_fraud_events(integer) to authenticated;

create or replace function public.admin_resolve_supply_variance(
  p_dispatch_id uuid,p_resolution text,p_responsibility text,p_reason text,p_day_id uuid default null
)
returns void language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid:=auth.uid(); d public.supply_dispatches%rowtype; v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  v_actor uuid;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  select * into d from public.supply_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if d.status not in ('variance','security_hold') then raise exception 'Dispatch is not awaiting Admin resolution'; end if;
  if v_user in (coalesce(d.created_by,'00000000-0000-0000-0000-000000000000'::uuid),
                coalesce(d.received_by,'00000000-0000-0000-0000-000000000000'::uuid),
                coalesce(d.carrier_user_id,'00000000-0000-0000-0000-000000000000'::uuid))
     or (d.source_kind='supplier' and exists(
          select 1 from public.supplier_memberships sm where sm.supplier_id=d.source_supplier_id and sm.user_id=v_user and sm.active
        ))
     or (d.source_kind='2tbr_store' and exists(
          select 1 from public.supply_location_memberships lm where lm.location_id=d.source_location_id and lm.user_id=v_user and lm.active
        )) then
    raise exception 'Independent Admin required: source staff, sender, receiver or carrier cannot resolve the same dispatch';
  end if;
  if p_resolution not in ('accept_receiver_count','replacement_pending','return_entire_batch','fraud_hold','cancelled','reset_for_reseal') then
    raise exception 'Invalid resolution';
  end if;
  if p_responsibility not in ('source','receiver','carrier','none','unknown') then raise exception 'Invalid responsibility'; end if;
  if v_reason is null then raise exception 'Resolution reason is required'; end if;

  if p_resolution='reset_for_reseal' then
    if d.status<>'security_hold' then raise exception 'Only a security-held dispatch can be reset for resealing'; end if;
    if d.received_by is not null then raise exception 'A dispatch with recorded receiver quantities cannot be reset; resolve the variance instead'; end if;
    delete from private.supply_dispatch_secrets where dispatch_id=d.id;
    update public.supply_dispatches set
      status='draft',package_count=null,seal_reference=null,sealed_by=null,sealed_at=null,
      carrier_acknowledged_at=null,variance_reason=null,resolution=p_resolution,resolution_reason=v_reason,
      resolved_by=v_user,resolved_at=now()
    where id=d.id;
  elsif p_resolution='accept_receiver_count' then
    if d.received_by is null then raise exception 'No receiver count exists'; end if;
    if p_day_id is null then raise exception 'Community operations day is required to accept received stock'; end if;
    if not exists(select 1 from public.community_ops_days od where od.id=p_day_id and od.community_id=d.destination_community_id) then
      raise exception 'Community operations day does not match destination';
    end if;
    update public.supply_dispatches set status='resolved',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;
    perform private.post_verified_dispatch_to_community(d.id,p_day_id);
  elsif p_resolution='replacement_pending' then
    update public.supply_dispatches set status='variance',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;
  elsif p_resolution='return_entire_batch' then
    update public.supply_dispatches set status='returned',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;
  elsif p_resolution='fraud_hold' then
    update public.supply_dispatches set status='security_hold',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;
  else
    update public.supply_dispatches set status='cancelled',resolution=p_resolution,resolution_reason=v_reason,resolved_by=v_user,resolved_at=now()
    where id=d.id;
  end if;

  v_actor=case p_responsibility when 'source' then d.created_by when 'receiver' then d.received_by when 'carrier' then d.carrier_user_id else null end;
  if v_actor is not null then
    perform private.raise_supply_risk(v_actor,case when p_resolution='fraud_hold' then 30 else 15 end,
      case when p_resolution='fraud_hold' then 'fraud_hold' else 'confirmed_variance' end,
      d.id,jsonb_build_object('responsibility',p_responsibility,'resolution',p_resolution,'reason',v_reason));
  end if;
  if p_responsibility='source' and d.source_supplier_id is not null then
    update public.suppliers set reliability_status=case when reliability_status='blocked' then 'blocked' else 'watch' end where id=d.source_supplier_id;
  end if;

  insert into public.supply_chain_events(dispatch_id,actor_user_id,event_type,event_status,metadata)
  values(d.id,v_user,'admin_variance_resolution',
    case when p_resolution='accept_receiver_count' then 'resolved' else p_resolution end,
    jsonb_build_object('resolution',p_resolution,'responsibility',p_responsibility,'reason',v_reason));
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supply_variance_resolved','supply_dispatch',d.id,
    jsonb_build_object('resolution',p_resolution,'responsibility',p_responsibility,'reason',v_reason));
  perform private.enqueue_notification(d.created_by,'supply_resolution','Supply dispatch review updated',
    d.dispatch_code||' review result: '||replace(p_resolution,'_',' ')||'.',
    '/supply','supply:'||d.id::text||':resolution:'||p_resolution,'high',null,null);
  if d.received_by is not null then
    perform private.enqueue_notification(d.received_by,'supply_resolution','Inbound dispatch review updated',
      d.dispatch_code||' review result: '||replace(p_resolution,'_',' ')||'.',
      '/community-ops','supply:'||d.id::text||':receiver-resolution:'||p_resolution,'high',null,null);
  end if;
end;
$fn$;
revoke all on function public.admin_resolve_supply_variance(uuid,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_resolve_supply_variance(uuid,text,text,text,uuid) to authenticated;

-- Direct mutations stay closed; workflows are through guarded RPCs only.
alter default privileges for role postgres in schema public revoke select,insert,update,delete on tables from anon,authenticated,service_role;
alter default privileges for role postgres in schema private revoke select,insert,update,delete on tables from public,anon,authenticated,service_role;
