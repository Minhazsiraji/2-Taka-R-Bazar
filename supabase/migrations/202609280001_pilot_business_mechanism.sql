-- Pilot business-mechanism upgrade: tier unlocks, inbound receiving, referrals and pilot-mode guard.
create table public.pilot_settings (
  singleton boolean primary key default true check (singleton),
  pilot_mode boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.pilot_settings(singleton,pilot_mode) values(true,true) on conflict(singleton) do nothing;
alter table public.pilot_settings enable row level security;
create policy pilot_settings_read on public.pilot_settings for select to authenticated using (true);
grant select on public.pilot_settings to authenticated;

create or replace function private.is_pilot_mode()
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select pilot_mode from public.pilot_settings where singleton=true),true);
$$;
revoke all on function private.is_pilot_mode() from public;

-- Existing subscription infrastructure remains intact, but pilot mode always allows Pool participation.
create or replace function private.has_active_subscription(p_user uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_enforced boolean; v_valid timestamptz;
begin
  if p_user is null then return false; end if;
  if private.is_pilot_mode() then return true; end if;
  if private.has_role(p_user,'super_admin') then return true; end if;
  select enforcement_enabled into v_enforced from public.subscription_settings where singleton=true;
  if coalesce(v_enforced,false)=false then return true; end if;
  select valid_until into v_valid from public.subscription_memberships where user_id=p_user;
  return v_valid is not null and v_valid>now();
end; $$;
alter table public.supplier_quotes
  add column quote_phase text not null default 'final',
  add column threshold_quantity integer,
  add column customer_ceiling_price numeric(12,2),
  add column delivery_included boolean not null default false,
  add column delivery_target_at timestamptz;
alter table public.supplier_quotes add constraint supplier_quotes_phase_check check (quote_phase in ('planning_tier','final'));
alter table public.supplier_quotes add constraint supplier_quotes_threshold_check check (threshold_quantity is null or threshold_quantity > 0);
alter table public.supplier_quotes add constraint supplier_quotes_ceiling_check check (customer_ceiling_price is null or customer_ceiling_price > 0);
alter table public.supplier_quotes add constraint supplier_quotes_planning_fields_check check (
  quote_phase <> 'planning_tier' or (threshold_quantity is not null and customer_ceiling_price is not null and delivery_included)
);
create index supplier_quotes_tier_lookup on public.supplier_quotes(pool_item_id,quote_phase,threshold_quantity);

alter table public.pool_items
  add column best_unlocked_tier_quote_id uuid references public.supplier_quotes(id) on delete set null,
  add column best_unlocked_threshold integer,
  add column best_unlocked_customer_ceiling_price numeric(12,2),
  add column best_unlocked_at timestamptz,
  add column frozen_committed_quantity integer,
  add column frozen_tier_quote_id uuid references public.supplier_quotes(id) on delete set null,
  add column frozen_tier_threshold integer,
  add column frozen_customer_ceiling_price numeric(12,2),
  add column pricing_locked_at timestamptz;
alter table public.pool_items add constraint pool_items_best_threshold_check check (best_unlocked_threshold is null or best_unlocked_threshold > 0);
alter table public.pool_items add constraint pool_items_best_ceiling_check check (best_unlocked_customer_ceiling_price is null or best_unlocked_customer_ceiling_price > 0);
alter table public.pool_items add constraint pool_items_frozen_qty_check check (frozen_committed_quantity is null or frozen_committed_quantity >= 0);
alter table public.pool_items add constraint pool_items_frozen_ceiling_check check (frozen_customer_ceiling_price is null or frozen_customer_ceiling_price > 0);

alter table public.pools
  add column supplier_delivery_at timestamptz,
  add column receiving_pickup_point_id uuid references public.pickup_points(id) on delete set null;
alter table public.pools add constraint pools_supplier_delivery_before_pickup check (
  supplier_delivery_at is null or pickup_at is null or supplier_delivery_at < pickup_at
);
create table public.supplier_receipts (
  id uuid primary key default gen_random_uuid(),
  pool_item_id uuid not null unique references public.pool_items(id) on delete cascade,
  supplier_quote_id uuid not null references public.supplier_quotes(id) on delete restrict,
  expected_quantity integer not null check (expected_quantity > 0),
  received_quantity integer not null check (received_quantity >= 0),
  status text not null check (status in ('short','received')),
  received_at timestamptz not null default now(),
  received_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.supplier_receipts enable row level security;
create policy supplier_receipts_admin_read on public.supplier_receipts for select to authenticated
  using (
    private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin') or exists(
      select 1 from public.pool_items pi join public.pools po on po.id=pi.pool_id
      where pi.id=supplier_receipts.pool_item_id and po.receiving_pickup_point_id is not null
        and private.is_assigned_pickup(auth.uid(),po.receiving_pickup_point_id)
    )
  );
revoke insert,update,delete on public.supplier_receipts from authenticated;
grant select on public.supplier_receipts to authenticated;

alter table public.profiles add column referral_code text;
update public.profiles set referral_code=upper(substr(replace(id::text,'-',''),1,6)) where referral_code is null;
create unique index profiles_referral_code_uidx on public.profiles(referral_code);

create or replace function private.ensure_referral_code()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
  if new.referral_code is not null and length(trim(new.referral_code))>=4 then return new; end if;
  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.profiles where referral_code=v_code);
  end loop;
  new.referral_code:=v_code;
  return new;
end; $$;
create trigger profiles_referral_code before insert or update of referral_code on public.profiles
for each row execute function private.ensure_referral_code();
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','rewarded','rejected')),
  first_completed_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referrer_user_id <> referred_user_id)
);
create index referrals_referrer_idx on public.referrals(referrer_user_id,status);
alter table public.referrals enable row level security;
create policy referrals_admin_read on public.referrals for select to authenticated
  using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'));
revoke insert,update,delete on public.referrals from authenticated;
grant select on public.referrals to authenticated;

create table public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  referral_id uuid not null unique references public.referrals(id) on delete restrict,
  event_key text not null unique,
  coins integer not null check (coins <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create index coin_ledger_user_idx on public.coin_ledger(user_id,created_at desc);
alter table public.coin_ledger enable row level security;
create policy coin_ledger_own_read on public.coin_ledger for select to authenticated using (
  user_id=auth.uid() or private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin')
);
revoke insert,update,delete on public.coin_ledger from authenticated;
grant select on public.coin_ledger to authenticated;

-- Planning tiers must improve or hold price as thresholds increase.
create or replace function private.validate_planning_tier()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status text; v_frozen integer; v_delivery timestamptz; v_benchmark numeric;
begin
  select po.status,pi.frozen_committed_quantity,po.supplier_delivery_at,pi.benchmark_price_snapshot
  into v_status,v_frozen,v_delivery,v_benchmark
  from public.pool_items pi join public.pools po on po.id=pi.pool_id where pi.id=new.pool_item_id;
  if v_status is null then raise exception 'Pool item not found'; end if;
  if new.quote_phase='planning_tier' then
    if v_status<>'draft' then raise exception 'Planning tiers can only be entered while the pool is Draft'; end if;
    if new.customer_ceiling_price < new.landed_unit_price then raise exception 'Planning customer ceiling cannot be below delivered supplier cost'; end if;
    if new.customer_ceiling_price > v_benchmark then raise exception 'Planning customer ceiling cannot exceed the approved market benchmark'; end if;
    if exists(select 1 from public.supplier_quotes q where q.pool_item_id=new.pool_item_id and q.quote_phase='planning_tier' and q.id<>new.id
      and q.threshold_quantity < new.threshold_quantity and q.customer_ceiling_price < new.customer_ceiling_price) then
      raise exception 'Higher quantity tiers cannot unlock a worse customer price';
    end if;
    if exists(select 1 from public.supplier_quotes q where q.pool_item_id=new.pool_item_id and q.quote_phase='planning_tier' and q.id<>new.id
      and q.threshold_quantity > new.threshold_quantity and q.customer_ceiling_price > new.customer_ceiling_price) then
      raise exception 'Lower quantity tiers cannot undercut an existing higher tier';
    end if;
  else
    if v_status not in ('pricing','final_price') then raise exception 'Final supplier quotes require frozen demand in Pricing'; end if;
    if coalesce(new.delivery_included,false)=false then raise exception 'Final supplier quote must include delivery'; end if;
    if v_frozen is null or v_frozen<1 or new.quantity<>v_frozen then raise exception 'Final supplier quote quantity must match frozen demand'; end if;
    if new.available_quantity is not null and new.available_quantity<v_frozen then raise exception 'Final supplier quote does not cover frozen demand'; end if;
    if v_delivery is not null and (new.delivery_target_at is null or new.delivery_target_at>v_delivery) then raise exception 'Final supplier delivery target misses the pool handover target'; end if;
  end if;
  return new;
end; $$;
create trigger supplier_quotes_planning_tier_guard before insert or update on public.supplier_quotes
for each row execute function private.validate_planning_tier();

create or replace function private.refresh_pool_item_unlock(p_pool_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.pool_items%rowtype; v_status text; v_qty integer; v_tier public.supplier_quotes%rowtype;
begin
  select * into v_item from public.pool_items where id=p_pool_item_id for update;
  if not found then return; end if;
  select status into v_status from public.pools where id=v_item.pool_id;
  if v_status<>'open' then return; end if;
  select coalesce(sum(quantity),0)::int into v_qty from public.commitments where pool_item_id=p_pool_item_id and status in ('active','confirmed');
  select * into v_tier from public.supplier_quotes
  where pool_item_id=p_pool_item_id and quote_phase='planning_tier' and threshold_quantity<=v_qty
    and (valid_until is null or valid_until>=current_date)
  order by threshold_quantity desc,customer_ceiling_price asc limit 1;
  if found and (v_item.best_unlocked_customer_ceiling_price is null
    or v_tier.customer_ceiling_price<v_item.best_unlocked_customer_ceiling_price
    or (v_tier.customer_ceiling_price=v_item.best_unlocked_customer_ceiling_price and v_tier.threshold_quantity>coalesce(v_item.best_unlocked_threshold,0))) then
    update public.pool_items set best_unlocked_tier_quote_id=v_tier.id,best_unlocked_threshold=v_tier.threshold_quantity,
      best_unlocked_customer_ceiling_price=v_tier.customer_ceiling_price,best_unlocked_at=now() where id=p_pool_item_id;
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(auth.uid(),'price_tier_unlocked','pool_item',p_pool_item_id,jsonb_build_object('quantity',v_qty,'threshold',v_tier.threshold_quantity,'customer_ceiling',v_tier.customer_ceiling_price,'quote_id',v_tier.id));
  end if;
end; $$;
revoke all on function private.refresh_pool_item_unlock(uuid) from public;

create or replace function public.get_pool_price_unlocks(p_pool_id uuid)
returns table(pool_item_id uuid,current_quantity integer,unlocked_price numeric,unlocked_threshold integer,next_threshold integer,next_price numeric,units_needed integer)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_community uuid; v_user_community uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select community_id into v_community from public.pools where id=p_pool_id and status not in ('draft','cancelled');
  if v_community is null then raise exception 'Pool not available'; end if;
  select community_id into v_user_community from public.profiles where id=v_user;
  if v_user_community is distinct from v_community and not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin') then raise exception 'Pool is outside your community'; end if;
  return query with demand as (
    select pi.id as pool_item_id,po.status,coalesce(sum(c.quantity) filter(where c.status in ('active','confirmed')),0)::int as qty,
      case when po.status='open' then pi.best_unlocked_customer_ceiling_price else coalesce(pi.frozen_customer_ceiling_price,pi.best_unlocked_customer_ceiling_price) end as price,
      case when po.status='open' then pi.best_unlocked_threshold else coalesce(pi.frozen_tier_threshold,pi.best_unlocked_threshold) end as threshold
    from public.pool_items pi join public.pools po on po.id=pi.pool_id left join public.commitments c on c.pool_item_id=pi.id
    where pi.pool_id=p_pool_id and pi.active group by pi.id,po.status
  ), next_candidates as (
    select d.pool_item_id,q.threshold_quantity,q.customer_ceiling_price,row_number() over(partition by d.pool_item_id order by q.threshold_quantity asc,q.customer_ceiling_price asc) as rn
    from demand d join public.supplier_quotes q on q.pool_item_id=d.pool_item_id
    where q.quote_phase='planning_tier' and q.threshold_quantity>d.qty and q.threshold_quantity>coalesce(d.threshold,0)
      and (q.valid_until is null or q.valid_until>=current_date) and (d.price is null or q.customer_ceiling_price<d.price)
  )
  select d.pool_item_id,d.qty,d.price,d.threshold,n.threshold_quantity,n.customer_ceiling_price,
    case when n.threshold_quantity is null then 0 else greatest(n.threshold_quantity-d.qty,0) end::int
  from demand d left join next_candidates n on n.pool_item_id=d.pool_item_id and n.rn=1;
end; $$;
revoke all on function public.get_pool_price_unlocks(uuid) from public,anon;
grant execute on function public.get_pool_price_unlocks(uuid) to authenticated;

create or replace function public.commit_to_pool(p_pool_item_id uuid,p_quantity integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_commitment uuid; v_pool_status text; v_pool_community uuid; v_user_community uuid; v_max integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not private.has_active_subscription(v_user) then raise exception 'Active membership required. Pay your monthly subscription or redeem a valid free coupon.'; end if;
  if p_quantity<1 then raise exception 'Quantity must be positive'; end if;
  select po.status,po.community_id,pi.max_quantity into v_pool_status,v_pool_community,v_max
  from public.pool_items pi join public.pools po on po.id=pi.pool_id
  where pi.id=p_pool_item_id and pi.active=true for update of pi;
  if not found then raise exception 'Pool item not found'; end if;
  if v_pool_status<>'open' then raise exception 'Pool is not accepting commitments'; end if;
  if p_quantity>v_max then raise exception 'Quantity exceeds pool limit'; end if;
  select community_id into v_user_community from public.profiles where id=v_user;
  if v_user_community is distinct from v_pool_community then raise exception 'Pool is outside your community'; end if;
  insert into public.commitments(pool_item_id,customer_id,quantity,status,committed_at)
  values(p_pool_item_id,v_user,p_quantity,'active',now())
  on conflict(pool_item_id,customer_id) do update set quantity=excluded.quantity,status='active',committed_at=now(),confirmed_at=null
  returning id into v_commitment;
  perform private.refresh_pool_item_unlock(p_pool_item_id);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'commitment_upserted','commitment',v_commitment,jsonb_build_object('quantity',p_quantity));
  return v_commitment;
end; $$;
revoke all on function public.commit_to_pool(uuid,integer) from public,anon;
grant execute on function public.commit_to_pool(uuid,integer) to authenticated;

do $$ declare r record; begin
  for r in select pi.id from public.pool_items pi join public.pools po on po.id=pi.pool_id where pi.active and po.status='open' loop
    perform private.refresh_pool_item_unlock(r.id);
  end loop;
end $$;

create or replace function public.apply_referral_code(p_code text)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_referrer uuid; v_code text:=upper(regexp_replace(coalesce(trim(p_code),''),'[^A-Za-z0-9]','','g'));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_code='' then return 'empty'; end if;
  select id into v_referrer from public.profiles where referral_code=v_code;
  if v_referrer is null then return 'invalid'; end if;
  if v_referrer=v_user then
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(v_user,'referral_rejected_self','profile',v_user,jsonb_build_object('code',v_code));
    return 'self_rejected';
  end if;
  if exists(select 1 from public.orders where customer_id=v_user and status='completed' and payment_status<>'waived_test_order') then
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'referral_rejected_existing_customer','profile',v_user,jsonb_build_object('code',v_code));
    return 'ineligible_existing_customer';
  end if;
  if exists(select 1 from public.referrals where referred_user_id=v_user) then return 'already_attributed'; end if;
  insert into public.referrals(referrer_user_id,referred_user_id,status) values(v_referrer,v_user,'pending');
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'referral_attributed','profile',v_user,jsonb_build_object('referrer_user_id',v_referrer));
  return 'attributed';
exception when unique_violation then return 'already_attributed';
end; $$;
revoke all on function public.apply_referral_code(text) from public,anon;
grant execute on function public.apply_referral_code(text) to authenticated;

create or replace function public.get_my_referral_summary()
returns table(referral_code text,pending_referrals bigint,successful_referrals bigint,coins bigint,conceptual_free_months bigint,coins_to_next_month integer)
language sql stable security definer set search_path='' as $$
  select p.referral_code,
    (select count(*) from public.referrals r where r.referrer_user_id=auth.uid() and r.status='pending'),
    (select count(*) from public.referrals r where r.referrer_user_id=auth.uid() and r.status='rewarded'),
    coalesce((select sum(cl.coins) from public.coin_ledger cl where cl.user_id=auth.uid()),0)::bigint,
    floor(coalesce((select sum(cl.coins) from public.coin_ledger cl where cl.user_id=auth.uid()),0)/100.0)::bigint,
    (100-(coalesce((select sum(cl.coins) from public.coin_ledger cl where cl.user_id=auth.uid()),0)::int % 100))::int
  from public.profiles p where p.id=auth.uid();
$$;
revoke all on function public.get_my_referral_summary() from public,anon;
grant execute on function public.get_my_referral_summary() to authenticated;
create or replace function public.admin_finalize_pool_item(p_pool_item_id uuid,p_quote_id uuid,p_final_customer_price numeric,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_item public.pool_items%rowtype; v_quote public.supplier_quotes%rowtype; v_pool_status text;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  if p_final_customer_price is null or p_final_customer_price<=0 then raise exception 'Final customer price must be positive'; end if;
  select * into v_item from public.pool_items where id=p_pool_item_id for update;
  if not found or not v_item.active then raise exception 'Pool item not found'; end if;
  select status into v_pool_status from public.pools where id=v_item.pool_id;
  if v_pool_status not in ('pricing','final_price') then raise exception 'Final pricing is only available during Pricing/Final Price'; end if;
  select * into v_quote from public.supplier_quotes where id=p_quote_id and pool_item_id=p_pool_item_id for update;
  if not found then raise exception 'Selected quote does not belong to this pool item'; end if;
  if v_quote.quote_phase<>'final' then raise exception 'Select a final supplier quote, not a planning tier'; end if;
  if not v_quote.delivery_included then raise exception 'Final supplier quote must include delivery to the community receiving point'; end if;
  if v_item.frozen_committed_quantity is null or v_item.pricing_locked_at is null then raise exception 'Demand must be frozen before final pricing'; end if;
  if v_quote.quantity<>v_item.frozen_committed_quantity then raise exception 'Final supplier quote quantity must match frozen committed quantity (%)',v_item.frozen_committed_quantity; end if;
  if p_final_customer_price<v_quote.landed_unit_price then raise exception 'Final customer price cannot be below delivered supplier cost during pilot'; end if;
  if v_item.frozen_customer_ceiling_price is not null and p_final_customer_price>v_item.frozen_customer_ceiling_price then
    raise exception 'Final customer price cannot exceed the unlocked ceiling of %',v_item.frozen_customer_ceiling_price;
  end if;
  update public.supplier_quotes set selected=false,selection_reason=null where pool_item_id=p_pool_item_id and quote_phase='final';
  update public.supplier_quotes set selected=true,selection_reason=nullif(trim(p_reason),'') where id=p_quote_id;
  update public.pool_items set selected_supplier_quote_id=p_quote_id,final_customer_price=p_final_customer_price where id=p_pool_item_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pool_item_finalized','pool_item',p_pool_item_id,jsonb_build_object(
    'quote_id',p_quote_id,'frozen_quantity',v_item.frozen_committed_quantity,'frozen_ceiling',v_item.frozen_customer_ceiling_price,
    'landed_unit_price',v_quote.landed_unit_price,'final_customer_price',p_final_customer_price,
    'margin_per_unit',round(p_final_customer_price-v_quote.landed_unit_price,2),'reason',p_reason));
end; $$;
revoke all on function public.admin_finalize_pool_item(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.admin_finalize_pool_item(uuid,uuid,numeric,text) to authenticated;
create or replace function public.admin_set_pool_status(p_pool_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_pool public.pools%rowtype; v_item_count int:=0; v_pickup_count int:=0;
  v_commitment_count int:=0; v_order_count int:=0; v_quote_count int:=0; v_allowed boolean:=false; r record;
  v_qty int; v_best_quote uuid; v_best_threshold int; v_best_ceiling numeric;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update;
  if not found then raise exception 'Pool not found'; end if;
  select count(*) into v_item_count from public.pool_items where pool_id=p_pool_id and active;
  select count(*) into v_pickup_count from public.pool_pickup_points where pool_id=p_pool_id;
  select count(*) into v_commitment_count from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  select count(*) into v_order_count from public.orders where pool_id=p_pool_id and status<>'cancelled';
  select count(*) into v_quote_count from public.supplier_quotes q join public.pool_items pi on pi.id=q.pool_item_id where pi.pool_id=p_pool_id and q.quote_phase='final';

  if p_status='draft' then
    if v_pool.status not in ('open','pricing') then raise exception 'Only Open or Pricing pools can be returned to Draft'; end if;
    if v_commitment_count>0 or v_order_count>0 or v_quote_count>0 then raise exception 'Cannot return to Draft after commitments, supplier quotes, or orders exist'; end if;
    update public.pools set status='draft' where id=p_pool_id;
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to','draft','reason','safe_admin_reset'));
    return;
  end if;

  v_allowed := (v_pool.status='draft' and p_status in ('open','cancelled'))
    or (v_pool.status='open' and p_status in ('pricing','cancelled'))
    or (v_pool.status='pricing' and p_status in ('final_price','cancelled'))
    or (v_pool.status='final_price' and p_status in ('confirmation','cancelled'))
    or (v_pool.status='confirmation' and p_status in ('ordered','cancelled'))
    or (v_pool.status='ordered' and p_status in ('ready_for_pickup','cancelled'))
    or (v_pool.status='ready_for_pickup' and p_status in ('completed','cancelled'));
  if not v_allowed then raise exception 'Invalid pool transition: % -> %',v_pool.status,p_status; end if;
  if v_pool.status='draft' and p_status='open' then
    if v_item_count=0 then raise exception 'Add at least one product before opening this pool'; end if;
    if v_pickup_count=0 then raise exception 'Select at least one pickup option before opening this pool'; end if;
    if v_pool.receiving_pickup_point_id is null then raise exception 'Choose the designated supplier receiving point before opening'; end if;
    if not exists(select 1 from public.pool_pickup_points where pool_id=p_pool_id and pickup_point_id=v_pool.receiving_pickup_point_id) then
      raise exception 'The supplier receiving point must also be one of this pool''s pickup options';
    end if;
    if v_pool.commitment_closes_at is null or v_pool.confirmation_closes_at is null or v_pool.supplier_delivery_at is null or v_pool.pickup_at is null then
      raise exception 'Commitment close, confirmation close, supplier delivery and pickup start are required before opening';
    end if;
    if v_pool.opens_at is not null and v_pool.commitment_closes_at<=v_pool.opens_at then raise exception 'Commitment close must be after pool open time'; end if;
    if v_pool.commitment_closes_at<=now() then raise exception 'Commitment close must be in the future'; end if;
    if v_pool.confirmation_closes_at<=v_pool.commitment_closes_at then raise exception 'Confirmation close must be after commitment close'; end if;
    if v_pool.supplier_delivery_at<=v_pool.confirmation_closes_at then raise exception 'Supplier delivery must be after customer confirmation closes'; end if;
    if v_pool.supplier_delivery_at>=v_pool.pickup_at then raise exception 'Supplier delivery must be before customer pickup starts'; end if;
    if exists(
      select 1 from public.pool_items pi where pi.pool_id=p_pool_id and pi.active
      and not exists(select 1 from public.supplier_quotes q where q.pool_item_id=pi.id and q.quote_phase='planning_tier' and (q.valid_until is null or q.valid_until>=current_date))
    ) then raise exception 'Every active pool item needs at least one planning price tier before opening'; end if;
  end if;

  if v_pool.status='open' and p_status='pricing' then
    if v_commitment_count=0 then raise exception 'No customer commitments exist. Keep the pool open or cancel it instead of moving to Pricing'; end if;
    for r in select id from public.pool_items where pool_id=p_pool_id and active loop
      perform private.refresh_pool_item_unlock(r.id);
      select coalesce(sum(quantity),0)::int into v_qty from public.commitments where pool_item_id=r.id and status in ('active','confirmed');
      select best_unlocked_tier_quote_id,best_unlocked_threshold,best_unlocked_customer_ceiling_price
      into v_best_quote,v_best_threshold,v_best_ceiling from public.pool_items where id=r.id;
      if v_qty=0 then
        update public.pool_items set frozen_committed_quantity=0,pricing_locked_at=now(),active=false where id=r.id;
      elsif v_best_ceiling is null then
        update public.pool_items set frozen_committed_quantity=v_qty,pricing_locked_at=now(),active=false where id=r.id;
        update public.commitments set status='cancelled' where pool_item_id=r.id and status='active';
      else
        update public.pool_items set frozen_committed_quantity=v_qty,frozen_tier_quote_id=v_best_quote,
          frozen_tier_threshold=v_best_threshold,frozen_customer_ceiling_price=v_best_ceiling,pricing_locked_at=now() where id=r.id;
      end if;
      insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
      values(v_user,'pool_item_demand_frozen','pool_item',r.id,jsonb_build_object('quantity',v_qty,'tier_quote_id',v_best_quote,'tier_threshold',v_best_threshold,'customer_ceiling',v_best_ceiling,'retired',v_qty=0 or v_best_ceiling is null));
    end loop;
    if not exists(select 1 from public.pool_items where pool_id=p_pool_id and active) then
      raise exception 'No pool item reached a valid price tier. Keep the pool open or cancel it.';
    end if;
  end if;
  if v_pool.status='pricing' and p_status='final_price' then
    if exists(select 1 from public.pool_items where pool_id=p_pool_id and active and (final_customer_price is null or selected_supplier_quote_id is null)) then
      raise exception 'Every active pool item needs a winning final supplier quote and final customer price';
    end if;
  end if;
  if v_pool.status='confirmation' and p_status='ordered' and v_order_count=0 then
    raise exception 'No confirmed customer orders exist. Do not move an empty pool to Ordered';
  end if;
  if v_pool.status='ordered' and p_status='ready_for_pickup' and exists(
    select 1 from public.pool_items pi
    left join public.supplier_receipts sr on sr.pool_item_id=pi.id and sr.supplier_quote_id=pi.selected_supplier_quote_id
    where pi.pool_id=p_pool_id and pi.active
      and (pi.selected_supplier_quote_id is null or sr.id is null or sr.status<>'received' or sr.received_quantity<sr.expected_quantity)
  ) then raise exception 'Required supplier deliveries must be fully received before customer pickup can start'; end if;

  update public.pools set status=p_status where id=p_pool_id;
  if p_status='ordered' then
    update public.orders set status='ordered' where pool_id=p_pool_id and status='confirmed';
    update public.commitments c set status='cancelled' from public.pool_items pi
      where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status='active';
  end if;
  if p_status='ready_for_pickup' then
    update public.orders set status='ready_for_pickup',ready_at=now() where pool_id=p_pool_id and status in ('confirmed','ordered');
    update public.fulfilments f set status='ready' from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status='pending';
  end if;
  if p_status='cancelled' then
    update public.orders set status='cancelled',cancelled_at=now(),cancellation_reason=coalesce(cancellation_reason,'Pool cancelled by operations')
      where pool_id=p_pool_id and status<>'completed';
    update public.fulfilments f set status='cancelled' from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status<>'collected';
    update public.commitments c set status='cancelled' from public.pool_items pi
      where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  end if;
  if p_status='completed' and exists(select 1 from public.orders where pool_id=p_pool_id and status not in ('completed','cancelled')) then
    raise exception 'All orders must be completed or cancelled';
  end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to',p_status));
end; $$;
revoke all on function public.admin_set_pool_status(uuid,text) from public,anon;
grant execute on function public.admin_set_pool_status(uuid,text) to authenticated;
create or replace function public.record_supplier_receipt(p_pool_item_id uuid,p_received_quantity integer,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_item public.pool_items%rowtype; v_pool public.pools%rowtype; v_quote public.supplier_quotes%rowtype;
  v_id uuid; v_status text; v_existing_issue uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.pool_items where id=p_pool_item_id and active for update;
  if not found then raise exception 'Pool item not found'; end if;
  select * into v_pool from public.pools where id=v_item.pool_id;
  if v_pool.status not in ('ordered','ready_for_pickup') then raise exception 'Supplier receipt is recorded after the pool is Ordered'; end if;
  if not (private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin') or
    (private.has_role(v_user,'pickup_operator') and v_pool.receiving_pickup_point_id is not null and private.is_assigned_pickup(v_user,v_pool.receiving_pickup_point_id))) then
    raise exception 'Receiving assignment required';
  end if;
  if p_received_quantity<0 then raise exception 'Received quantity cannot be negative'; end if;
  select * into v_quote from public.supplier_quotes where id=v_item.selected_supplier_quote_id and pool_item_id=v_item.id and quote_phase='final';
  if not found then raise exception 'Selected final supplier quote not found'; end if;
  v_status:=case when p_received_quantity>=v_quote.quantity then 'received' else 'short' end;
  insert into public.supplier_receipts(pool_item_id,supplier_quote_id,expected_quantity,received_quantity,status,received_at,received_by,notes)
  values(v_item.id,v_quote.id,v_quote.quantity,p_received_quantity,v_status,now(),v_user,nullif(trim(p_notes),''))
  on conflict(pool_item_id) do update set supplier_quote_id=excluded.supplier_quote_id,expected_quantity=excluded.expected_quantity,
    received_quantity=excluded.received_quantity,status=excluded.status,received_at=now(),received_by=v_user,notes=excluded.notes,updated_at=now()
  returning id into v_id;
  if v_status='short' then
    select id into v_existing_issue from public.operational_issues where pool_id=v_pool.id and issue_type='supplier_shortage' and status in ('open','investigating') limit 1;
    if v_existing_issue is null then
      insert into public.operational_issues(pool_id,reported_by,issue_type,description)
      values(v_pool.id,v_user,'supplier_shortage','Supplier receipt short for pool item '||v_item.id||': expected '||v_quote.quantity||', received '||p_received_quantity);
    end if;
  end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'supplier_receipt_recorded','supplier_receipt',v_id,jsonb_build_object('pool_id',v_pool.id,'pool_item_id',v_item.id,'expected_quantity',v_quote.quantity,'received_quantity',p_received_quantity,'status',v_status));
  return v_id;
end; $$;
revoke all on function public.record_supplier_receipt(uuid,integer,text) from public,anon;
grant execute on function public.record_supplier_receipt(uuid,integer,text) to authenticated;
create or replace function public.mark_order_collected(p_order_id uuid,p_notes text default null)
returns numeric language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_order public.orders%rowtype; v_community uuid; v_total_saving numeric(12,2):=0;
  v_item record; v_amount numeric(12,2); v_completed_count int; v_referral public.referrals%rowtype; v_rewarded boolean:=false;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.is_assigned_pickup(v_user,v_order.pickup_point_id) then raise exception 'Pickup assignment required'; end if;
  if v_order.status<>'ready_for_pickup' then raise exception 'Order is not ready for pickup'; end if;
  if exists(select 1 from public.fulfilments where order_id=p_order_id and status='collected') then raise exception 'Order already collected'; end if;
  select community_id into v_community from public.pools where id=v_order.pool_id;

  update public.fulfilments set status='collected',collected_at=now(),collected_by=v_user,notes=p_notes where order_id=p_order_id;
  update public.orders set status='completed',completed_at=now() where id=p_order_id;
  for v_item in select * from public.order_items where order_id=p_order_id loop
    v_amount:=greatest(round((v_item.benchmark_price_snapshot-v_item.unit_price)*v_item.quantity,2),0);
    if v_amount>0 then
      insert into public.savings_ledger(customer_id,community_id,order_id,order_item_id,benchmark_price,pool_unit_price,fulfilled_quantity,amount,verified_at)
      values(v_order.customer_id,v_community,p_order_id,v_item.id,v_item.benchmark_price_snapshot,v_item.unit_price,v_item.quantity,v_amount,now())
      on conflict(order_item_id) do nothing;
      if found then v_total_saving:=v_total_saving+v_amount; end if;
    end if;
  end loop;

  select count(*) into v_completed_count from public.orders
    where customer_id=v_order.customer_id and status='completed' and payment_status<>'waived_test_order';
  if v_completed_count=1 and v_order.payment_status<>'waived_test_order' then
    select * into v_referral from public.referrals where referred_user_id=v_order.customer_id and status='pending' for update;
    if found then
      update public.referrals set status='rewarded',first_completed_order_id=p_order_id,rewarded_at=now() where id=v_referral.id and status='pending';
      if found then
        insert into public.coin_ledger(user_id,referral_id,event_key,coins,reason)
        values(v_referral.referrer_user_id,v_referral.id,'referral:first_collection:'||v_referral.id,10,'Successful neighbour first collected order')
        on conflict(referral_id) do nothing;
        if found then v_rewarded:=true; end if;
      end if;
    end if;
  end if;
  if v_rewarded then
    perform private.enqueue_notification(
      v_referral.referrer_user_id,'referral_reward','You earned 10 Coins',
      'Neighbour completed their first order — you earned 10 Coins.','/community',
      'referral:reward:'||v_referral.id,'normal',null,null
    );
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(v_user,'referral_rewarded','referral',v_referral.id,jsonb_build_object('referrer_user_id',v_referral.referrer_user_id,'referred_user_id',v_order.customer_id,'coins',10,'order_id',p_order_id));
  end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pickup_completed','order',p_order_id,jsonb_build_object('verified_saving',v_total_saving,'referral_rewarded',v_rewarded));
  return v_total_saving;
end; $$;
revoke all on function public.mark_order_collected(uuid,text) from public,anon;
grant execute on function public.mark_order_collected(uuid,text) to authenticated;

-- Automatic subscription billing is dormant while Pilot Mode is on.
create or replace function private.run_subscription_billing()
returns integer language plpgsql security definer set search_path='' as $$
declare v_cfg public.subscription_settings%rowtype; r record; v_count integer:=0; v_invoice uuid;
begin
  if private.is_pilot_mode() then return 0; end if;
  select * into v_cfg from public.subscription_settings where singleton=true;
  if coalesce(v_cfg.enforcement_enabled,false)=false or coalesce(v_cfg.monthly_price,0)<=0 then return 0; end if;
  for r in select p.id,m.valid_until from public.profiles p left join public.subscription_memberships m on m.user_id=p.id
    where p.onboarding_completed_at is not null and not private.has_role(p.id,'super_admin')
  loop
    if r.valid_until is null or r.valid_until<=now()+make_interval(days=>v_cfg.invoice_lead_days) then
      if not exists(select 1 from public.subscription_invoices i where i.customer_id=r.id and i.status in ('unpaid','payment_pending')) then
        begin
          insert into public.subscription_invoices(invoice_no,customer_id,period_start,period_end,amount,currency,due_at)
          values('SUB-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),r.id,
            greatest(now(),coalesce(r.valid_until,now())),greatest(now(),coalesce(r.valid_until,now()))+interval '1 month',
            v_cfg.monthly_price,v_cfg.currency,now()+make_interval(days=>v_cfg.due_days)) returning id into v_invoice;
          perform private.enqueue_notification(r.id,'subscription_invoice','Monthly membership bill ready','Your '||v_cfg.currency||' '||v_cfg.monthly_price||' membership invoice is ready.','/subscription','subscription:invoice:'||v_invoice,'high',null,null);
          v_count:=v_count+1;
        exception when unique_violation then null; end;
      end if;
    end if;
    if r.valid_until is not null and r.valid_until>now() and r.valid_until<=now()+interval '3 days' then
      perform private.enqueue_notification(r.id,'subscription_expiring','Membership expires soon','Renew or redeem a coupon before '||to_char(r.valid_until at time zone 'Asia/Dhaka','DD Mon YYYY')||' to keep joining pools.','/subscription','subscription:expiring:'||to_char(r.valid_until,'YYYYMMDD'),'high',null,null);
    elsif r.valid_until is not null and r.valid_until<=now() then
      perform private.enqueue_notification(r.id,'subscription_expired','Membership expired','Renew or redeem a coupon to join and confirm pool purchases.','/subscription','subscription:expired:'||to_char(r.valid_until,'YYYYMMDD'),'high',null,null);
    end if;
  end loop;
  return v_count;
end; $$;
revoke all on function private.run_subscription_billing() from public;
create or replace function public.get_assigned_supplier_deliveries()
returns table(pool_item_id uuid,pool_id uuid,pool_title text,product_name text,package_size text,expected_quantity integer,received_quantity integer,receipt_status text,supplier_delivery_at timestamptz,receiving_point_name text)
language sql stable security definer set search_path='' as $$
  select pi.id,po.id,po.title,pr.name,pr.package_size,q.quantity,
    coalesce(sr.received_quantity,0),coalesce(sr.status,'awaiting'),po.supplier_delivery_at,pp.name
  from public.pool_items pi
  join public.pools po on po.id=pi.pool_id
  join public.products pr on pr.id=pi.product_id
  join public.supplier_quotes q on q.id=pi.selected_supplier_quote_id and q.quote_phase='final'
  join public.pickup_points pp on pp.id=po.receiving_pickup_point_id
  left join public.supplier_receipts sr on sr.pool_item_id=pi.id and sr.supplier_quote_id=q.id
  where po.status in ('ordered','ready_for_pickup') and pi.active
    and (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin') or private.is_assigned_pickup(auth.uid(),po.receiving_pickup_point_id))
  order by po.supplier_delivery_at nulls last,po.title,pr.name;
$$;
revoke all on function public.get_assigned_supplier_deliveries() from public,anon;
grant execute on function public.get_assigned_supplier_deliveries() to authenticated;

-- Direct customer billing is also blocked while Pilot Mode is active.
create or replace function public.create_my_subscription_invoice()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_cfg public.subscription_settings%rowtype; v_current timestamptz; v_start timestamptz; v_end timestamptz; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if private.is_pilot_mode() then raise exception 'Membership billing is dormant during Pilot Mode'; end if;
  select * into v_cfg from public.subscription_settings where singleton=true;
  if v_cfg.monthly_price is null or v_cfg.monthly_price<=0 then raise exception 'Monthly subscription price is not configured yet'; end if;
  select valid_until into v_current from public.subscription_memberships where user_id=v_user;
  v_start:=greatest(now(),coalesce(v_current,now())); v_end:=v_start+interval '1 month';
  select id into v_id from public.subscription_invoices where customer_id=v_user and status in ('unpaid','payment_pending') order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.subscription_invoices(invoice_no,customer_id,period_start,period_end,amount,currency,due_at)
  values('SUB-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),v_user,v_start,v_end,v_cfg.monthly_price,v_cfg.currency,now()+make_interval(days=>v_cfg.due_days)) returning id into v_id;
  perform private.enqueue_notification(v_user,'subscription_invoice','Monthly membership bill ready','Your '||v_cfg.currency||' '||v_cfg.monthly_price||' membership invoice is ready.','/subscription','subscription:invoice:'||v_id,'high',null,null);
  return v_id;
end; $$;
revoke all on function public.create_my_subscription_invoice() from public,anon;
grant execute on function public.create_my_subscription_invoice() to authenticated;


-- Pilot mode cannot accidentally turn paid membership enforcement on.
update public.subscription_settings set enforcement_enabled=false where singleton=true;
create or replace function public.admin_update_subscription_settings(p_monthly_price numeric,p_enforcement_enabled boolean,p_payment_instructions text,p_invoice_lead_days integer default 7,p_due_days integer default 7)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required'; end if;
  if p_monthly_price is null or p_monthly_price<=0 then raise exception 'Monthly price must be greater than zero'; end if;
  update public.subscription_settings
  set monthly_price=p_monthly_price,
      enforcement_enabled=case when private.is_pilot_mode() then false else p_enforcement_enabled end,
      payment_instructions=nullif(trim(p_payment_instructions),''),
      invoice_lead_days=greatest(0,least(30,p_invoice_lead_days)),due_days=greatest(0,least(30,p_due_days)),updated_at=now(),updated_by=auth.uid()
  where singleton=true;
end; $$;
revoke all on function public.admin_update_subscription_settings(numeric,boolean,text,integer,integer) from public,anon;
grant execute on function public.admin_update_subscription_settings(numeric,boolean,text,integer,integer) to authenticated;
