-- Tiered Group Deal and Community Pool pricing. Every quote is server-authoritative.
create table if not exists public.simple_sale_offer_tiers (
 offer_id uuid not null references public.simple_sale_offers(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 tier_no smallint not null check(tier_no between 1 and 3),
 buyer_threshold integer not null check(buyer_threshold between 2 and 100000),
 unit_price numeric(12,2) not null check(unit_price>0),
 primary key(offer_id,product_id,tier_no)
);
create index if not exists simple_sale_offer_tiers_threshold_idx on public.simple_sale_offer_tiers(offer_id,buyer_threshold,tier_no);
alter table public.simple_sale_offer_tiers enable row level security;
revoke all on table public.simple_sale_offer_tiers from public,anon,authenticated;
create policy admins_read_simple_sale_offer_tiers on public.simple_sale_offer_tiers
 for select to authenticated using (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
grant select on public.simple_sale_offer_tiers to authenticated;

create or replace function public.admin_save_simple_offer_with_tiers(
 p_id uuid,p_kind text,p_communities uuid[],p_title text,p_items jsonb,
 p_published boolean,p_closes timestamptz,p_tiers jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
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
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 6 then
  raise exception 'Select 1–6 products';
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
end $$;
revoke all on function public.admin_save_simple_offer_with_tiers(uuid,text,uuid[],text,jsonb,boolean,timestamptz,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_save_simple_offer_with_tiers(uuid,text,uuid[],text,jsonb,boolean,timestamptz,jsonb) to authenticated;

-- The same published feed supplies cards, details, cart and checkout prices.
create or replace function public.get_public_simple_offers()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',o.id,'kind',o.kind,'community_id',areas.ids[1],
  'community_ids',areas.ids,'community_name',areas.names,
  'title',o.title,'updated_at',o.updated_at,'closes_at',o.closes_at,
  'items',items.rows,'buyer_count',counts.buyers,
  'pending_buyers',counts.pending_buyers,'buyer_target',o.buyer_target
 ) order by o.updated_at desc),'[]'::jsonb)
 from public.simple_sale_offers o
 cross join lateral(
  select array_agg(c.id order by (c.id=o.community_id) desc,c.name,c.id) ids,
   string_agg(c.name,', ' order by (c.id=o.community_id) desc,c.name,c.id) names
  from public.simple_sale_offer_communities a
  join public.communities c on c.id=a.community_id and c.active
  where a.offer_id=o.id
 ) areas
 cross join lateral(
  select
   (select count(distinct customers.customer_id) from (
    select j.customer_id from public.simple_sale_offer_joins j where j.offer_id=o.id and j.status='active'
    union
    select ord.customer_id from public.launch_order_items li join public.launch_orders ord
     on ord.id=li.order_id and ord.status='confirmed' where li.offer_id=o.id
   ) customers) buyers,
   (select count(distinct ord.customer_id) from public.launch_order_items li
     join public.launch_orders ord on ord.id=li.order_id and ord.status='requested'
     where li.offer_id=o.id) pending_buyers
 ) counts
 cross join lateral(
  select jsonb_agg(jsonb_build_object(
   'product_id',p.id,'name',p.name,'brand',p.brand,
   'category',p.category,'package_size',p.package_size,'unit',p.unit,
   'image_url',p.image_url,
   'price',coalesce((select t.unit_price from public.simple_sale_offer_tiers t
     where t.offer_id=o.id and t.product_id=i.product_id and t.buyer_threshold<=counts.buyers
     order by t.buyer_threshold desc,t.tier_no desc limit 1),i.price),
   'base_price',i.price,'old_price',i.old_price,
   'next_threshold',coalesce((select min(t.buyer_threshold) from public.simple_sale_offer_tiers t
     where t.offer_id=o.id and t.product_id=i.product_id and t.buyer_threshold>counts.buyers),
     case when o.buyer_target>counts.buyers and not exists(
      select 1 from public.simple_sale_offer_tiers t where t.offer_id=o.id) then o.buyer_target end),
   'next_price',(select t.unit_price from public.simple_sale_offer_tiers t
     where t.offer_id=o.id and t.product_id=i.product_id and t.buyer_threshold>counts.buyers
     order by t.buyer_threshold,t.tier_no limit 1),
   'tiers',coalesce((select jsonb_agg(jsonb_build_object('minimum',t.buyer_threshold,'price',t.unit_price)
     order by t.tier_no) from public.simple_sale_offer_tiers t
     where t.offer_id=o.id and t.product_id=i.product_id),'[]'::jsonb),
   'available_quantity',coalesce(l.available_quantity,s.available_quantity,0)
  ) order by p.name) rows
  from public.simple_sale_offer_items i
  join public.products p on p.id=i.product_id and p.active and not p.is_demo
  left join public.pilot_vendor_product_listings l on l.product_id=p.id and l.launch_enabled
  left join public.launch_product_stock s on s.product_id=p.id
  where i.offer_id=o.id
 ) items
 where cardinality(areas.ids)>0 and o.published
 and exists(select 1 from public.simple_sale_offer_items where offer_id=o.id)
 and (o.closes_at is null or o.closes_at>now())
 and jsonb_array_length(coalesce(items.rows,'[]'::jsonb))=
   (select count(*) from public.simple_sale_offer_items where offer_id=o.id);
$$;

-- A Pool participation may contain several products, but counts an account once.
create or replace function public.join_simple_sale_pool(p_offer uuid,p_products uuid[],p_area uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); nominated uuid; offer_title text; product_id uuid; joined_now boolean:=false;
begin
 if u is null then raise exception 'Sign in to join this Pool'; end if;
 if p_products is null or cardinality(p_products) not between 1 and 6
  or (select count(distinct pid) from unnest(p_products) as x(pid))<>cardinality(p_products) then
  raise exception 'Select one to six distinct products';
 end if;
 select p.community_id into nominated from public.profiles p
  where p.id=u and p.onboarding_completed_at is not null;
 if nominated is null then raise exception 'Complete your account community before joining'; end if;
 if p_area is not null and p_area<>nominated then raise exception 'Select your nominated account community'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||u::text,84108));
 select o.title into offer_title from public.simple_sale_offers o
  where o.id=p_offer and o.kind='COMMUNITY_POOL' and o.published
    and (o.closes_at is null or o.closes_at>now()) for share;
 if offer_title is null then raise exception 'This Pool is not open for joining'; end if;
 if not exists(select 1 from public.simple_sale_offer_communities a
  join public.communities c on c.id=a.community_id and c.active
  where a.offer_id=p_offer and a.community_id=nominated) then
  raise exception 'This Pool is not offered in your nominated community';
 end if;
 if (select count(*) from public.simple_sale_offer_items i
    where i.offer_id=p_offer and i.product_id=any(p_products))<>cardinality(p_products) then
  raise exception 'Selected products do not belong to this Pool';
 end if;
 for product_id in select unnest(p_products) loop
  if not exists(select 1 from public.simple_sale_offer_joins j where
    j.offer_id=p_offer and j.product_id=product_id and j.customer_id=u and j.status='active') then
   insert into public.simple_sale_offer_joins(offer_id,product_id,customer_id,community_id,status)
    values(p_offer,product_id,u,nominated,'active')
    on conflict(offer_id,product_id,customer_id)
    do update set community_id=excluded.community_id,status='active',updated_at=now();
   joined_now:=true;
  end if;
 end loop;
 if joined_now then
  insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
  values(u,'pool_joined','Community Pool joined',
   'Your selected products are now part of '||left(offer_title,120)||'. Checkout is still required; no payment was taken.',
   '/preview-live/pool/'||p_offer,'normal','simple_pool_join:'||p_offer::text)
  on conflict(user_id,dedupe_key) do update set
    read_at=null,body=excluded.body,created_at=now();
 end if;
 return joined_now;
end $$;
revoke all on function public.join_simple_sale_pool(uuid,uuid[],uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.join_simple_sale_pool(uuid,uuid[],uuid) to authenticated;
