-- 2TBR community-specific cycles. All test executions must use a disposable Supabase.
-- This migration intentionally does not migrate payments, create orders or touch production.
create table public.simple_sale_cycles(
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.simple_sale_offers(id) on delete restrict,
 community_id uuid not null references public.communities(id) on delete restrict,
 cycle_number integer not null check(cycle_number>0),
 status text not null default 'open' check(status in ('open','closed')),
 opened_at timestamptz not null default now(),
 closes_at timestamptz,
 closed_at timestamptz,
 household_count integer check(household_count>=0),
 locked_threshold integer check(locked_threshold>=0),
 next_cycle_id uuid references public.simple_sale_cycles(id),
 created_at timestamptz not null default now(),
 unique(offer_id,community_id,cycle_number)
);
create unique index simple_sale_one_open_cycle on public.simple_sale_cycles(offer_id,community_id) where status='open';
create index simple_sale_cycle_community_idx on public.simple_sale_cycles(community_id,status,offer_id);
create table public.simple_sale_cycle_members(
 cycle_id uuid not null references public.simple_sale_cycles(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete restrict,
 joined_at timestamptz not null default now(),
 primary key(cycle_id,customer_id)
);
create table public.simple_sale_cycle_items(
 cycle_id uuid not null references public.simple_sale_cycles(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 100),
 opening_unit_price numeric(12,2) not null check(opening_unit_price>0),
 retail_reference numeric(12,2) check(retail_reference>0),
 updated_at timestamptz not null default now(),
 primary key(cycle_id,customer_id,product_id),
 foreign key(cycle_id,customer_id) references public.simple_sale_cycle_members(cycle_id,customer_id)
);
create table public.simple_sale_cycle_quotes(
 id uuid primary key default gen_random_uuid(),
 cycle_id uuid not null references public.simple_sale_cycles(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete restrict,
 product_total numeric(12,2) not null check(product_total>0),
 delivery_fee numeric(12,2) check(delivery_fee>=0),
 fulfillment text check(fulfillment in ('pickup','home_delivery')),
 pickup_point_id uuid references public.pickup_points(id),
 home_address text,
 status text not null default 'awaiting_delivery' check(status in
   ('awaiting_delivery','quoted','accepted','payment_submitted','verified','cancelled')),
 quoted_by uuid references auth.users(id),
 quoted_at timestamptz,
 accepted_at timestamptz,
 contact_name text,
 contact_phone text,
 payment_recipient_id uuid references public.pilot_payment_recipients(id),
 payment_reference text,
 payment_submitted_at timestamptz,
 payment_verified_by uuid references auth.users(id),
 payment_verified_at timestamptz,
 order_id uuid unique references public.launch_orders(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(cycle_id,customer_id),
 foreign key(cycle_id,customer_id) references public.simple_sale_cycle_members(cycle_id,customer_id),
 constraint verified_quote_complete check(status<>'verified' or
   (accepted_at is not null and delivery_fee is not null
   and payment_verified_by is not null and payment_verified_at is not null
   and payment_recipient_id is not null and payment_reference is not null))
);
create unique index unique_shared_payment_ref on public.simple_sale_cycle_quotes
 (payment_recipient_id,lower(payment_reference)) where payment_recipient_id is not null and payment_reference is not null and status<>'cancelled';
create table public.simple_sale_cycle_quote_items(
 quote_id uuid not null references public.simple_sale_cycle_quotes(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 100),
 unit_price numeric(12,2) not null check(unit_price>0),
 retail_reference numeric(12,2) check(retail_reference>0),
 primary key(quote_id,product_id)
);
create unique index simple_sale_cycle_quote_order_id on public.simple_sale_cycle_quotes(order_id) where order_id is not null;

-- Defense in depth: data API is read-only and scoped; all transitions are validated RPCs.
do $rls$
declare t text;
begin
 foreach t in array array['simple_sale_cycles','simple_sale_cycle_members','simple_sale_cycle_items',
  'simple_sale_cycle_quotes','simple_sale_cycle_quote_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $rls$;
create policy read_open_cycles on public.simple_sale_cycles for select to anon,authenticated
 using (status='open' and exists(select 1 from public.simple_sale_offers o where o.id=offer_id and o.published));
create policy read_own_cycles on public.simple_sale_cycles for select to authenticated
 using(exists(select 1 from public.simple_sale_cycle_members m where m.cycle_id=id and m.customer_id=(select auth.uid())));
create policy read_own_cycle_members on public.simple_sale_cycle_members for select to authenticated
 using(customer_id=(select auth.uid()));
create policy read_own_cycle_items on public.simple_sale_cycle_items for select to authenticated
 using(customer_id=(select auth.uid()));
create policy read_own_cycle_quotes on public.simple_sale_cycle_quotes for select to authenticated
 using(customer_id=(select auth.uid()) or private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy read_own_cycle_quote_items on public.simple_sale_cycle_quote_items for select to authenticated
 using(exists(select 1 from public.simple_sale_cycle_quotes q where q.id=quote_id and
  (q.customer_id=(select auth.uid()) or private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))));
grant select on public.simple_sale_cycles to anon,authenticated;
grant select on public.simple_sale_cycle_members,public.simple_sale_cycle_items,
 public.simple_sale_cycle_quotes,public.simple_sale_cycle_quote_items to authenticated;

-- Seed one distinct open cycle per published community. Preserve existing real joins in cycle 1.
insert into public.simple_sale_cycles(offer_id,community_id,cycle_number,closes_at)
 select o.id,a.community_id,1,o.closes_at from public.simple_sale_offers o
 join public.simple_sale_offer_communities a on a.offer_id=o.id
 where o.kind in ('GROUP_DEAL','COMMUNITY_POOL') and o.published
 on conflict(offer_id,community_id,cycle_number) do nothing;
insert into public.simple_sale_cycle_members(cycle_id,customer_id,joined_at)
 select distinct c.id,j.customer_id,min(j.created_at) from public.simple_sale_offer_joins j
 join public.simple_sale_cycles c on c.offer_id=j.offer_id and c.community_id=j.community_id and c.cycle_number=1
 where j.status='active' group by c.id,j.customer_id
 on conflict do nothing;
insert into public.simple_sale_cycle_items(cycle_id,customer_id,product_id,quantity,opening_unit_price,retail_reference)
 select c.id,j.customer_id,j.product_id,coalesce(k.quantity,1),i.price,nullif(i.old_price,0)
 from public.simple_sale_offer_joins j
 join public.simple_sale_cycles c on c.offer_id=j.offer_id and c.community_id=j.community_id and c.cycle_number=1
 join public.simple_sale_offer_items i on i.offer_id=j.offer_id and i.product_id=j.product_id
 left join public.simple_sale_commitment_items k on k.offer_id=j.offer_id and k.customer_id=j.customer_id and k.product_id=j.product_id
 where j.status='active' on conflict do nothing;

-- Lock and close exactly one community cycle; snapshot product prices. No payment/order is created.
create or replace function private.close_simple_sale_cycle_impl(p_cycle uuid,p_allow_early boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.simple_sale_cycles%rowtype; o public.simple_sale_offers%rowtype;
 n integer; final_target integer:=0; q record; quote_uuid uuid; reopening uuid;
begin
 select * into c from public.simple_sale_cycles where id=p_cycle for update;
 if c.id is null then raise exception 'Cycle not found';end if;
 if c.status='closed' then return c.next_cycle_id;end if;
 select * into o from public.simple_sale_offers where id=c.offer_id for share;
 if not p_allow_early and (c.closes_at is null or c.closes_at>now()) then
  raise exception 'Commitment window is still open';
 end if;
 select count(*) into n from public.simple_sale_cycle_members where cycle_id=c.id;
 select coalesce(max(t.buyer_threshold),0) into final_target from public.simple_sale_offer_tiers t
 where t.offer_id=c.offer_id and t.buyer_threshold<=n;
 update public.simple_sale_cycles set status='closed',closed_at=now(),household_count=n,locked_threshold=final_target where id=c.id;
 for q in select customer_id from public.simple_sale_cycle_members where cycle_id=c.id loop
  insert into public.simple_sale_cycle_quotes(cycle_id,customer_id,product_total)
   select c.id,q.customer_id,sum(i.quantity*coalesce(
    (select t.unit_price from public.simple_sale_offer_tiers t
     where t.offer_id=c.offer_id and t.product_id=i.product_id and t.buyer_threshold<=n
     order by t.buyer_threshold desc,t.tier_no desc limit 1),i.opening_unit_price))
   from public.simple_sale_cycle_items i where i.cycle_id=c.id and i.customer_id=q.customer_id
   returning id into quote_uuid;
  insert into public.simple_sale_cycle_quote_items(quote_id,product_id,quantity,unit_price,retail_reference)
   select quote_uuid,i.product_id,i.quantity,
    coalesce((select t.unit_price from public.simple_sale_offer_tiers t
      where t.offer_id=c.offer_id and t.product_id=i.product_id and t.buyer_threshold<=n
      order by t.buyer_threshold desc,t.tier_no desc limit 1),i.opening_unit_price),
    i.retail_reference from public.simple_sale_cycle_items i
    where i.cycle_id=c.id and i.customer_id=q.customer_id;
  insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
  values(q.customer_id,'offer_quote_ready','Community offer closed',
   case when final_target=0 then 'No discount tier was reached. Choose whether to accept the starting price or cancel after the delivery quote.'
    else 'Your community earned a tier price. Wait for your full delivery quote, then accept or cancel.' end,
   '/account/commitments','normal','community_quote:'||quote_uuid::text)
   on conflict(user_id,dedupe_key) do nothing;
 end loop;
 -- Idempotent new UUID for this community only. Other communities' cycles are never touched.
 if o.published then
  insert into public.simple_sale_cycles(offer_id,community_id,cycle_number,closes_at)
  values(c.offer_id,c.community_id,c.cycle_number+1,
   case when c.closes_at is null then null
    else now()+greatest(interval '1 day',least(interval '30 days',
      coalesce(c.closes_at-c.opened_at,interval '7 days'))) end)
  returning id into reopening;
  update public.simple_sale_cycles set next_cycle_id=reopening where id=c.id;
 end if;
 return reopening;
end $$;
revoke all on function private.close_simple_sale_cycle_impl(uuid,boolean) from public,anon,authenticated,service_role;

-- Close overdue cycles with PostgreSQL Cron (scheduler installed separately, only after UAT).
create or replace function private.close_due_simple_sale_cycles_impl()
returns integer language plpgsql security definer set search_path='' as $$
declare row_ record; finished integer:=0;
begin
 for row_ in select id,offer_id,community_id from public.simple_sale_cycles
  where status='open' and closes_at<=now() order by closes_at,id loop
  perform pg_advisory_xact_lock(hashtextextended(row_.offer_id::text||':'||row_.community_id::text,84199));
  if (select status from public.simple_sale_cycles where id=row_.id)='open' then
   perform private.close_simple_sale_cycle_impl(row_.id,false);
   finished:=finished+1;
  end if;
 end loop;
 return finished;
end $$;
revoke all on function private.close_due_simple_sale_cycles_impl() from public,anon,authenticated,service_role;

-- Strict authenticated join. Pool counts a household once, irrespective of products/quantities.
create or replace function private.join_simple_sale_cycle_impl(p_offer uuid,p_lines jsonb,p_area uuid,p_expected_cycle uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); nominee uuid; c public.simple_sale_cycles%rowtype;
 o public.simple_sale_offers%rowtype; item jsonb; prod uuid; qty integer;
 new_member boolean:=false; n integer; highest integer; offer_title text;
begin
 if u is null then raise exception 'Sign in first';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 6 then
  raise exception 'Choose 1–6 products';end if;
 if (select count(distinct x->>'product_id') from jsonb_array_elements(p_lines) x)<>jsonb_array_length(p_lines)
 then raise exception 'Duplicate products';end if;
 select p.community_id into nominee from public.profiles p
 where p.id=u and p.onboarding_completed_at is not null;
 if nominee is null or (p_area is not null and p_area<>nominee) then
  raise exception 'Select your nominated community';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||nominee::text,84199));
 select * into o from public.simple_sale_offers where id=p_offer and published
 and kind in ('GROUP_DEAL','COMMUNITY_POOL') for share;
 if o.id is null then raise exception 'Offer not available';end if;
 if not exists(select 1 from public.simple_sale_offer_communities a
  join public.communities community on community.id=a.community_id and community.active
  where a.offer_id=p_offer and a.community_id=nominee) then raise exception 'Not available in your community';end if;
 select * into c from public.simple_sale_cycles
  where offer_id=p_offer and community_id=nominee and status='open' for update;
 if c.id is null then
  insert into public.simple_sale_cycles(offer_id,community_id,cycle_number,closes_at)
   values(p_offer,nominee,1,o.closes_at) returning * into c;
 end if;
 if c.closes_at<=now() then
  perform private.close_simple_sale_cycle_impl(c.id,true);
  select * into c from public.simple_sale_cycles
   where offer_id=p_offer and community_id=nominee and status='open' for update;
 end if;
 if c.id is null then raise exception 'No open cycle is available';end if;
 if exists(select 1 from public.simple_sale_cycle_members m
   join public.simple_sale_cycles prior on prior.id=m.cycle_id
   where m.customer_id=u and prior.offer_id=p_offer and prior.id<>c.id)
   and p_expected_cycle is distinct from c.id then
    raise exception 'Refresh and explicitly join the new community cycle';
 end if;
 if p_expected_cycle is not null and p_expected_cycle<>c.id then
  raise exception 'This offer cycle has changed. Refresh before joining';end if;
 if o.kind='GROUP_DEAL' and jsonb_array_length(p_lines)<>1 then raise exception 'Group Deal allows one product';end if;
 for item in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(item->'quantity')<>'number' or jsonb_typeof(item->'product_id')<>'string' or
   (item->>'quantity')::numeric<>round((item->>'quantity')::numeric) or
   (item->>'quantity')::numeric not between 1 and 100 then raise exception 'Invalid quantity';end if;
  prod:=(item->>'product_id')::uuid;qty:=(item->>'quantity')::integer;
  if not exists(select 1 from public.simple_sale_offer_items i where i.offer_id=p_offer and i.product_id=prod)
  then raise exception 'Product not found in offer';end if;
 end loop;
 insert into public.simple_sale_cycle_members(cycle_id,customer_id) values(c.id,u)
 on conflict do nothing;
 new_member:=found;
 for item in select value from jsonb_array_elements(p_lines) loop
  prod:=(item->>'product_id')::uuid;qty:=(item->>'quantity')::integer;
  insert into public.simple_sale_cycle_items
   (cycle_id,customer_id,product_id,quantity,opening_unit_price,retail_reference)
   select c.id,u,prod,qty,i.price,nullif(i.old_price,0) from public.simple_sale_offer_items i
   where i.offer_id=p_offer and i.product_id=prod
   on conflict(cycle_id,customer_id,product_id) do update
     set quantity=excluded.quantity,updated_at=now();
  -- Compatibility snapshot for existing cart. Historical cycle quote records remain immutable.
  insert into public.simple_sale_offer_joins(offer_id,product_id,customer_id,community_id,status)
  values(p_offer,prod,u,nominee,'active')
  on conflict(offer_id,product_id,customer_id) do update
     set community_id=excluded.community_id,status='active',updated_at=now();
  insert into public.simple_sale_commitment_items(offer_id,product_id,customer_id,community_id,quantity)
  values(p_offer,prod,u,nominee,qty)
  on conflict(offer_id,customer_id,product_id) do update
    set quantity=excluded.quantity,community_id=excluded.community_id,updated_at=now();
 end loop;
 select count(*) into n from public.simple_sale_cycle_members where cycle_id=c.id;
 select max(t.buyer_threshold) into highest from public.simple_sale_offer_tiers t where t.offer_id=p_offer;
 if new_member then
  insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
  values(u,'offer_commitment','Community commitment saved',
   'Your commitment is saved. No order or payment yet. The final price will be quoted when your community cycle closes.',
   '/account/commitments','normal','community_join:'||c.id::text||':'||u::text)
  on conflict(user_id,dedupe_key) do nothing;
 end if;
 if highest is not null and n>=highest then
  perform private.close_simple_sale_cycle_impl(c.id,true);
 end if;
 return new_member;
end $$;
revoke all on function private.join_simple_sale_cycle_impl(uuid,jsonb,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.join_simple_sale_group_deal_quantified(p_offer uuid,p_product uuid,p_area uuid,p_quantity integer)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 return private.join_simple_sale_cycle_impl(p_offer,jsonb_build_array(
  jsonb_build_object('product_id',p_product,'quantity',p_quantity)),p_area);
end $$;
create or replace function public.join_simple_sale_pool_quantified(p_offer uuid,p_lines jsonb,p_area uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 return private.join_simple_sale_cycle_impl(p_offer,p_lines,p_area);
end $$;
revoke all on function public.join_simple_sale_group_deal_quantified(uuid,uuid,uuid,integer),
 public.join_simple_sale_pool_quantified(uuid,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.join_simple_sale_group_deal_quantified(uuid,uuid,uuid,integer),
 public.join_simple_sale_pool_quantified(uuid,jsonb,uuid) to authenticated;
create or replace function public.join_simple_sale_group_deal_quantified(p_offer uuid,p_product uuid,p_area uuid,p_quantity integer,p_expected_cycle uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 return private.join_simple_sale_cycle_impl(p_offer,jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',p_quantity)),p_area,p_expected_cycle);
end $$;
create or replace function public.join_simple_sale_pool_quantified(p_offer uuid,p_lines jsonb,p_area uuid,p_expected_cycle uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 return private.join_simple_sale_cycle_impl(p_offer,p_lines,p_area,p_expected_cycle);
end $$;
revoke all on function public.join_simple_sale_group_deal_quantified(uuid,uuid,uuid,integer,uuid),
 public.join_simple_sale_pool_quantified(uuid,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.join_simple_sale_group_deal_quantified(uuid,uuid,uuid,integer,uuid),
 public.join_simple_sale_pool_quantified(uuid,jsonb,uuid,uuid) to authenticated;
-- Revoke legacy writes which cannot assign a cycle and can corrupt per-community counters.
revoke execute on function public.join_simple_sale_group_deal(uuid,uuid,uuid),
 public.join_simple_sale_pool(uuid,uuid[],uuid) from public,anon,authenticated;

create or replace function public.set_simple_sale_commitment_quantity(
 p_offer uuid,p_product uuid,p_quantity integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;
begin
 if u is null then raise exception 'Sign in first';end if;
 if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Choose 1–100 units';end if;
 select ci.cycle_id into c from public.simple_sale_cycle_items ci
  join public.simple_sale_cycles cy on cy.id=ci.cycle_id and cy.status='open'
  where ci.customer_id=u and ci.product_id=p_product and cy.offer_id=p_offer;
 if c is null then raise exception 'Your cycle is closed or not joined';end if;
 update public.simple_sale_cycle_items set quantity=p_quantity,updated_at=now()
 where cycle_id=c and customer_id=u and product_id=p_product;
 update public.simple_sale_commitment_items set quantity=p_quantity,updated_at=now()
 where offer_id=p_offer and customer_id=u and product_id=p_product;
 return true;
end $$;
revoke all on function public.set_simple_sale_commitment_quantity(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.set_simple_sale_commitment_quantity(uuid,uuid,integer) to authenticated;
