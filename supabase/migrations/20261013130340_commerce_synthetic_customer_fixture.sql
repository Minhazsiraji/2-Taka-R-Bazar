-- Operator-issued, expiring customer fixtures for a phone-free synthetic SOLO
-- checkout. No Auth/profile/role changes, verified-household or location grants.
create table private.commerce_uat_customer_fixtures(
 actor_id uuid primary key references auth.users(id) on delete restrict,
 community_id uuid not null references public.communities(id) on delete restrict,
 full_name text not null check(length(btrim(full_name)) between 2 and 100),
 household_name text not null check(length(btrim(household_name)) between 2 and 120),
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 reason text not null check(length(btrim(reason)) between 10 and 500),
 check(expires_at>issued_at and expires_at<=issued_at+interval '8 hours')
);
create table private.commerce_uat_fixture_offers(
 actor_id uuid not null references private.commerce_uat_customer_fixtures(actor_id) on delete cascade,
 offer_id uuid not null references public.commerce_offers(id) on delete restrict,
 primary key(actor_id,offer_id)
);
alter table private.commerce_uat_customer_fixtures enable row level security;
alter table private.commerce_uat_fixture_offers enable row level security;
revoke all on private.commerce_uat_customer_fixtures,private.commerce_uat_fixture_offers from public,anon,authenticated,service_role;

create function private.commerce_uat_customer_active(p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_actor is not null and p_actor=auth.uid() and exists(
  select 1 from private.commerce_uat_customer_fixtures f
  join private.commerce_uat_signin_leases l on l.actor_id=f.actor_id
  join auth.users u on u.id=f.actor_id
  join public.communities c on c.id=f.community_id
  where f.actor_id=p_actor and f.expires_at>clock_timestamp()
   and l.expires_at>clock_timestamp() and c.active
   and u.email like '%@example.invalid' and u.email_confirmed_at is not null
   and nullif(u.phone,'') is null and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=clock_timestamp())
 );
$$;
create function private.commerce_standard_customer(p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_actor is not null and p_actor=auth.uid() and exists(
  select 1 from public.profiles where id=p_actor and phone is not null
   and full_name is not null and household_name is not null
   and community_id is not null and onboarding_completed_at is not null);
$$;
create function private.commerce_customer_community(p_actor uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_community uuid;
begin
 if p_actor is null or p_actor<>auth.uid() then return null;end if;
 select community_id into v_community from public.profiles
 where id=p_actor and phone is not null and full_name is not null
  and household_name is not null and onboarding_completed_at is not null;
 if v_community is null and private.commerce_uat_customer_active(p_actor) then
  select community_id into v_community from private.commerce_uat_customer_fixtures where actor_id=p_actor;
 end if;
 return v_community;
end $$;
create function private.commerce_uat_offer_allowed(p_offer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.commerce_uat_customer_active(auth.uid()) and exists(
  select 1 from private.commerce_uat_fixture_offers a
  join private.commerce_uat_customer_fixtures f on f.actor_id=a.actor_id
  join public.commerce_offers o on o.id=a.offer_id
  where a.actor_id=auth.uid() and a.offer_id=p_offer and o.community_id=f.community_id
   and o.is_synthetic and o.status='approved' and o.mode='SOLO'
 );
$$;
create function public.commerce_uat_customer_context(p_proof text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.commerce_assert_preview(p_proof);
 if not private.commerce_uat_customer_active(auth.uid()) then return null;end if;
 return (select jsonb_build_object('id',actor_id,'full_name',full_name,
  'household_name',household_name,'community_id',community_id,'phone',null,
  'address_hint',null,'is_test_fixture',true)
  from private.commerce_uat_customer_fixtures where actor_id=auth.uid());
end $$;
revoke all on function private.commerce_standard_customer(uuid),private.commerce_uat_customer_active(uuid),private.commerce_customer_community(uuid),private.commerce_uat_offer_allowed(uuid),public.commerce_uat_customer_context(text) from public,anon,authenticated,service_role;
grant execute on function public.commerce_uat_customer_context(text) to authenticated;

create function private.commerce_uat_fixture_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(null,'commerce_uat_fixture_'||lower(tg_op),tg_table_name,
  case when tg_op='DELETE' then old.actor_id else new.actor_id end,
  jsonb_build_object('operator',session_user,
   'old',case when tg_op<>'INSERT' then to_jsonb(old) else null end,
   'new',case when tg_op<>'DELETE' then to_jsonb(new) else null end));
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.commerce_uat_fixture_audit() from public,anon,authenticated,service_role;
create trigger commerce_uat_customer_fixture_audit after insert or update or delete
 on private.commerce_uat_customer_fixtures for each row execute function private.commerce_uat_fixture_audit();
create trigger commerce_uat_fixture_offer_audit after insert or update or delete
 on private.commerce_uat_fixture_offers for each row execute function private.commerce_uat_fixture_audit();

-- Keep all price, stock, policy, idempotency and promotion checks in place.
create or replace function private.commerce_create_quote_legacy(p_guest text,p_method text,p_pickup uuid,p_address text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c uuid;u uuid:=auth.uid();v_community uuid;v_lines jsonb:='[]';r record;st jsonb;v_price numeric;v_sub numeric:=0;v_delivery numeric;v_quote public.commerce_quotes%rowtype;v_reference numeric;
begin
 perform private.commerce_assert_preview(p_proof);
 if u is null then raise exception 'Sign in to checkout';end if;
 v_community=private.commerce_customer_community(u);
 if v_community is null then raise exception 'Complete your household and community first';end if;
 perform public.commerce_get_cart(p_guest,p_proof); c=private.commerce_cart(p_guest);
 if p_method not in ('pickup','home_delivery') or p_method is null then raise exception 'Choose pickup or delivery';end if;
 if p_method='pickup' and not exists(select 1 from public.pickup_points where id=p_pickup and community_id=v_community and active) then raise exception 'Active community pickup point required';end if;
 if p_method='home_delivery' and length(btrim(coalesce(p_address,''))) not between 10 and 500 then raise exception 'Complete delivery address required';end if;
 for r in select ci.id as item_id,ci.quantity,ci.commitment_id,ci.group_commitment_id,o.*,s.product_id,s.sku,p.name from public.commerce_cart_items ci join public.commerce_offers o on o.id=ci.offer_id join public.commerce_skus s on s.id=o.sku_id join public.products p on p.id=s.product_id where ci.cart_id=c and ci.state='ready' order by o.sku_id,o.id loop
 if r.community_id<>v_community then raise exception 'Cart has an item outside your verified community';end if;
 if not r.is_synthetic then raise exception 'Production purchases remain disabled';end if;
 if not private.commerce_standard_customer(u) and not private.commerce_uat_offer_allowed(r.id) then raise exception 'Only allowlisted synthetic Buy Alone test offers are eligible';end if;
 if (p_method='pickup' and not r.allows_pickup) or (p_method='home_delivery' and not r.allows_delivery) then raise exception 'Chosen fulfillment is not available for every item';end if;
 st=private.commerce_offer_state(r.id);v_price=(st->>'price')::numeric;
 if st->>'phase'<>'ready' or v_price is null or v_price<=0 then raise exception 'Waiting commitments cannot be charged';end if;
 if r.mode='POOL' and not exists(select 1 from public.commitments where id=r.commitment_id and customer_id=u and status='active' and quantity=r.quantity) then raise exception 'Pool commitment is no longer eligible';end if;
 if r.mode='GROUP_DEAL' and not exists(select 1 from public.group_deal_commitments where id=r.group_commitment_id and customer_id=u and status='qualified' and quantity=r.quantity) then raise exception 'Group commitment is no longer eligible';end if;
 select benchmark_price into v_reference from public.market_price_benchmarks where product_id=r.product_id and community_id=v_community and approved and superseded_at is null and effective_from<=current_date;
 v_lines=v_lines||jsonb_build_array(jsonb_build_object('item_id',r.item_id,'offer_id',r.id,'sku_id',r.sku_id,'product_id',r.product_id,'name',r.name,'sku',r.sku,'quantity',r.quantity,'unit_price',v_price,'reference_price',v_reference,'version',r.version,'supplier_id',r.supplier_id,'mode',r.mode,'commitment_id',r.commitment_id,'group_commitment_id',r.group_commitment_id));
 v_sub=v_sub+v_price*r.quantity;
 end loop;
 if jsonb_array_length(v_lines)=0 then raise exception 'No payable items; waiting commitments remain separate';end if;
 v_delivery=case when p_method='pickup' then 0 when v_sub<=1000 then 20 else 30 end;
 insert into public.commerce_quotes(cart_id,customer_id,revision,community_id,fulfillment_method,pickup_point_id,delivery_address,lines,product_subtotal,delivery_fee,total_amount)
 values(c,u,(select revision from public.commerce_carts where id=c),v_community,p_method,case when p_method='pickup' then p_pickup else null end,case when p_method='home_delivery' then btrim(p_address) else null end,v_lines,v_sub,v_delivery,v_sub+v_delivery) returning * into v_quote;
 return to_jsonb(v_quote)-'customer_id';
end $$;

create or replace function public.commerce_confirm_checkout(p_quote uuid,p_key uuid,p_policy text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.commerce_quotes%rowtype;c public.commerce_checkouts%rowtype;o public.commerce_offers%rowtype;line jsonb;grp record;st jsonb;v_order uuid;v_ids jsonb:='[]';v_fee numeric;v_allocated numeric:=0;v_remaining integer;v_revision integer;
begin
 perform private.commerce_assert_preview(p_proof);
 if auth.uid() is null or p_key is null or p_policy is distinct from '2026-10-05' then raise exception 'Sign in and explicitly accept current policies';end if;
 perform pg_advisory_xact_lock(hashtextextended('commerce:checkout:'||auth.uid(),0));
 select * into c from public.commerce_checkouts where customer_id=auth.uid() and idempotency_key=p_key;
 if found then
 if c.quote_id<>p_quote then raise exception 'Idempotency key reused for another checkout';end if;
 return (select jsonb_agg(id order by id) from public.commerce_orders where checkout_id=c.id);
 end if;
 select * into q from public.commerce_quotes where id=p_quote and customer_id=auth.uid() for update;
 if not found then raise exception 'Quote not accessible';end if;
 select * into c from public.commerce_checkouts where quote_id=q.id;
 if found then return (select jsonb_agg(id order by id) from public.commerce_orders where checkout_id=c.id);end if;
 select revision into v_revision from public.commerce_carts where id=q.cart_id and customer_id=auth.uid() for update;
 if v_revision is null or q.expires_at<=now() or v_revision<>q.revision then raise exception 'Quote expired or cart changed; review a fresh quote';end if;
 if private.commerce_customer_community(auth.uid()) is distinct from q.community_id then raise exception 'Verified community changed';end if;
 for line in select value from jsonb_array_elements(q.lines) order by value->>'sku_id',value->>'offer_id' loop
 select * into o from public.commerce_offers where id=(line->>'offer_id')::uuid for share;
 if o.mode='POOL' then perform pi.id from public.pool_items pi join public.pools po on po.id=pi.pool_id where pi.id=o.pool_item_id for share of pi,po;
 elsif o.mode='GROUP_DEAL' then perform id from public.group_deals where id=o.group_deal_id for share;end if;
 st=private.commerce_offer_state(o.id);
 if not private.commerce_standard_customer(auth.uid()) and not private.commerce_uat_offer_allowed(o.id) then raise exception 'Only allowlisted synthetic Buy Alone test offers are eligible';end if;
 if not o.is_synthetic or o.version<>(line->>'version')::integer or st->>'phase'<>'ready' or (st->>'price')::numeric is distinct from (line->>'unit_price')::numeric then raise exception 'Price or offer changed; review a fresh quote';end if;
 if not exists(select 1 from public.commerce_cart_items where id=(line->>'item_id')::uuid and cart_id=q.cart_id and state='ready' and quantity=(line->>'quantity')::integer) then raise exception 'Cart item changed';end if;
 if line->>'commitment_id' is not null then
 perform id from public.commitments where id=(line->>'commitment_id')::uuid and customer_id=auth.uid() and status='active' for update;
 if not found then raise exception 'Pool commitment no longer payable';end if;
 if exists(select 1 from public.order_items oi join public.orders ord on ord.id=oi.order_id join public.commitments co on co.pool_item_id=oi.pool_item_id and co.customer_id=ord.customer_id where co.id=(line->>'commitment_id')::uuid and ord.status<>'cancelled') then raise exception 'Pool commitment already checked out';end if;
 end if;
 if line->>'group_commitment_id' is not null then
 perform id from public.group_deal_commitments where id=(line->>'group_commitment_id')::uuid and customer_id=auth.uid() and status='qualified' for update;
 if not found then raise exception 'Group commitment no longer payable';end if;
 end if;
 perform private.commerce_reserve(o.id,(line->>'quantity')::integer);
 end loop;
 insert into public.commerce_checkouts(customer_id,quote_id,idempotency_key) values(auth.uid(),q.id,p_key) returning * into c;
 select count(*) into v_remaining from (select distinct value->>'supplier_id',value->>'mode' from jsonb_array_elements(q.lines)) groups;
 for grp in select value->>'supplier_id' supplier_id,value->>'mode' mode,sum((value->>'quantity')::integer*(value->>'unit_price')::numeric) subtotal from jsonb_array_elements(q.lines) group by value->>'supplier_id',value->>'mode' order by value->>'supplier_id' nulls first,value->>'mode' loop
 v_remaining=v_remaining-1;
 v_fee=case when v_remaining=0 then q.delivery_fee-v_allocated else round(q.delivery_fee*grp.subtotal/q.product_subtotal,2) end;v_allocated=v_allocated+v_fee;
 insert into public.commerce_orders(checkout_id,customer_id,community_id,supplier_id,mode,status,product_subtotal,delivery_fee,total_amount,fulfillment_method,pickup_point_id,delivery_address,supplier_deadline)
 values(c.id,auth.uid(),q.community_id,grp.supplier_id::uuid,grp.mode,case when grp.supplier_id is null then 'confirmed' else 'awaiting_supplier' end,grp.subtotal,v_fee,grp.subtotal+v_fee,q.fulfillment_method,q.pickup_point_id,q.delivery_address,
 case when grp.supplier_id is null then null else now()+make_interval(mins => coalesce((select min(supplier_sla_minutes) from public.commerce_offers where supplier_id=grp.supplier_id::uuid and id in(select (x->>'offer_id')::uuid from jsonb_array_elements(q.lines) x)),60)) end) returning id into v_order;
 for line in select value from jsonb_array_elements(q.lines) where (value->>'supplier_id') is not distinct from grp.supplier_id and value->>'mode'=grp.mode loop
 insert into public.commerce_order_items(order_id,offer_id,sku_id,product_id,quantity,unit_price,reference_price,offer_version,cart_item_id,commitment_id,group_commitment_id,name_snapshot,sku_snapshot)
 values(v_order,(line->>'offer_id')::uuid,(line->>'sku_id')::uuid,(line->>'product_id')::uuid,(line->>'quantity')::integer,(line->>'unit_price')::numeric,(line->>'reference_price')::numeric,(line->>'version')::integer,(line->>'item_id')::uuid,(line->>'commitment_id')::uuid,(line->>'group_commitment_id')::uuid,line->>'name',line->>'sku');
 update public.commerce_cart_items set state='ordered' where id=(line->>'item_id')::uuid;
 if line->>'commitment_id' is not null then update public.commitments set status='confirmed',confirmed_at=now() where id=(line->>'commitment_id')::uuid;end if;
 end loop;
 perform private.commerce_event(v_order,case when grp.supplier_id is null then 'confirmed' else 'awaiting_supplier' end,'Order recorded with server-verified totals. COD is unpaid; supplier orders await acceptance.');
 v_ids=v_ids||jsonb_build_array(v_order);
 end loop;
 update public.commerce_carts set revision=revision+1,updated_at=now() where id=q.cart_id;
 return v_ids;
end $$;
