-- Extend Pool size while preserving every other verified function check.
-- The following complete function definitions match the current production
-- implementations except for the explicitly documented Pool limits.
CREATE OR REPLACE FUNCTION public.admin_save_simple_offer_with_tiers(p_id uuid, p_kind text, p_communities uuid[], p_title text, p_items jsonb, p_published boolean, p_closes timestamp with time zone, p_tiers jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid:=auth.uid(); oid uuid; item_row jsonb; tier jsonb;
 tier_number integer; threshold integer; previous_threshold integer:=0;
 previous_price numeric; tier_price numeric; base_price numeric; pid uuid;
 product_count integer; threshold_first integer:=null;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin')) then
  raise exception 'Admin access required';
 end if;
 if p_kind not in ('SOLO','GROUP_DEAL','COMMUNITY_POOL') then raise exception 'Invalid sale type'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or (jsonb_array_length(p_items)<1 or (p_kind='COMMUNITY_POOL' and jsonb_array_length(p_items)>20) or (p_kind<>'COMMUNITY_POOL' and jsonb_array_length(p_items)>6)) then
  raise exception 'Select 1–20 Pool products, or 1–6 products for other offers';
 end if;
 product_count:=jsonb_array_length(p_items);
 if p_kind='SOLO' then
  if coalesce(jsonb_array_length(p_tiers),0)<>0 then raise exception 'Direct offers do not use participation tiers'; end if;
 else
  if p_tiers is null or jsonb_typeof(p_tiers)<>'array' or jsonb_array_length(p_tiers) not between 1 and 3 then
   raise exception 'Choose one, two or three price tiers';
  end if;
  for tier_number in 1..jsonb_array_length(p_tiers) loop
   tier:=p_tiers->(tier_number-1);
   if jsonb_typeof(tier)<>'object' or jsonb_typeof(tier->'threshold')<>'number'
      or jsonb_typeof(tier->'prices')<>'array' then
    raise exception 'Each tier requires a target and product prices';
   end if;
   threshold:=(tier->>'threshold')::integer;
   if threshold<=previous_threshold or threshold<(case when p_kind='GROUP_DEAL' then 3 else 2 end)
      or threshold>100000 then raise exception 'Tier targets must increase (Group Deal min 3, Pool min 2)'; end if;
   if tier_number=1 then threshold_first:=threshold; end if;
   if jsonb_array_length(tier->'prices')<>product_count then raise exception 'Set a tier price for each selected product'; end if;
   if (select count(distinct v->>'product_id') from jsonb_array_elements(tier->'prices') v)<>product_count then
    raise exception 'Duplicate or missing tier product price';
   end if;
   for item_row in select value from jsonb_array_elements(p_items) loop
    pid:=(item_row->>'product_id')::uuid;
    base_price:=(item_row->>'price')::numeric;
    select (x->>'price')::numeric into tier_price from jsonb_array_elements(tier->'prices') x
      where x->>'product_id'=pid::text and jsonb_typeof(x->'price')='number';
    if tier_price is null or tier_price<=0 or tier_price<>round(tier_price,2) or tier_price>base_price
    then raise exception 'Tier prices must be positive and at or below the starting selling price'; end if;
    if tier_number>1 then
     select (x->>'price')::numeric into previous_price
      from jsonb_array_elements((p_tiers->(tier_number-2))->'prices') x where x->>'product_id'=pid::text;
     if previous_price is null or tier_price>previous_price then raise exception 'Later tier prices cannot increase'; end if;
    end if;
   end loop;
   previous_threshold:=threshold;
  end loop;
 end if;
 -- Lock the offer before checking participant/order commitments.
 if p_id is not null then
  perform 1 from public.simple_sale_offers where id=p_id for update;
  if not found then raise exception 'Offer not found'; end if;
 end if;
 if p_id is not null and (
  exists(select 1 from public.simple_sale_offer_joins where offer_id=p_id and status='active')
  or exists(select 1 from public.launch_order_items where offer_id=p_id)
 ) then raise exception 'This offer has joined customers or orders. Create a new offer cycle before changing prices.'; end if;
 oid:=public.admin_save_simple_offer_areas(p_id,p_kind,p_communities,p_title,p_items,p_published,p_closes);
 delete from public.simple_sale_offer_tiers where offer_id=oid;
 if p_kind<>'SOLO' then
  insert into public.simple_sale_offer_tiers(offer_id,product_id,tier_no,buyer_threshold,unit_price)
   select oid,(price_row->>'product_id')::uuid,tier_index::smallint,
    (tier_row->>'threshold')::integer,(price_row->>'price')::numeric
   from jsonb_array_elements(p_tiers) with ordinality tiers(tier_row,tier_index)
   cross join lateral jsonb_array_elements(tier_row->'prices') price_row;
 end if;
 update public.simple_sale_offers set buyer_target=threshold_first where id=oid;
 return oid;
end $function$;

CREATE OR REPLACE FUNCTION private.join_simple_sale_cycle_impl(p_offer uuid, p_lines jsonb, p_area uuid, p_expected_cycle uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); nominee uuid; c public.simple_sale_cycles%rowtype;
 o public.simple_sale_offers%rowtype; item jsonb; prod uuid; qty integer;
 new_member boolean:=false; n integer; highest integer; offer_title text;
begin
 if u is null then raise exception 'Sign in first';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 20 then
  raise exception 'Choose 1–20 Pool products';end if;
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
end $function$;

-- Atomic full-basket withdrawal while a Pool round is still OPEN.
-- This does not modify a closed round's immutable quote or prior order.
create or replace function public.leave_simple_sale_pool(p_offer uuid)
returns boolean language plpgsql security definer set search_path='' as $pool_leave$
declare
 u uuid:=auth.uid(); pool_cycle uuid; pool_area uuid; removed integer;
begin
 if u is null then raise exception 'Sign in first';end if;
 select cy.id,cy.community_id into pool_cycle,pool_area
 from public.simple_sale_cycles cy
 join public.simple_sale_cycle_members m on m.cycle_id=cy.id and m.customer_id=u
 join public.simple_sale_offers o on o.id=cy.offer_id and o.kind='COMMUNITY_POOL'
 where cy.offer_id=p_offer and cy.status='open'
 order by cy.opened_at desc limit 1;
 if pool_cycle is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||pool_area::text,84199));
 perform 1 from public.simple_sale_cycles
 where id=pool_cycle and status='open' for update;
 if not found then return false;end if;
 delete from public.simple_sale_cycle_items
 where cycle_id=pool_cycle and customer_id=u;
 get diagnostics removed=row_count;
 if removed=0 then return false;end if;
 delete from public.simple_sale_cycle_members
 where cycle_id=pool_cycle and customer_id=u;
 update public.simple_sale_offer_joins set status='cancelled',updated_at=now()
 where offer_id=p_offer and customer_id=u and status='active';
 delete from public.simple_sale_commitment_items
 where offer_id=p_offer and customer_id=u;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(u,'pool_left','Open Pool commitment cancelled',
  'Your open Pool commitment was withdrawn without an order or payment.',
  '/account/commitments','normal','pool_leave:'||pool_cycle::text||':'||u::text)
 on conflict(user_id,dedupe_key) do update set read_at=null,created_at=now();
 return true;
end;
$pool_leave$;
revoke all on function public.leave_simple_sale_pool(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.leave_simple_sale_pool(uuid) to authenticated;
