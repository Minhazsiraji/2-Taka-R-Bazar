-- 2-TAKA-R-BAZAR commercial restructure:
-- no subscription gate, explicit procurement economics, and separate fulfilment/delivery charges.

-- Subscription infrastructure is retained for historical records only. It can no longer gate shopping.
update public.subscription_settings
set enforcement_enabled=false, updated_at=now()
where singleton=true;

create or replace function private.has_active_subscription(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_user is not null;
$$;
revoke all on function private.has_active_subscription(uuid) from public;

create or replace function private.run_subscription_billing()
returns integer language sql security definer set search_path='' as $$
  select 0;
$$;
revoke all on function private.run_subscription_billing() from public;

-- Retire the historical subscription mutation/read RPC surface. Tables remain for audit history only.
revoke all on function public.get_my_subscription_status() from public,anon,authenticated;
revoke all on function public.redeem_subscription_coupon(text) from public,anon,authenticated;
revoke all on function public.submit_subscription_payment_reference(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.admin_update_subscription_settings(numeric,boolean,text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_create_subscription_coupon(text,integer,integer,timestamptz,text) from public,anon,authenticated;
revoke all on function public.admin_mark_subscription_invoice_paid(uuid,text,text,text) from public,anon,authenticated;
do $$ begin perform cron.unschedule('2taka-subscription-billing'); exception when others then null; end $$;

create or replace function public.create_my_subscription_invoice()
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  raise exception 'Membership billing is retired. 2-TAKA-R-BAZAR has no subscription fee.';
end; $$;
revoke all on function public.create_my_subscription_invoice() from public,anon,authenticated;

-- Supplier-pool commercial snapshots. These stay private behind existing pool_items RLS/admin UI.
alter table public.pool_items add column if not exists variable_cost_per_unit numeric(12,2) not null default 0;
alter table public.pool_items add column if not exists supplier_rebate_per_unit numeric(12,2) not null default 0;
alter table public.pool_items add column if not exists brand_support_per_unit numeric(12,2) not null default 0;
alter table public.pool_items add column if not exists effective_cost_per_unit numeric(12,2);
alter table public.pool_items add column if not exists platform_margin_per_unit numeric(12,2);
alter table public.pool_items add column if not exists customer_saving_per_unit numeric(12,2);
alter table public.pool_items add column if not exists commercialized_at timestamptz;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='pool_items_variable_cost_nonnegative') then
    alter table public.pool_items add constraint pool_items_variable_cost_nonnegative check(variable_cost_per_unit>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='pool_items_supplier_rebate_nonnegative') then
    alter table public.pool_items add constraint pool_items_supplier_rebate_nonnegative check(supplier_rebate_per_unit>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='pool_items_brand_support_nonnegative') then
    alter table public.pool_items add constraint pool_items_brand_support_nonnegative check(brand_support_per_unit>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='pool_items_effective_cost_nonnegative') then
    alter table public.pool_items add constraint pool_items_effective_cost_nonnegative check(effective_cost_per_unit is null or effective_cost_per_unit>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='pool_items_platform_margin_nonnegative') then
    alter table public.pool_items add constraint pool_items_platform_margin_nonnegative check(platform_margin_per_unit is null or platform_margin_per_unit>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='pool_items_customer_saving_nonnegative') then
    alter table public.pool_items add constraint pool_items_customer_saving_nonnegative check(customer_saving_per_unit is null or customer_saving_per_unit>=0);
  end if;
end $$;

-- Orders separate product economics from the optional customer delivery service.
alter table public.orders alter column pickup_point_id drop not null;
alter table public.orders add column if not exists fulfillment_method text not null default 'pickup';
alter table public.orders add column if not exists product_subtotal numeric(12,2) not null default 0;
alter table public.orders add column if not exists delivery_fee numeric(12,2) not null default 0;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_actual_cost numeric(12,2);

do $$ begin
  if not exists(select 1 from pg_constraint where conname='orders_fulfillment_method_check') then
    alter table public.orders add constraint orders_fulfillment_method_check check(fulfillment_method in ('pickup','home_delivery'));
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_product_subtotal_nonnegative') then
    alter table public.orders add constraint orders_product_subtotal_nonnegative check(product_subtotal>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_delivery_fee_nonnegative') then
    alter table public.orders add constraint orders_delivery_fee_nonnegative check(delivery_fee>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_delivery_actual_cost_nonnegative') then
    alter table public.orders add constraint orders_delivery_actual_cost_nonnegative check(delivery_actual_cost is null or delivery_actual_cost>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_fulfillment_destination_check') then
    alter table public.orders add constraint orders_fulfillment_destination_check check(
      (fulfillment_method='pickup' and pickup_point_id is not null and delivery_address is null)
      or (fulfillment_method='home_delivery' and pickup_point_id is null and nullif(btrim(coalesce(delivery_address,'')),'') is not null)
    ) not valid;
  end if;
end $$;

update public.orders
set fulfillment_method='pickup', product_subtotal=total_amount, delivery_fee=0, delivery_address=null
where fulfillment_method='pickup' and product_subtotal=0 and total_amount>=0;

alter table public.fulfilments alter column pickup_point_id drop not null;
alter table public.fulfilments add column if not exists fulfillment_method text not null default 'pickup';
alter table public.fulfilments add column if not exists delivery_address text;
alter table public.fulfilments add column if not exists delivery_fee numeric(12,2) not null default 0;

alter table public.fulfilments drop constraint if exists fulfilments_status_check;
alter table public.fulfilments add constraint fulfilments_status_check
  check(status in ('pending','ready','collected','delivered','issue','cancelled'));

do $$ begin
  if not exists(select 1 from pg_constraint where conname='fulfilments_fulfillment_method_check') then
    alter table public.fulfilments add constraint fulfilments_fulfillment_method_check check(fulfillment_method in ('pickup','home_delivery'));
  end if;
  if not exists(select 1 from pg_constraint where conname='fulfilments_delivery_fee_nonnegative') then
    alter table public.fulfilments add constraint fulfilments_delivery_fee_nonnegative check(delivery_fee>=0);
  end if;
end $$;

update public.fulfilments f
set fulfillment_method=o.fulfillment_method,
    delivery_address=o.delivery_address,
    delivery_fee=o.delivery_fee
from public.orders o
where o.id=f.order_id;

create or replace function private.delivery_fee(p_fulfillment_method text,p_product_subtotal numeric)
returns numeric language plpgsql immutable set search_path='' as $$
begin
  if p_fulfillment_method='pickup' then return 0; end if;
  if p_fulfillment_method<>'home_delivery' then raise exception 'Invalid fulfilment method'; end if;
  if coalesce(p_product_subtotal,0)<=1000 then return 20; end if;
  return 30;
end; $$;
revoke all on function private.delivery_fee(text,numeric) from public;

create or replace function private.refresh_order_totals(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_subtotal numeric(12,2); v_method text; v_fee numeric(12,2);
begin
  select fulfillment_method into v_method from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select coalesce(round(sum(unit_price*quantity),2),0) into v_subtotal from public.order_items where order_id=p_order_id;
  v_fee:=private.delivery_fee(v_method,v_subtotal);
  update public.orders
    set product_subtotal=v_subtotal,delivery_fee=v_fee,total_amount=v_subtotal+v_fee,updated_at=now()
    where id=p_order_id;
  update public.fulfilments
    set delivery_fee=v_fee,updated_at=now()
    where order_id=p_order_id;
end; $$;
revoke all on function private.refresh_order_totals(uuid) from public;

-- Shopping is community access, not membership access.
create or replace function public.commit_to_pool(p_pool_item_id uuid,p_quantity integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_commitment uuid; v_pool_status text; v_pool_community uuid; v_user_community uuid; v_max integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
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
  values(v_user,'commitment_upserted','commitment',v_commitment,jsonb_build_object('quantity',p_quantity,'business_model','procurement_margin'));
  return v_commitment;
end; $$;
revoke all on function public.commit_to_pool(uuid,integer) from public,anon;
grant execute on function public.commit_to_pool(uuid,integer) to authenticated;

-- New commercial finalisation API. Supplier landed cost and commercial support are private.
create or replace function public.admin_finalize_pool_item(
  p_pool_item_id uuid,
  p_quote_id uuid,
  p_final_customer_price numeric,
  p_variable_cost_per_unit numeric,
  p_supplier_rebate_per_unit numeric,
  p_brand_support_per_unit numeric,
  p_reason text
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_item public.pool_items%rowtype; v_quote public.supplier_quotes%rowtype; v_pool_status text;
  v_variable numeric(12,2):=round(coalesce(p_variable_cost_per_unit,0),2);
  v_rebate numeric(12,2):=round(coalesce(p_supplier_rebate_per_unit,0),2);
  v_brand numeric(12,2):=round(coalesce(p_brand_support_per_unit,0),2);
  v_effective numeric(12,2); v_margin numeric(12,2); v_saving numeric(12,2);
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  if p_final_customer_price is null or p_final_customer_price<=0 then raise exception 'Final customer price must be positive'; end if;
  if v_variable<0 or v_rebate<0 or v_brand<0 then raise exception 'Commercial cost/rebate/support values cannot be negative'; end if;
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
  v_effective:=round(v_quote.landed_unit_price+v_variable-v_rebate-v_brand,2);
  if v_effective<0 then raise exception 'Confirmed rebate/support cannot make effective product cost negative'; end if;
  if p_final_customer_price<v_effective then raise exception 'Final customer price cannot be below effective product cost of %',v_effective; end if;
  if p_final_customer_price>v_item.benchmark_price_snapshot then raise exception 'Final customer price cannot exceed the verified market benchmark of %',v_item.benchmark_price_snapshot; end if;
  if v_item.frozen_customer_ceiling_price is not null and p_final_customer_price>v_item.frozen_customer_ceiling_price then
    raise exception 'Final customer price cannot exceed the unlocked ceiling of %',v_item.frozen_customer_ceiling_price;
  end if;
  v_margin:=round(p_final_customer_price-v_effective,2);
  v_saving:=greatest(round(v_item.benchmark_price_snapshot-p_final_customer_price,2),0);
  update public.supplier_quotes set selected=false,selection_reason=null where pool_item_id=p_pool_item_id and quote_phase='final';
  update public.supplier_quotes set selected=true,selection_reason=nullif(trim(p_reason),'') where id=p_quote_id;
  update public.pool_items set
    selected_supplier_quote_id=p_quote_id,final_customer_price=p_final_customer_price,
    variable_cost_per_unit=v_variable,supplier_rebate_per_unit=v_rebate,brand_support_per_unit=v_brand,
    effective_cost_per_unit=v_effective,platform_margin_per_unit=v_margin,customer_saving_per_unit=v_saving,commercialized_at=now()
  where id=p_pool_item_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'pool_item_finalized','pool_item',p_pool_item_id,jsonb_build_object(
    'quote_id',p_quote_id,'frozen_quantity',v_item.frozen_committed_quantity,'frozen_ceiling',v_item.frozen_customer_ceiling_price,
    'benchmark',v_item.benchmark_price_snapshot,'supplier_landed_unit_price',v_quote.landed_unit_price,
    'variable_cost_per_unit',v_variable,'supplier_rebate_per_unit',v_rebate,'brand_support_per_unit',v_brand,
    'effective_cost_per_unit',v_effective,'final_customer_price',p_final_customer_price,
    'customer_saving_per_unit',v_saving,'platform_margin_per_unit',v_margin,
    'projected_customer_saving',round(v_saving*v_item.frozen_committed_quantity,2),
    'projected_platform_margin',round(v_margin*v_item.frozen_committed_quantity,2),'reason',p_reason));
end; $$;
revoke all on function public.admin_finalize_pool_item(uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.admin_finalize_pool_item(uuid,uuid,numeric,numeric,numeric,numeric,text) to authenticated;

-- Keep the old signature only as a fail-closed compatibility stub so commercial cost layers cannot be bypassed.
create or replace function public.admin_finalize_pool_item(p_pool_item_id uuid,p_quote_id uuid,p_final_customer_price numeric,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Legacy finalization API retired. Use the commercial margin engine with explicit operating cost, rebate and brand-support inputs.';
end; $$;
revoke all on function public.admin_finalize_pool_item(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.admin_finalize_pool_item(uuid,uuid,numeric,text) to authenticated;

-- Final confirmation snapshots either FREE pickup or paid home delivery for the whole basket.
drop function if exists public.confirm_commitment_order(uuid);
drop function if exists public.confirm_commitment_order(uuid,uuid);
create function public.confirm_commitment_order(
  p_commitment_id uuid,
  p_fulfillment_method text,
  p_pickup_point_id uuid default null,
  p_delivery_address text default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_c public.commitments%rowtype; v_pi public.pool_items%rowtype;
  v_pool public.pools%rowtype; v_profile public.profiles%rowtype; v_order_id uuid; v_order_status text;
  v_order_item_id uuid; v_pickup uuid; v_method text:=lower(trim(coalesce(p_fulfillment_method,'')));
  v_address text:=nullif(btrim(coalesce(p_delivery_address,'')),''); v_existing_method text; v_existing_address text;
  v_saving numeric(12,2); v_subtotal numeric(12,2); v_fee numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_method not in ('pickup','home_delivery') then raise exception 'Choose pickup or home delivery'; end if;
  select * into v_c from public.commitments where id=p_commitment_id and customer_id=v_user for update;
  if not found or v_c.status<>'active' then raise exception 'Active commitment not found'; end if;
  select * into v_pi from public.pool_items where id=v_c.pool_item_id;
  select * into v_pool from public.pools where id=v_pi.pool_id;
  if v_pool.status<>'confirmation' then raise exception 'Pool is not in confirmation'; end if;
  if v_pi.final_customer_price is null then raise exception 'Final price is not published'; end if;
  select * into v_profile from public.profiles where id=v_user;
  if v_profile.community_id is distinct from v_pool.community_id then raise exception 'Community mismatch'; end if;

  select id,pickup_point_id,status,fulfillment_method,delivery_address
    into v_order_id,v_pickup,v_order_status,v_existing_method,v_existing_address
  from public.orders where customer_id=v_user and pool_id=v_pool.id for update;
  if found then
    if v_order_status<>'confirmed' then raise exception 'Existing order is no longer accepting confirmation'; end if;
    if v_existing_method<>v_method then raise exception 'This Pool basket already uses %. Keep one fulfilment method for the whole basket.',replace(v_existing_method,'_',' '); end if;
    v_method:=v_existing_method; v_address:=v_existing_address;
  else
    if v_method='pickup' then
      v_pickup:=p_pickup_point_id;
      if v_pickup is null or not exists(
        select 1 from public.pickup_points pp join public.pool_pickup_points ppp on ppp.pickup_point_id=pp.id
        where ppp.pool_id=v_pool.id and pp.id=v_pickup and pp.community_id=v_pool.community_id and pp.active=true
      ) then raise exception 'Choose one of the pickup points enabled for this pool'; end if;
      v_address:=null;
    else
      v_pickup:=null;
      if v_address is null or length(v_address)<5 then raise exception 'Enter a home-delivery address inside your community'; end if;
    end if;
    insert into public.orders(customer_id,pool_id,pickup_point_id,fulfillment_method,delivery_address,status,payment_status,product_subtotal,delivery_fee,total_amount,confirmed_at)
    values(v_user,v_pool.id,v_pickup,v_method,v_address,'confirmed','unpaid',0,0,0,now()) returning id into v_order_id;
    insert into public.fulfilments(order_id,pickup_point_id,fulfillment_method,delivery_address,delivery_fee,status)
    values(v_order_id,v_pickup,v_method,v_address,0,'pending');
  end if;

  v_saving:=greatest(round((v_pi.benchmark_price_snapshot-v_pi.final_customer_price)*v_c.quantity,2),0);
  insert into public.order_items(order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price,expected_saving)
  values(v_order_id,v_pi.id,v_pi.product_id,v_c.quantity,v_pi.benchmark_price_snapshot,v_pi.final_customer_price,v_saving)
  on conflict(order_id,pool_item_id) do nothing returning id into v_order_item_id;
  if v_order_item_id is null then raise exception 'This commitment is already confirmed'; end if;
  perform private.reserve_own_inventory(v_order_item_id);
  update public.commitments set status='confirmed',confirmed_at=now() where id=v_c.id;
  perform private.refresh_order_totals(v_order_id);
  select product_subtotal,delivery_fee into v_subtotal,v_fee from public.orders where id=v_order_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'order_item_confirmed','order',v_order_id,jsonb_build_object(
    'commitment_id',v_c.id,'order_item_id',v_order_item_id,'fulfillment_method',v_method,
    'pickup_point_id',v_pickup,'product_subtotal',v_subtotal,'delivery_fee',v_fee,'expected_product_saving',v_saving));
  return v_order_id;
end; $$;
revoke all on function public.confirm_commitment_order(uuid,text,uuid,text) from public,anon;
grant execute on function public.confirm_commitment_order(uuid,text,uuid,text) to authenticated;

-- Shared completion accounting keeps verified product savings independent from delivery charges.
create or replace function private.complete_order_accounting(p_order_id uuid,p_event_type text)
returns numeric language plpgsql security definer set search_path='' as $$
declare
  v_order public.orders%rowtype; v_community uuid; v_total_saving numeric(12,2):=0; v_item record; v_amount numeric(12,2);
  v_completed_count int; v_referral public.referrals%rowtype; v_rewarded boolean:=false;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status='completed' then return 0; end if;
  if v_order.status<>'ready_for_pickup' then raise exception 'Order is not ready for fulfilment'; end if;
  select community_id into v_community from public.pools where id=v_order.pool_id;
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
  select count(*) into v_completed_count from public.orders where customer_id=v_order.customer_id and status='completed' and payment_status<>'waived_test_order';
  if v_completed_count=1 and v_order.payment_status<>'waived_test_order' then
    select * into v_referral from public.referrals where referred_user_id=v_order.customer_id and status='pending' for update;
    if found then
      update public.referrals set status='rewarded',first_completed_order_id=p_order_id,rewarded_at=now() where id=v_referral.id and status='pending';
      if found then
        insert into public.coin_ledger(user_id,referral_id,event_key,coins,reason)
        values(v_referral.referrer_user_id,v_referral.id,'referral:first_collection:'||v_referral.id,10,'Successful neighbour first completed order')
        on conflict(referral_id) do nothing;
        if found then v_rewarded:=true; end if;
      end if;
    end if;
  end if;
  if v_rewarded then
    perform private.enqueue_notification(v_referral.referrer_user_id,'referral_reward','You earned 10 Coins','Neighbour completed their first order — you earned 10 Coins.','/community','referral:reward:'||v_referral.id,'normal',null,null);
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(auth.uid(),'referral_rewarded','referral',v_referral.id,jsonb_build_object('referrer_user_id',v_referral.referrer_user_id,'referred_user_id',v_order.customer_id,'coins',10,'order_id',p_order_id));
  end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(auth.uid(),p_event_type,'order',p_order_id,jsonb_build_object('verified_product_saving',v_total_saving,'delivery_fee',v_order.delivery_fee,'fulfillment_method',v_order.fulfillment_method,'referral_rewarded',v_rewarded));
  return v_total_saving;
end; $$;
revoke all on function private.complete_order_accounting(uuid,text) from public;

create or replace function public.mark_order_collected(p_order_id uuid,p_notes text default null)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.fulfillment_method<>'pickup' or v_order.pickup_point_id is null then raise exception 'This order is not a pickup order'; end if;
  if not private.is_assigned_pickup(v_user,v_order.pickup_point_id) then raise exception 'Pickup assignment required'; end if;
  if v_order.status<>'ready_for_pickup' then raise exception 'Order is not ready for pickup'; end if;
  if exists(select 1 from public.fulfilments where order_id=p_order_id and status in ('collected','delivered')) then raise exception 'Order already fulfilled'; end if;
  update public.fulfilments set status='collected',collected_at=now(),collected_by=v_user,notes=p_notes,updated_at=now() where order_id=p_order_id;
  return private.complete_order_accounting(p_order_id,'pickup_completed');
end; $$;
revoke all on function public.mark_order_collected(uuid,text) from public,anon;
grant execute on function public.mark_order_collected(uuid,text) to authenticated;

create or replace function public.admin_mark_order_delivered(p_order_id uuid,p_actual_delivery_cost numeric,p_notes text default null)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype; v_actual numeric(12,2);
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  if p_actual_delivery_cost is null or p_actual_delivery_cost<0 then raise exception 'Actual delivery cost is required and cannot be negative'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.fulfillment_method<>'home_delivery' then raise exception 'This order is not a home-delivery order'; end if;
  if v_order.status<>'ready_for_pickup' then raise exception 'Order is not ready for delivery'; end if;
  if exists(select 1 from public.fulfilments where order_id=p_order_id and status in ('collected','delivered')) then raise exception 'Order already fulfilled'; end if;
  v_actual:=round(p_actual_delivery_cost,2);
  update public.orders set delivery_actual_cost=v_actual,updated_at=now() where id=p_order_id;
  update public.fulfilments set status='delivered',collected_at=now(),collected_by=v_user,notes=p_notes,updated_at=now() where order_id=p_order_id;
  return private.complete_order_accounting(p_order_id,'home_delivery_completed');
end; $$;
revoke all on function public.admin_mark_order_delivered(uuid,numeric,text) from public,anon;
grant execute on function public.admin_mark_order_delivered(uuid,numeric,text) to authenticated;

-- Own-product inventory leaves stock on both pickup collection and completed home delivery.
create or replace function private.fulfil_inventory_on_collection()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if new.status in ('collected','delivered') and old.status is distinct from new.status and old.status not in ('collected','delivered') then
    for r in select id from public.order_items where order_id=new.order_id loop perform private.fulfil_own_inventory(r.id); end loop;
  end if;
  return new;
end; $$;
revoke all on function private.fulfil_inventory_on_collection() from public;

-- Existing pickup rows now satisfy the stricter destination invariant; new home rows are validated too.
alter table public.orders validate constraint orders_fulfillment_destination_check;
