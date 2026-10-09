-- Community Operations Officer + end-to-end goods/cash reconciliation.
-- Existing pickup_operator role is the staff identity; assignments are community-scoped.
-- Product COD and home-delivery cash are intentionally separate ledgers.

create table if not exists public.community_ops_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,community_id)
);

-- Preserve existing pickup-point assignments as community assignments.
insert into public.community_ops_assignments(user_id,community_id,active)
select distinct poa.user_id,pp.community_id,true
from public.pickup_operator_assignments poa
join public.pickup_points pp on pp.id=poa.pickup_point_id
on conflict(user_id,community_id) do nothing;

create table if not exists public.community_ops_days (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  business_date date not null,
  primary_operator_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'open'
    check(status in ('open','submitted','cash_handover_pending','exception','closed')),
  report_note text,
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id) on delete set null,
  cash_submitted_at timestamptz,
  admin_accepted_at timestamptz,
  admin_accepted_by uuid references auth.users(id) on delete set null,
  admin_note text,
  accepted_with_exception boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id,business_date)
);

create table if not exists public.community_ops_day_orders (
  day_id uuid not null references public.community_ops_days(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  expected_product_cash numeric(12,2) not null default 0 check(expected_product_cash>=0),
  expected_delivery_cash numeric(12,2) not null default 0 check(expected_delivery_cash>=0),
  payment_mode text not null check(payment_mode in ('cod','prepaid','payment_pending','waived')),
  goods_verified_at timestamptz,
  goods_verified_by uuid references auth.users(id) on delete set null,
  state text not null default 'pending'
    check(state in ('pending','verified','completed','exception')),
  outcome text check(outcome in (
    'pickup_handover','home_delivered','customer_unavailable','customer_refused',
    'damaged_goods','short_goods','partial_delivery','wrong_item','payment_issue',
    'address_issue','return_requested','cash_variance','cancelled','other_exception'
  )),
  product_cash_received numeric(12,2) not null default 0 check(product_cash_received>=0),
  delivery_cash_received numeric(12,2) not null default 0 check(delivery_cash_received>=0),
  actual_delivery_cost numeric(12,2) check(actual_delivery_cost is null or actual_delivery_cost>=0),
  exception_code text,
  exception_reason text,
  notes text,
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(day_id,order_id)
);

create table if not exists public.community_ops_inbound (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.community_ops_days(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  source_type text not null check(source_type in ('supplier','2tbr_store','delivery_agent','transfer','return','other')),
  source_name text,
  expected_quantity integer not null check(expected_quantity>=0),
  received_quantity integer not null check(received_quantity>=0),
  damaged_quantity integer not null default 0 check(damaged_quantity>=0),
  returned_quantity integer not null default 0 check(returned_quantity>=0),
  exception_code text,
  exception_reason text,
  notes text,
  received_by uuid not null references auth.users(id) on delete restrict,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.community_ops_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.community_ops_days(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  disposition text not null check(disposition in ('retained_at_point','returned_to_office','damaged','missing','transfer_out','other')),
  quantity integer not null check(quantity>0),
  reason text not null,
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now()
);

create table if not exists public.community_ops_cash_handovers (
  day_id uuid primary key references public.community_ops_days(id) on delete cascade,
  product_cod_submitted numeric(12,2) not null default 0 check(product_cod_submitted>=0),
  delivery_fees_submitted numeric(12,2) not null default 0 check(delivery_fees_submitted>=0),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  officer_note text,
  product_cod_received numeric(12,2) check(product_cod_received is null or product_cod_received>=0),
  delivery_fees_received numeric(12,2) check(delivery_fees_received is null or delivery_fees_received>=0),
  received_by uuid references auth.users(id) on delete set null,
  received_at timestamptz,
  admin_note text,
  variance_reason text,
  status text not null default 'draft'
    check(status in ('draft','submitted','accepted','variance')),
  updated_at timestamptz not null default now()
);

create index if not exists community_ops_assignments_user_idx on public.community_ops_assignments(user_id) where active;
create index if not exists community_ops_days_status_idx on public.community_ops_days(business_date desc,status,community_id);
create index if not exists community_ops_day_orders_order_idx on public.community_ops_day_orders(order_id);
create index if not exists community_ops_inbound_day_product_idx on public.community_ops_inbound(day_id,product_id);
create index if not exists community_ops_stock_day_product_idx on public.community_ops_stock_adjustments(day_id,product_id);

alter table public.community_ops_assignments enable row level security;
alter table public.community_ops_days enable row level security;
alter table public.community_ops_day_orders enable row level security;
alter table public.community_ops_inbound enable row level security;
alter table public.community_ops_stock_adjustments enable row level security;
alter table public.community_ops_cash_handovers enable row level security;

revoke all on public.community_ops_assignments,public.community_ops_days,public.community_ops_day_orders,public.community_ops_inbound,public.community_ops_stock_adjustments,public.community_ops_cash_handovers from anon,authenticated,service_role;

create or replace function private.is_community_operator(p_user uuid,p_community uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_user is not null and p_community is not null and (
    private.is_ops(p_user)
    or exists(
      select 1 from public.community_ops_assignments a
      where a.user_id=p_user and a.community_id=p_community and a.active
    )
  );
$$;
revoke all on function private.is_community_operator(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.community_order_belongs(p_order uuid,p_community uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.orders o
    join public.pools p on p.id=o.pool_id
    where o.id=p_order and p.community_id=p_community
  );
$$;
revoke all on function private.community_order_belongs(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.ops_payment_mode(p_status text)
returns text language sql immutable set search_path='' as $$
  select case
    when p_status in ('paid_manually') then 'prepaid'
    when p_status='waived_test_order' then 'waived'
    when p_status='payment_pending' then 'payment_pending'
    else 'cod'
  end;
$$;
revoke all on function private.ops_payment_mode(text) from public,anon,authenticated,service_role;

create or replace function private.community_ops_refresh_manifest_internal(p_day uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare d public.community_ops_days%rowtype; n integer:=0;
begin
  select * into d from public.community_ops_days where id=p_day for update;
  if not found then raise exception 'Operations day not found'; end if;
  insert into public.community_ops_day_orders(
    day_id,order_id,expected_product_cash,expected_delivery_cash,payment_mode
  )
  select
    d.id,o.id,
    case when private.ops_payment_mode(o.payment_status)='cod' then o.product_subtotal else 0 end,
    case when private.ops_payment_mode(o.payment_status)='cod' and o.fulfillment_method='home_delivery' then o.delivery_fee else 0 end,
    private.ops_payment_mode(o.payment_status)
  from public.orders o
  join public.pools p on p.id=o.pool_id
  where p.community_id=d.community_id
    and o.status in ('confirmed','ordered','ready_for_pickup')
  on conflict(day_id,order_id) do nothing;
  get diagnostics n=row_count;
  return n;
end;
$$;
revoke all on function private.community_ops_refresh_manifest_internal(uuid) from public,anon,authenticated,service_role;

create or replace function public.start_community_ops_day(p_community_id uuid,p_business_date date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_date date:=coalesce(p_business_date,(now() at time zone 'Asia/Dhaka')::date); v_day uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not private.is_community_operator(v_user,p_community_id) then raise exception 'Community assignment required'; end if;
  insert into public.community_ops_days(community_id,business_date,primary_operator_id)
  values(p_community_id,v_date,v_user)
  on conflict(community_id,business_date) do update set updated_at=now()
  returning id into v_day;
  perform private.community_ops_refresh_manifest_internal(v_day);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_day_started','community_ops_day',v_day,jsonb_build_object('community_id',p_community_id,'business_date',v_date));
  return v_day;
end;
$$;
revoke all on function public.start_community_ops_day(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.start_community_ops_day(uuid,date) to authenticated;

create or replace function public.refresh_community_ops_manifest(p_day_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; n integer;
begin
  select * into d from public.community_ops_days where id=p_day_id;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status<>'open' then raise exception 'Only an open operations day can refresh its manifest'; end if;
  n:=private.community_ops_refresh_manifest_internal(p_day_id);
  return n;
end;
$$;
revoke all on function public.refresh_community_ops_manifest(uuid) from public,anon,authenticated,service_role;
grant execute on function public.refresh_community_ops_manifest(uuid) to authenticated;

create or replace function public.record_community_ops_inbound(
  p_day_id uuid,p_product_id uuid,p_source_type text,p_source_name text,
  p_expected_quantity integer,p_received_quantity integer,p_damaged_quantity integer default 0,
  p_returned_quantity integer default 0,p_exception_code text default null,
  p_exception_reason text default null,p_notes text default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; v_id uuid; v_net integer; v_variance integer;
begin
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status<>'open' then raise exception 'Inbound can only be recorded while the day is open'; end if;
  if p_source_type not in ('supplier','2tbr_store','delivery_agent','transfer','return','other') then raise exception 'Invalid source type'; end if;
  if coalesce(p_expected_quantity,-1)<0 or coalesce(p_received_quantity,-1)<0 or coalesce(p_damaged_quantity,-1)<0 or coalesce(p_returned_quantity,-1)<0 then raise exception 'Quantities cannot be negative'; end if;
  if p_damaged_quantity+p_returned_quantity>p_received_quantity then raise exception 'Damaged/returned quantity cannot exceed received quantity'; end if;
  v_net:=p_received_quantity-p_damaged_quantity-p_returned_quantity;
  v_variance:=v_net-p_expected_quantity;
  if v_variance<>0 and nullif(btrim(coalesce(p_exception_reason,'')),'') is null then
    raise exception 'Inbound variance requires an exception reason';
  end if;
  insert into public.community_ops_inbound(
    day_id,product_id,source_type,source_name,expected_quantity,received_quantity,damaged_quantity,returned_quantity,
    exception_code,exception_reason,notes,received_by
  ) values(
    p_day_id,p_product_id,p_source_type,nullif(btrim(coalesce(p_source_name,'')),''),
    p_expected_quantity,p_received_quantity,p_damaged_quantity,p_returned_quantity,
    nullif(btrim(coalesce(p_exception_code,'')),''),nullif(btrim(coalesce(p_exception_reason,'')),''),
    nullif(btrim(coalesce(p_notes,'')),''),v_user
  ) returning id into v_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_inbound_recorded','community_ops_inbound',v_id,jsonb_build_object(
    'day_id',p_day_id,'product_id',p_product_id,'expected',p_expected_quantity,'received',p_received_quantity,
    'damaged',p_damaged_quantity,'returned',p_returned_quantity,'net',v_net,'variance',v_variance,'source_type',p_source_type
  ));
  return v_id;
end;
$$;
revoke all on function public.record_community_ops_inbound(uuid,uuid,text,text,integer,integer,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_community_ops_inbound(uuid,uuid,text,text,integer,integer,integer,integer,text,text,text) to authenticated;

create or replace function public.record_community_ops_stock_adjustment(
  p_day_id uuid,p_product_id uuid,p_disposition text,p_quantity integer,p_reason text,p_notes text default null
)
returns uuid language plpgsql security definer set search_path='' as $
declare v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; v_id uuid; v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status<>'open' then raise exception 'Stock adjustments can only be recorded while the day is open'; end if;
  if p_disposition not in ('retained_at_point','returned_to_office','damaged','missing','transfer_out','other') then raise exception 'Invalid stock disposition'; end if;
  if coalesce(p_quantity,0)<=0 then raise exception 'Stock adjustment quantity must be positive'; end if;
  if v_reason is null then raise exception 'Stock adjustment reason is required'; end if;
  insert into public.community_ops_stock_adjustments(day_id,product_id,disposition,quantity,reason,notes,recorded_by)
  values(p_day_id,p_product_id,p_disposition,p_quantity,v_reason,nullif(btrim(coalesce(p_notes,'')),''),v_user)
  returning id into v_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_stock_adjusted','community_ops_stock_adjustment',v_id,jsonb_build_object(
    'day_id',p_day_id,'product_id',p_product_id,'disposition',p_disposition,'quantity',p_quantity,'reason',v_reason
  ));
  return v_id;
end;
$;
revoke all on function public.record_community_ops_stock_adjustment(uuid,uuid,text,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_community_ops_stock_adjustment(uuid,uuid,text,integer,text,text) to authenticated;

create or replace function public.verify_community_ops_order(p_day_id uuid,p_order_id uuid,p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; o public.orders%rowtype;
begin
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status<>'open' then raise exception 'Operations day is not open'; end if;
  perform private.community_ops_refresh_manifest_internal(p_day_id);
  select * into o from public.orders where id=p_order_id;
  if not found or not private.community_order_belongs(p_order_id,d.community_id) then raise exception 'Order is outside your assigned community'; end if;
  if o.status not in ('ordered','ready_for_pickup') then raise exception 'Order is not available for receiving verification'; end if;
  update public.community_ops_day_orders
    set goods_verified_at=now(),goods_verified_by=v_user,state=case when state='pending' then 'verified' else state end,
        notes=coalesce(nullif(btrim(coalesce(p_notes,'')),''),notes),updated_at=now()
  where day_id=p_day_id and order_id=p_order_id;
  if not found then raise exception 'Order is not in this day manifest'; end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_order_verified','order',p_order_id,jsonb_build_object('day_id',p_day_id));
end;
$$;
revoke all on function public.verify_community_ops_order(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.verify_community_ops_order(uuid,uuid,text) to authenticated;

create or replace function public.complete_community_ops_order(
  p_day_id uuid,p_order_id uuid,p_product_cash numeric,p_delivery_cash numeric,
  p_actual_delivery_cost numeric default null,p_notes text default null
)
returns numeric language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; o public.orders%rowtype; m public.community_ops_day_orders%rowtype;
  v_product numeric(12,2):=round(coalesce(p_product_cash,0),2);
  v_delivery numeric(12,2):=round(coalesce(p_delivery_cash,0),2);
  v_saving numeric(12,2); v_outcome text;
begin
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status<>'open' then raise exception 'Operations day is not open'; end if;
  select * into m from public.community_ops_day_orders where day_id=p_day_id and order_id=p_order_id for update;
  if not found then raise exception 'Order is not in this day manifest'; end if;
  if m.goods_verified_at is null then raise exception 'Verify the customer order goods before handover'; end if;
  if m.state='completed' then return 0; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or not private.community_order_belongs(p_order_id,d.community_id) then raise exception 'Order is outside your assigned community'; end if;
  if o.status<>'ready_for_pickup' then raise exception 'Order is not ready for customer fulfilment'; end if;
  if m.payment_mode='payment_pending' then raise exception 'Payment is still pending. Resolve payment or record an exception before handover'; end if;
  if abs(v_product-m.expected_product_cash)>0.009 then raise exception 'Product COD must reconcile exactly to expected product cash (%)',m.expected_product_cash; end if;
  if abs(v_delivery-m.expected_delivery_cash)>0.009 then raise exception 'Delivery-fee cash must reconcile exactly to expected delivery cash (%)',m.expected_delivery_cash; end if;
  if p_actual_delivery_cost is not null and p_actual_delivery_cost<0 then raise exception 'Actual delivery cost cannot be negative'; end if;

  if (m.expected_product_cash+m.expected_delivery_cash)>0 then
    update public.orders set payment_status='paid_manually',payment_method='community_ops_cod',
      payment_reference='community-ops:'||p_day_id::text,updated_at=now() where id=p_order_id;
    insert into public.payment_records(order_id,status,method,reference_number,amount,recorded_by,notes)
    values(p_order_id,'paid_manually','community_ops_cod','community-ops:'||p_day_id::text,
      v_product+v_delivery,v_user,'Community officer cash collection; product COD and delivery fee reconciled separately in community operations.');
  end if;

  if o.fulfillment_method='pickup' then
    update public.fulfilments set status='collected',collected_at=now(),collected_by=v_user,
      notes=nullif(btrim(coalesce(p_notes,'')),''),updated_at=now() where order_id=p_order_id;
    v_outcome:='pickup_handover';
  else
    update public.orders set delivery_actual_cost=coalesce(round(p_actual_delivery_cost,2),delivery_actual_cost),updated_at=now() where id=p_order_id;
    update public.fulfilments set status='delivered',collected_at=now(),collected_by=v_user,
      notes=nullif(btrim(coalesce(p_notes,'')),''),updated_at=now() where order_id=p_order_id;
    v_outcome:='home_delivered';
  end if;

  v_saving:=private.complete_order_accounting(p_order_id,case when o.fulfillment_method='pickup' then 'community_pickup_completed' else 'community_home_delivery_completed' end);

  update public.community_ops_day_orders set state='completed',outcome=v_outcome,
    product_cash_received=v_product,delivery_cash_received=v_delivery,
    actual_delivery_cost=case when p_actual_delivery_cost is null then actual_delivery_cost else round(p_actual_delivery_cost,2) end,
    notes=coalesce(nullif(btrim(coalesce(p_notes,'')),''),notes),handled_at=now(),handled_by=v_user,updated_at=now()
  where day_id=p_day_id and order_id=p_order_id;

  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_order_completed','order',p_order_id,jsonb_build_object(
    'day_id',p_day_id,'outcome',v_outcome,'product_cod',v_product,'delivery_fee_cash',v_delivery,'verified_saving',v_saving
  ));
  return v_saving;
end;
$$;
revoke all on function public.complete_community_ops_order(uuid,uuid,numeric,numeric,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.complete_community_ops_order(uuid,uuid,numeric,numeric,numeric,text) to authenticated;

create or replace function public.record_community_ops_order_exception(
  p_day_id uuid,p_order_id uuid,p_exception_code text,p_exception_reason text,
  p_product_cash numeric default 0,p_delivery_cash numeric default 0,p_notes text default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; o public.orders%rowtype; v_issue uuid;
  v_code text:=lower(btrim(coalesce(p_exception_code,'')));
  v_reason text:=nullif(btrim(coalesce(p_exception_reason,'')),'');
  v_product numeric(12,2):=round(coalesce(p_product_cash,0),2);
  v_delivery numeric(12,2):=round(coalesce(p_delivery_cash,0),2);
begin
  if v_code not in ('customer_unavailable','customer_refused','damaged_goods','short_goods','partial_delivery','wrong_item','payment_issue','address_issue','return_requested','cash_variance','cancelled','other_exception') then
    raise exception 'Choose a valid exception type';
  end if;
  if v_reason is null then raise exception 'Exception reason is required'; end if;
  if v_product<0 or v_delivery<0 then raise exception 'Cash received cannot be negative'; end if;
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status<>'open' then raise exception 'Operations day is not open'; end if;
  select * into o from public.orders where id=p_order_id;
  if not found or not private.community_order_belongs(p_order_id,d.community_id) then raise exception 'Order is outside your assigned community'; end if;
  perform private.community_ops_refresh_manifest_internal(p_day_id);
  update public.community_ops_day_orders set state='exception',outcome=v_code,exception_code=v_code,exception_reason=v_reason,
    product_cash_received=v_product,delivery_cash_received=v_delivery,notes=nullif(btrim(coalesce(p_notes,'')),''),
    handled_at=now(),handled_by=v_user,updated_at=now()
  where day_id=p_day_id and order_id=p_order_id;
  if not found then raise exception 'Order is not in this day manifest'; end if;
  if (v_product+v_delivery)>0 then
    insert into public.payment_records(order_id,status,method,reference_number,amount,recorded_by,notes)
    values(p_order_id,'payment_pending','community_ops_exception_cash','community-ops-exception:'||p_day_id::text,
      v_product+v_delivery,v_user,'Cash physically received during an unresolved Community Ops exception; do not treat as fully paid until Admin resolves the exception.');
  end if;
  insert into public.operational_issues(order_id,pool_id,reported_by,issue_type,description,status)
  values(p_order_id,o.pool_id,v_user,'community_ops_'||v_code,v_reason,'open') returning id into v_issue;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_order_exception','order',p_order_id,jsonb_build_object(
    'day_id',p_day_id,'exception_code',v_code,'reason',v_reason,'product_cash_received',v_product,'delivery_cash_received',v_delivery,'issue_id',v_issue
  ));
  return v_issue;
end;
$$;
revoke all on function public.record_community_ops_order_exception(uuid,uuid,text,text,numeric,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.record_community_ops_order_exception(uuid,uuid,text,text,numeric,numeric,text) to authenticated;

create or replace function public.submit_community_ops_report(p_day_id uuid,p_report_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; v_pending integer; v_bad_inbound integer; v_stock_variance integer;
begin
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status<>'open' then raise exception 'Only an open day can be submitted'; end if;
  perform private.community_ops_refresh_manifest_internal(p_day_id);

  select count(*) into v_pending
  from public.community_ops_day_orders m
  join public.orders o on o.id=m.order_id
  where m.day_id=p_day_id
    and o.status='ready_for_pickup'
    and m.state not in ('completed','exception');
  if v_pending>0 then raise exception '% ready customer orders still need handover or an exception',v_pending; end if;

  select count(*) into v_bad_inbound
  from public.community_ops_inbound i
  where i.day_id=p_day_id
    and (i.received_quantity-i.damaged_quantity-i.returned_quantity)<>i.expected_quantity
    and nullif(btrim(coalesce(i.exception_reason,'')),'') is null;
  if v_bad_inbound>0 then raise exception 'Inbound variances require reasons'; end if;

  select count(*) into v_stock_variance
  from (
    select p.id,
      coalesce((select sum(i.received_quantity-i.damaged_quantity-i.returned_quantity) from public.community_ops_inbound i where i.day_id=p_day_id and i.product_id=p.id),0)
      - coalesce(sum(case when m.state='completed' then oi.quantity else 0 end),0)
      - coalesce((select sum(sa.quantity) from public.community_ops_stock_adjustments sa where sa.day_id=p_day_id and sa.product_id=p.id),0) as variance
    from public.community_ops_day_orders m
    join public.order_items oi on oi.order_id=m.order_id
    join public.products p on p.id=oi.product_id
    where m.day_id=p_day_id
    group by p.id
  ) s where s.variance<>0;
  if v_stock_variance>0 then
    raise exception '% product(s) still have stock variance. Account remaining/returned/damaged/missing stock before submitting.',v_stock_variance;
  end if;

  update public.community_ops_days set status='submitted',report_note=nullif(btrim(coalesce(p_report_note,'')),''),
    submitted_at=now(),submitted_by=v_user,updated_at=now() where id=p_day_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_report_submitted','community_ops_day',p_day_id,jsonb_build_object('pending_ready_orders',v_pending));
end;
$$;
revoke all on function public.submit_community_ops_report(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_community_ops_report(uuid,text) to authenticated;

create or replace function public.submit_community_ops_cash_handover(
  p_day_id uuid,p_product_cod numeric,p_delivery_fees numeric,p_note text default null
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; v_product numeric(12,2); v_delivery numeric(12,2);
  x_product numeric(12,2); x_delivery numeric(12,2);
begin
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(v_user,d.community_id) then raise exception 'Community assignment required'; end if;
  if d.status not in ('submitted','cash_handover_pending') then raise exception 'Submit the community report before cash handover'; end if;
  v_product:=round(coalesce(p_product_cod,0),2); v_delivery:=round(coalesce(p_delivery_fees,0),2);
  if v_product<0 or v_delivery<0 then raise exception 'Cash handover cannot be negative'; end if;
  select coalesce(sum(product_cash_received),0),coalesce(sum(delivery_cash_received),0)
    into x_product,x_delivery from public.community_ops_day_orders where day_id=p_day_id;
  if abs(v_product-x_product)>0.009 or abs(v_delivery-x_delivery)>0.009 then
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Cash handover variance requires a written reason';
    end if;
  end if;
  insert into public.community_ops_cash_handovers(day_id,product_cod_submitted,delivery_fees_submitted,submitted_by,submitted_at,officer_note,status,updated_at)
  values(p_day_id,v_product,v_delivery,v_user,now(),nullif(btrim(coalesce(p_note,'')),''),'submitted',now())
  on conflict(day_id) do update set product_cod_submitted=excluded.product_cod_submitted,
    delivery_fees_submitted=excluded.delivery_fees_submitted,submitted_by=excluded.submitted_by,
    submitted_at=excluded.submitted_at,officer_note=excluded.officer_note,status='submitted',updated_at=now();
  update public.community_ops_days set status='cash_handover_pending',cash_submitted_at=now(),updated_at=now() where id=p_day_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_cash_submitted','community_ops_day',p_day_id,jsonb_build_object(
    'product_cod_submitted',v_product,'delivery_fees_submitted',v_delivery,
    'system_product_cash',x_product,'system_delivery_cash',x_delivery
  ));
end;
$$;
revoke all on function public.submit_community_ops_cash_handover(uuid,numeric,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_community_ops_cash_handover(uuid,numeric,numeric,text) to authenticated;

create or replace function public.admin_accept_community_ops_cash(
  p_day_id uuid,p_product_cod_received numeric,p_delivery_fees_received numeric,
  p_accept_exceptions boolean default false,p_note text default null
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); d public.community_ops_days%rowtype; h public.community_ops_cash_handovers%rowtype;
  v_product numeric(12,2):=round(coalesce(p_product_cod_received,0),2);
  v_delivery numeric(12,2):=round(coalesce(p_delivery_fees_received,0),2);
  v_cash_variance boolean; v_open_issues integer;
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  select * into d from public.community_ops_days where id=p_day_id for update;
  if not found then raise exception 'Operations day not found'; end if;
  select * into h from public.community_ops_cash_handovers where day_id=p_day_id for update;
  if not found or h.status not in ('submitted','variance') then raise exception 'Officer cash handover has not been submitted'; end if;
  if v_product<0 or v_delivery<0 then raise exception 'Received cash cannot be negative'; end if;
  v_cash_variance:=abs(v_product-h.product_cod_submitted)>0.009 or abs(v_delivery-h.delivery_fees_submitted)>0.009;
  select count(*) into v_open_issues
  from public.community_ops_day_orders m
  where m.day_id=p_day_id and m.state='exception';

  if (v_cash_variance or v_open_issues>0) and not p_accept_exceptions then
    update public.community_ops_cash_handovers set product_cod_received=v_product,delivery_fees_received=v_delivery,
      received_by=v_user,received_at=now(),admin_note=nullif(btrim(coalesce(p_note,'')),''),
      status='variance',updated_at=now() where day_id=p_day_id;
    update public.community_ops_days set status='exception',admin_note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now() where id=p_day_id;
    raise exception 'Reconciliation has cash variance or unresolved order exceptions. Review and explicitly accept exceptions with a reason.';
  end if;
  if (v_cash_variance or v_open_issues>0) and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Admin reason is required when accepting a variance or exception';
  end if;

  update public.community_ops_cash_handovers set product_cod_received=v_product,delivery_fees_received=v_delivery,
    received_by=v_user,received_at=now(),admin_note=nullif(btrim(coalesce(p_note,'')),''),
    variance_reason=case when v_cash_variance then nullif(btrim(coalesce(p_note,'')),'') else null end,
    status=case when v_cash_variance then 'variance' else 'accepted' end,updated_at=now()
  where day_id=p_day_id;
  update public.community_ops_days set status='closed',admin_accepted_at=now(),admin_accepted_by=v_user,
    admin_note=nullif(btrim(coalesce(p_note,'')),''),accepted_with_exception=(v_cash_variance or v_open_issues>0),updated_at=now()
  where id=p_day_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_ops_day_closed','community_ops_day',p_day_id,jsonb_build_object(
    'product_cod_submitted',h.product_cod_submitted,'product_cod_received',v_product,
    'delivery_fees_submitted',h.delivery_fees_submitted,'delivery_fees_received',v_delivery,
    'open_exception_orders',v_open_issues,'accepted_with_exception',(v_cash_variance or v_open_issues>0),'note',p_note
  ));
end;
$$;
revoke all on function public.admin_accept_community_ops_cash(uuid,numeric,numeric,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_accept_community_ops_cash(uuid,numeric,numeric,boolean,text) to authenticated;

create or replace function public.admin_assign_community_operator(p_user_id uuid,p_community_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  if not exists(select 1 from public.user_roles where user_id=p_user_id and role='pickup_operator') then
    raise exception 'User must have the pickup_operator role first';
  end if;
  insert into public.community_ops_assignments(user_id,community_id,active,assigned_by,updated_at)
  values(p_user_id,p_community_id,true,v_user,now())
  on conflict(user_id,community_id) do update set active=true,assigned_by=v_user,updated_at=now();
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_operator_assigned','community',p_community_id,jsonb_build_object('operator_user_id',p_user_id));
end;
$$;
revoke all on function public.admin_assign_community_operator(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_assign_community_operator(uuid,uuid) to authenticated;

create or replace function public.admin_remove_community_operator(p_user_id uuid,p_community_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if not private.is_ops(v_user) then raise exception 'Admin required'; end if;
  update public.community_ops_assignments set active=false,updated_at=now()
  where user_id=p_user_id and community_id=p_community_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'community_operator_unassigned','community',p_community_id,jsonb_build_object('operator_user_id',p_user_id));
end;
$$;
revoke all on function public.admin_remove_community_operator(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_remove_community_operator(uuid,uuid) to authenticated;

create or replace function public.get_my_community_ops_days()
returns table(day_id uuid,community_id uuid,community_name text,business_date date,status text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select d.id,d.community_id,c.name,d.business_date,d.status,d.created_at
  from public.community_ops_days d
  join public.communities c on c.id=d.community_id
  where private.is_community_operator(auth.uid(),d.community_id)
  order by d.business_date desc,d.created_at desc;
$$;
revoke all on function public.get_my_community_ops_days() from public,anon,authenticated,service_role;
grant execute on function public.get_my_community_ops_days() to authenticated;

create or replace function public.get_my_community_ops_assignments()
returns table(community_id uuid,community_name text)
language sql stable security definer set search_path='' as $$
  select a.community_id,c.name
  from public.community_ops_assignments a join public.communities c on c.id=a.community_id
  where a.user_id=auth.uid() and a.active and c.active
  union
  select c.id,c.name from public.communities c where private.is_ops(auth.uid()) and c.active
  order by 2;
$$;
revoke all on function public.get_my_community_ops_assignments() from public,anon,authenticated,service_role;
grant execute on function public.get_my_community_ops_assignments() to authenticated;

create or replace function public.get_community_ops_day(p_day_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d public.community_ops_days%rowtype; result jsonb;
begin
  select * into d from public.community_ops_days where id=p_day_id;
  if not found then raise exception 'Operations day not found'; end if;
  if not private.is_community_operator(auth.uid(),d.community_id) then raise exception 'Community assignment required'; end if;

  select jsonb_build_object(
    'day',jsonb_build_object(
      'id',d.id,'community_id',d.community_id,'community_name',c.name,'business_date',d.business_date,
      'status',d.status,'report_note',d.report_note,'submitted_at',d.submitted_at,
      'cash_submitted_at',d.cash_submitted_at,'admin_accepted_at',d.admin_accepted_at,
      'admin_note',d.admin_note,'accepted_with_exception',d.accepted_with_exception
    ),
    'summary',(
      select jsonb_build_object(
        'orders',count(*),
        'ready_orders',count(*) filter(where o.status='ready_for_pickup'),
        'completed_orders',count(*) filter(where m.state='completed'),
        'exception_orders',count(*) filter(where m.state='exception'),
        'pending_orders',count(*) filter(where o.status='ready_for_pickup' and m.state not in ('completed','exception')),
        'pickup_orders',count(*) filter(where o.fulfillment_method='pickup'),
        'home_delivery_orders',count(*) filter(where o.fulfillment_method='home_delivery'),
        'expected_product_cod',coalesce(sum(m.expected_product_cash) filter(where m.state='completed'),0),
        'product_cod_collected',coalesce(sum(m.product_cash_received),0),
        'expected_delivery_fees',coalesce(sum(m.expected_delivery_cash) filter(where m.state='completed'),0),
        'delivery_fees_collected',coalesce(sum(m.delivery_cash_received),0)
      )
      from public.community_ops_day_orders m join public.orders o on o.id=m.order_id where m.day_id=d.id
    ),
    'products',coalesce((
      select jsonb_agg(x order by x->>'product_name')
      from (
        select jsonb_build_object(
          'product_id',p2.id,'product_name',p2.name,'package_size',p2.package_size,
          'required_quantity',sum(oi.quantity),
          'fulfilled_quantity',sum(case when m.state='completed' then oi.quantity else 0 end),
          'exception_quantity',sum(case when m.state='exception' then oi.quantity else 0 end),
          'inbound_received',coalesce((select sum(i.received_quantity-i.damaged_quantity-i.returned_quantity) from public.community_ops_inbound i where i.day_id=d.id and i.product_id=p2.id),0),
          'stock_accounted',coalesce((select sum(sa.quantity) from public.community_ops_stock_adjustments sa where sa.day_id=d.id and sa.product_id=p2.id),0),
          'stock_variance',
            coalesce((select sum(i.received_quantity-i.damaged_quantity-i.returned_quantity) from public.community_ops_inbound i where i.day_id=d.id and i.product_id=p2.id),0)
            - sum(case when m.state='completed' then oi.quantity else 0 end)
            - coalesce((select sum(sa.quantity) from public.community_ops_stock_adjustments sa where sa.day_id=d.id and sa.product_id=p2.id),0)
        ) x
        from public.community_ops_day_orders m
        join public.order_items oi on oi.order_id=m.order_id
        join public.products p2 on p2.id=oi.product_id
        where m.day_id=d.id
        group by p2.id,p2.name,p2.package_size
      ) q
    ),'[]'::jsonb),
    'orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id',o.id,'order_code',o.order_code,'customer_id',o.customer_id,'customer_name',pr.full_name,'phone',pr.phone,
        'status',o.status,'fulfillment_method',o.fulfillment_method,'delivery_address',o.delivery_address,
        'product_subtotal',o.product_subtotal,'delivery_fee',o.delivery_fee,'total_amount',o.total_amount,
        'payment_status',o.payment_status,'payment_mode',m.payment_mode,
        'expected_product_cash',m.expected_product_cash,'expected_delivery_cash',m.expected_delivery_cash,
        'goods_verified_at',m.goods_verified_at,'state',m.state,'outcome',m.outcome,
        'product_cash_received',m.product_cash_received,'delivery_cash_received',m.delivery_cash_received,
        'exception_code',m.exception_code,'exception_reason',m.exception_reason,'notes',m.notes,
        'items',(select coalesce(jsonb_agg(jsonb_build_object('name',p3.name,'package_size',p3.package_size,'quantity',oi.quantity,'unit_price',oi.unit_price)),'[]'::jsonb)
                 from public.order_items oi join public.products p3 on p3.id=oi.product_id where oi.order_id=o.id)
      ) order by o.order_code)
      from public.community_ops_day_orders m
      join public.orders o on o.id=m.order_id
      join public.profiles pr on pr.id=o.customer_id
      where m.day_id=d.id
    ),'[]'::jsonb),
    'inbound',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'product_id',i.product_id,'product_name',p4.name,'package_size',p4.package_size,
        'source_type',i.source_type,'source_name',i.source_name,'expected_quantity',i.expected_quantity,
        'received_quantity',i.received_quantity,'damaged_quantity',i.damaged_quantity,'returned_quantity',i.returned_quantity,
        'exception_code',i.exception_code,'exception_reason',i.exception_reason,'notes',i.notes,'received_at',i.received_at
      ) order by i.received_at desc)
      from public.community_ops_inbound i join public.products p4 on p4.id=i.product_id where i.day_id=d.id
    ),'[]'::jsonb),
    'stock_adjustments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sa.id,'product_id',sa.product_id,'product_name',p5.name,'disposition',sa.disposition,
        'quantity',sa.quantity,'reason',sa.reason,'notes',sa.notes,'recorded_at',sa.recorded_at
      ) order by sa.recorded_at desc)
      from public.community_ops_stock_adjustments sa join public.products p5 on p5.id=sa.product_id
      where sa.day_id=d.id
    ),'[]'::jsonb),
    'cash_handover',(
      select case when h.day_id is null then null else jsonb_build_object(
        'product_cod_submitted',h.product_cod_submitted,'delivery_fees_submitted',h.delivery_fees_submitted,
        'product_cod_received',h.product_cod_received,'delivery_fees_received',h.delivery_fees_received,
        'status',h.status,'officer_note',h.officer_note,'admin_note',h.admin_note,'variance_reason',h.variance_reason,
        'submitted_at',h.submitted_at,'received_at',h.received_at
      ) end from (select * from public.community_ops_cash_handovers where day_id=d.id) h
    )
  ) into result
  from public.communities c where c.id=d.community_id;
  return result;
end;
$$;
revoke all on function public.get_community_ops_day(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_community_ops_day(uuid) to authenticated;

create or replace function public.admin_get_community_ops_assignments()
returns table(user_id uuid,operator_name text,operator_phone text,community_id uuid,community_name text,active boolean)
language plpgsql stable security definer set search_path='' as $
begin
  if not private.is_ops(auth.uid()) then raise exception 'Admin required'; end if;
  return query
  select a.user_id,pr.full_name,pr.phone,a.community_id,c.name,a.active
  from public.community_ops_assignments a
  join public.communities c on c.id=a.community_id
  left join public.profiles pr on pr.id=a.user_id
  order by c.name,pr.full_name;
end;
$;
revoke all on function public.admin_get_community_ops_assignments() from public,anon,authenticated,service_role;
grant execute on function public.admin_get_community_ops_assignments() to authenticated;

create or replace function public.admin_get_community_ops_days(p_limit integer default 100)
returns table(
  day_id uuid,community_id uuid,community_name text,business_date date,status text,operator_name text,
  total_orders bigint,completed_orders bigint,exception_orders bigint,
  product_cod_collected numeric,delivery_fees_collected numeric,
  product_cod_submitted numeric,delivery_fees_submitted numeric,
  product_cod_received numeric,delivery_fees_received numeric,
  accepted_with_exception boolean,submitted_at timestamptz,admin_accepted_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_ops(auth.uid()) then raise exception 'Admin required'; end if;
  return query
  select d.id,d.community_id,c.name,d.business_date,d.status,pr.full_name,
    count(m.order_id),
    count(m.order_id) filter(where m.state='completed'),
    count(m.order_id) filter(where m.state='exception'),
    coalesce(sum(m.product_cash_received),0)::numeric,
    coalesce(sum(m.delivery_cash_received),0)::numeric,
    h.product_cod_submitted,h.delivery_fees_submitted,h.product_cod_received,h.delivery_fees_received,
    d.accepted_with_exception,d.submitted_at,d.admin_accepted_at
  from public.community_ops_days d
  join public.communities c on c.id=d.community_id
  left join public.profiles pr on pr.id=d.primary_operator_id
  left join public.community_ops_day_orders m on m.day_id=d.id
  left join public.community_ops_cash_handovers h on h.day_id=d.id
  group by d.id,c.name,pr.full_name,h.product_cod_submitted,h.delivery_fees_submitted,h.product_cod_received,h.delivery_fees_received
  order by d.business_date desc,d.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
end;
$$;
revoke all on function public.admin_get_community_ops_days(integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_get_community_ops_days(integer) to authenticated;

-- Keep direct table access closed; all workflow writes/read models go through guarded RPCs.
alter default privileges for role postgres in schema public revoke select,insert,update,delete on tables from anon,authenticated,service_role;
