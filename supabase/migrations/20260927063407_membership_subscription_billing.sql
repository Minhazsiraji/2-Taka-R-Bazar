create table if not exists public.subscription_settings (
  singleton boolean primary key default true check (singleton),
  monthly_price numeric(10,2),
  currency text not null default 'BDT',
  invoice_lead_days integer not null default 7 check (invoice_lead_days between 0 and 30),
  due_days integer not null default 7 check (due_days between 0 and 30),
  enforcement_enabled boolean not null default false,
  payment_instructions text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.subscription_settings(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists public.subscription_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  valid_until timestamptz,
  source text,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  months_free integer not null check (months_free in (1,2,3)),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.subscription_coupons(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  months_granted integer not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  redeemed_at timestamptz not null default now(),
  unique(coupon_id,user_id)
);

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  customer_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'BDT',
  status text not null default 'unpaid' check (status in ('unpaid','payment_pending','paid','waived','cancelled')),
  due_at timestamptz not null,
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  customer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscription_invoices_customer_idx on public.subscription_invoices(customer_id,created_at desc);

alter table public.subscription_settings enable row level security;
alter table public.subscription_memberships enable row level security;
alter table public.subscription_coupons enable row level security;
alter table public.subscription_coupon_redemptions enable row level security;
alter table public.subscription_invoices enable row level security;

drop policy if exists subscription_settings_read on public.subscription_settings;
create policy subscription_settings_read on public.subscription_settings for select to authenticated using (true);
drop policy if exists subscription_membership_read on public.subscription_memberships;
create policy subscription_membership_read on public.subscription_memberships for select to authenticated using (user_id=auth.uid() or private.has_role(auth.uid(),'super_admin'));
drop policy if exists subscription_coupon_admin_read on public.subscription_coupons;
create policy subscription_coupon_admin_read on public.subscription_coupons for select to authenticated using (private.has_role(auth.uid(),'super_admin'));
drop policy if exists subscription_redemption_read on public.subscription_coupon_redemptions;
create policy subscription_redemption_read on public.subscription_coupon_redemptions for select to authenticated using (user_id=auth.uid() or private.has_role(auth.uid(),'super_admin'));
drop policy if exists subscription_invoice_read on public.subscription_invoices;
create policy subscription_invoice_read on public.subscription_invoices for select to authenticated using (customer_id=auth.uid() or private.has_role(auth.uid(),'super_admin'));

grant select on public.subscription_settings,public.subscription_memberships,public.subscription_coupon_redemptions,public.subscription_invoices to authenticated;
grant select on public.subscription_coupons to authenticated;
revoke insert,update,delete on public.subscription_settings,public.subscription_memberships,public.subscription_coupons,public.subscription_coupon_redemptions,public.subscription_invoices from authenticated;

create or replace function private.has_active_subscription(p_user uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_enforced boolean; v_valid timestamptz;
begin
  if p_user is null then return false; end if;
  if private.has_role(p_user,'super_admin') then return true; end if;
  select enforcement_enabled into v_enforced from public.subscription_settings where singleton=true;
  if coalesce(v_enforced,false)=false then return true; end if;
  select valid_until into v_valid from public.subscription_memberships where user_id=p_user;
  return v_valid is not null and v_valid>now();
end; $$;
revoke all on function private.has_active_subscription(uuid) from public;

create or replace function public.get_my_subscription_status()
returns table(enforcement_enabled boolean,monthly_price numeric,currency text,valid_until timestamptz,active boolean,source text)
language sql stable security definer set search_path='' as $$
  select s.enforcement_enabled,s.monthly_price,s.currency,m.valid_until,private.has_active_subscription(auth.uid()),m.source
  from public.subscription_settings s left join public.subscription_memberships m on m.user_id=auth.uid()
  where s.singleton=true;
$$;
revoke all on function public.get_my_subscription_status() from public,anon;
grant execute on function public.get_my_subscription_status() to authenticated;

create or replace function public.redeem_subscription_coupon(p_code text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_coupon public.subscription_coupons%rowtype; v_start timestamptz; v_until timestamptz;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_coupon from public.subscription_coupons where upper(code)=upper(trim(p_code)) for update;
  if not found or not v_coupon.active then raise exception 'Coupon is not valid'; end if;
  if v_coupon.starts_at>now() or (v_coupon.expires_at is not null and v_coupon.expires_at<now()) then raise exception 'Coupon is not currently valid'; end if;
  if v_coupon.max_redemptions is not null and v_coupon.redeemed_count>=v_coupon.max_redemptions then raise exception 'Coupon redemption limit reached'; end if;
  if exists(select 1 from public.subscription_coupon_redemptions where coupon_id=v_coupon.id and user_id=v_user) then raise exception 'You already used this coupon'; end if;
  select greatest(now(),coalesce(valid_until,now())) into v_start from public.subscription_memberships where user_id=v_user;
  if v_start is null then v_start:=now(); end if;
  v_until:=v_start+make_interval(months=>v_coupon.months_free);
  insert into public.subscription_coupon_redemptions(coupon_id,user_id,months_granted,valid_from,valid_until) values(v_coupon.id,v_user,v_coupon.months_free,v_start,v_until);
  update public.subscription_coupons set redeemed_count=redeemed_count+1 where id=v_coupon.id;
  insert into public.subscription_memberships(user_id,valid_until,source,updated_at) values(v_user,v_until,'coupon:'||v_coupon.code,now())
  on conflict(user_id) do update set valid_until=excluded.valid_until,source=excluded.source,updated_at=now();
  update public.subscription_invoices set status='waived',updated_at=now(),admin_note='Covered by coupon redemption'
    where customer_id=v_user and status='unpaid' and period_end<=v_until;
  perform private.enqueue_notification(v_user,'subscription_coupon','Free membership activated',v_coupon.months_free||' month(s) of pool access are active.','/subscription','subscription:coupon:'||v_coupon.id,'normal',null,null);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'subscription_coupon_redeemed','subscription_coupon',v_coupon.id,jsonb_build_object('months',v_coupon.months_free,'valid_until',v_until));
  return v_until;
end; $$;
revoke all on function public.redeem_subscription_coupon(text) from public,anon;
grant execute on function public.redeem_subscription_coupon(text) to authenticated;

create or replace function public.create_my_subscription_invoice()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_cfg public.subscription_settings%rowtype; v_current timestamptz; v_start timestamptz; v_end timestamptz; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
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

create or replace function public.submit_subscription_payment_reference(p_invoice_id uuid,p_method text,p_reference text,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(p_method),'')='' or coalesce(trim(p_reference),'')='' then raise exception 'Payment method and reference are required'; end if;
  update public.subscription_invoices
  set status='payment_pending',payment_method=trim(p_method),payment_reference=trim(p_reference),customer_note=nullif(trim(p_note),''),updated_at=now()
  where id=p_invoice_id and customer_id=auth.uid() and status='unpaid';
  if not found then raise exception 'Unpaid invoice not found'; end if;
end; $$;
revoke all on function public.submit_subscription_payment_reference(uuid,text,text,text) from public,anon;
grant execute on function public.submit_subscription_payment_reference(uuid,text,text,text) to authenticated;

create or replace function public.admin_update_subscription_settings(p_monthly_price numeric,p_enforcement_enabled boolean,p_payment_instructions text,p_invoice_lead_days integer default 7,p_due_days integer default 7)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required'; end if;
  if p_monthly_price is null or p_monthly_price<=0 then raise exception 'Monthly price must be greater than zero'; end if;
  update public.subscription_settings
  set monthly_price=p_monthly_price,enforcement_enabled=p_enforcement_enabled,payment_instructions=nullif(trim(p_payment_instructions),''),
      invoice_lead_days=greatest(0,least(30,p_invoice_lead_days)),due_days=greatest(0,least(30,p_due_days)),updated_at=now(),updated_by=auth.uid()
  where singleton=true;
end; $$;
revoke all on function public.admin_update_subscription_settings(numeric,boolean,text,integer,integer) from public,anon;
grant execute on function public.admin_update_subscription_settings(numeric,boolean,text,integer,integer) to authenticated;

create or replace function public.admin_create_subscription_coupon(p_code text,p_months integer,p_max_redemptions integer default null,p_expires_at timestamptz default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_code text:=upper(regexp_replace(trim(p_code),'[^A-Za-z0-9_-]','','g'));
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required'; end if;
  if length(v_code)<4 then raise exception 'Coupon code must be at least 4 characters'; end if;
  if p_months not in (1,2,3) then raise exception 'Free coupon must grant 1, 2, or 3 months'; end if;
  insert into public.subscription_coupons(code,months_free,max_redemptions,expires_at,notes,created_by)
  values(v_code,p_months,p_max_redemptions,p_expires_at,nullif(trim(p_notes),''),auth.uid()) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.admin_create_subscription_coupon(text,integer,integer,timestamptz,text) from public,anon;
grant execute on function public.admin_create_subscription_coupon(text,integer,integer,timestamptz,text) to authenticated;
create or replace function public.admin_mark_subscription_invoice_paid(p_invoice_id uuid,p_method text,p_reference text,p_note text default null)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_invoice public.subscription_invoices%rowtype; v_until timestamptz;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'super_admin') then raise exception 'Super Admin required'; end if;
  select * into v_invoice from public.subscription_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status='paid' then return v_invoice.period_end; end if;
  if v_invoice.status not in ('unpaid','payment_pending') then raise exception 'Invoice cannot be marked paid'; end if;
  update public.subscription_invoices
  set status='paid',paid_at=now(),payment_method=coalesce(nullif(trim(p_method),''),payment_method),
      payment_reference=coalesce(nullif(trim(p_reference),''),payment_reference),admin_note=nullif(trim(p_note),''),updated_at=now()
  where id=p_invoice_id;
  insert into public.subscription_memberships(user_id,valid_until,source,updated_at)
  values(v_invoice.customer_id,v_invoice.period_end,'paid:'||v_invoice.invoice_no,now())
  on conflict(user_id) do update
    set valid_until=greatest(coalesce(public.subscription_memberships.valid_until,now()),excluded.valid_until),source=excluded.source,updated_at=now()
  returning valid_until into v_until;
  perform private.enqueue_notification(v_invoice.customer_id,'subscription_paid','Membership payment confirmed','Pool access is active until '||to_char(v_until at time zone 'Asia/Dhaka','DD Mon YYYY')||'.','/subscription','subscription:paid:'||p_invoice_id,'normal',null,null);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(auth.uid(),'subscription_invoice_paid','subscription_invoice',p_invoice_id,jsonb_build_object('customer_id',v_invoice.customer_id,'valid_until',v_until));
  return v_until;
end; $$;
revoke all on function public.admin_mark_subscription_invoice_paid(uuid,text,text,text) from public,anon;
grant execute on function public.admin_mark_subscription_invoice_paid(uuid,text,text,text) to authenticated;

create or replace function private.run_subscription_billing()
returns integer language plpgsql security definer set search_path='' as $$
declare v_cfg public.subscription_settings%rowtype; r record; v_count integer:=0; v_invoice uuid;
begin
  select * into v_cfg from public.subscription_settings where singleton=true;
  if coalesce(v_cfg.enforcement_enabled,false)=false or coalesce(v_cfg.monthly_price,0)<=0 then return 0; end if;
  for r in
    select p.id,m.valid_until from public.profiles p
    left join public.subscription_memberships m on m.user_id=p.id
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

do $$ begin perform cron.unschedule('2taka-subscription-billing'); exception when others then null; end $$;
select cron.schedule('2taka-subscription-billing','0 2 * * *',$$select private.run_subscription_billing();$$);

create or replace function public.commit_to_pool(p_pool_item_id uuid,p_quantity integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_commitment uuid; v_pool_status text; v_pool_community uuid; v_user_community uuid; v_max integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not private.has_active_subscription(v_user) then raise exception 'Active membership required. Pay your monthly subscription or redeem a valid free coupon.'; end if;
  if p_quantity<1 then raise exception 'Quantity must be positive'; end if;
  select po.status,po.community_id,pi.max_quantity into v_pool_status,v_pool_community,v_max
  from public.pool_items pi join public.pools po on po.id=pi.pool_id
  where pi.id=p_pool_item_id and pi.active=true;
  if not found then raise exception 'Pool item not found'; end if;
  if v_pool_status<>'open' then raise exception 'Pool is not accepting commitments'; end if;
  if p_quantity>v_max then raise exception 'Quantity exceeds pool limit'; end if;
  select community_id into v_user_community from public.profiles where id=v_user;
  if v_user_community is distinct from v_pool_community then raise exception 'Pool is outside your community'; end if;
  insert into public.commitments(pool_item_id,customer_id,quantity,status,committed_at)
  values(p_pool_item_id,v_user,p_quantity,'active',now())
  on conflict(pool_item_id,customer_id) do update
  set quantity=excluded.quantity,status='active',committed_at=now(),confirmed_at=null
  returning id into v_commitment;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'commitment_upserted','commitment',v_commitment,jsonb_build_object('quantity',p_quantity));
  return v_commitment;
end; $$;
revoke all on function public.commit_to_pool(uuid,integer) from public,anon;
grant execute on function public.commit_to_pool(uuid,integer) to authenticated;

create or replace function public.confirm_commitment_order(p_commitment_id uuid,p_pickup_point_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_c public.commitments%rowtype; v_pi public.pool_items%rowtype;
  v_pool public.pools%rowtype; v_profile public.profiles%rowtype; v_order_id uuid; v_order_status text;
  v_order_item_id uuid; v_pickup uuid; v_amount numeric(12,2); v_saving numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not private.has_active_subscription(v_user) then raise exception 'Active membership required. Renew or redeem a valid free coupon before confirming this purchase.'; end if;
  select * into v_c from public.commitments where id=p_commitment_id and customer_id=v_user for update;
  if not found or v_c.status<>'active' then raise exception 'Active commitment not found'; end if;
  select * into v_pi from public.pool_items where id=v_c.pool_item_id;
  select * into v_pool from public.pools where id=v_pi.pool_id;
  if v_pool.status<>'confirmation' then raise exception 'Pool is not in confirmation'; end if;
  if v_pi.final_customer_price is null then raise exception 'Final price is not published'; end if;
  select * into v_profile from public.profiles where id=v_user;
  if v_profile.community_id is distinct from v_pool.community_id then raise exception 'Community mismatch'; end if;
  select id,pickup_point_id,status into v_order_id,v_pickup,v_order_status
  from public.orders where customer_id=v_user and pool_id=v_pool.id for update;
  if found then
    if v_order_status<>'confirmed' then raise exception 'Existing order is no longer accepting confirmation'; end if;
  else
    v_pickup:=p_pickup_point_id;
    if v_pickup is null or not exists(
      select 1 from public.pickup_points pp join public.pool_pickup_points ppp on ppp.pickup_point_id=pp.id
      where ppp.pool_id=v_pool.id and pp.id=v_pickup and pp.community_id=v_pool.community_id and pp.active=true
    ) then raise exception 'Choose one of the pickup points enabled for this pool'; end if;
    insert into public.orders(customer_id,pool_id,pickup_point_id,status,payment_status,confirmed_at)
    values(v_user,v_pool.id,v_pickup,'confirmed','unpaid',now()) returning id into v_order_id;
  end if;
  v_amount:=round(v_pi.final_customer_price*v_c.quantity,2);
  v_saving:=greatest(round((v_pi.benchmark_price_snapshot-v_pi.final_customer_price)*v_c.quantity,2),0);
  insert into public.order_items(order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price,expected_saving)
  values(v_order_id,v_pi.id,v_pi.product_id,v_c.quantity,v_pi.benchmark_price_snapshot,v_pi.final_customer_price,v_saving)
  on conflict(order_id,pool_item_id) do nothing returning id into v_order_item_id;
  if v_order_item_id is null then raise exception 'This commitment is already confirmed'; end if;
  update public.orders set total_amount=total_amount+v_amount where id=v_order_id;
  update public.commitments set status='confirmed',confirmed_at=now() where id=v_c.id;
  insert into public.fulfilments(order_id,pickup_point_id,status)
  values(v_order_id,v_pickup,'pending') on conflict(order_id) do nothing;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'order_item_confirmed','order',v_order_id,
         jsonb_build_object('commitment_id',v_c.id,'order_item_id',v_order_item_id,'amount',v_amount,'pickup_point_id',v_pickup));
  return v_order_id;
end; $$;
revoke all on function public.confirm_commitment_order(uuid,uuid) from public,anon;
grant execute on function public.confirm_commitment_order(uuid,uuid) to authenticated;
