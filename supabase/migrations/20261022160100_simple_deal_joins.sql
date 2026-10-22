-- 2TBR qualified group-interest commitments; no payments, order settlement or tier repricing.
-- Distinguish cart selections from real, authenticated, account-community joins.
create table if not exists public.simple_sale_offer_joins (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.simple_sale_offers(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete cascade,
 community_id uuid not null references public.communities(id) on delete restrict,
 status text not null default 'active' check(status in ('active','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(offer_id,product_id,customer_id)
);
create index if not exists simple_sale_offer_joins_active_idx on public.simple_sale_offer_joins(offer_id,customer_id) where status='active';
alter table public.simple_sale_offer_joins enable row level security;
revoke all on table public.simple_sale_offer_joins from public,anon,authenticated;

create or replace function public.join_simple_sale_group_deal(p_offer uuid,p_product uuid,p_area uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); nominal uuid; title text; old_status text; joined_now boolean:=false;
begin
 if u is null then raise exception 'Sign in to join this Group Deal'; end if;
 if p_offer is null or p_product is null then raise exception 'Choose a valid Group Deal'; end if;
 select p.community_id into nominal
 from public.profiles p where p.id=u and p.onboarding_completed_at is not null;
 if nominal is null then raise exception 'Complete your account community before joining'; end if;
 if p_area is not null and p_area<>nominal then raise exception 'Select your nominated account community to join'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||u::text,84108));
 select o.title into title from public.simple_sale_offers o
 where o.id=p_offer and o.kind='GROUP_DEAL' and o.published
 and (o.closes_at is null or o.closes_at>now()) for share;
 if title is null then raise exception 'This Group Deal is not available for joining'; end if;
 if not exists(select 1 from public.simple_sale_offer_items i where i.offer_id=p_offer and i.product_id=p_product) then
  raise exception 'Product does not belong to this Group Deal';
 end if;
 if not exists(select 1 from public.simple_sale_offer_communities a
  join public.communities c on c.id=a.community_id and c.active
  where a.offer_id=p_offer and a.community_id=nominal) then
  raise exception 'This Group Deal is not offered in your nominated community';
 end if;
 select j.status into old_status from public.simple_sale_offer_joins j
 where j.offer_id=p_offer and j.product_id=p_product and j.customer_id=u for update;
 if old_status='active' then return false; end if;
 insert into public.simple_sale_offer_joins(offer_id,product_id,customer_id,community_id,status)
 values(p_offer,p_product,u,nominal,'active')
 on conflict(offer_id,product_id,customer_id)
 do update set community_id=excluded.community_id,status='active',updated_at=now();
 joined_now:=true;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(u,'group_deal_joined','Group Deal joined',
  'You joined '||left(title,120)||'. This is a commitment to participate, not a placed order or payment. Complete checkout to request your order.',
  '/preview-live/product/'||p_product||'?kind=deal&offer='||p_offer,'normal',
  'simple_join:'||p_offer::text||':'||p_product::text)
 on conflict(user_id,dedupe_key) do update set
  title=excluded.title,body=excluded.body,href=excluded.href,read_at=null,created_at=now();
 return joined_now;
end $$;
revoke all on function public.join_simple_sale_group_deal(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.join_simple_sale_group_deal(uuid,uuid,uuid) to authenticated;

create or replace function public.leave_simple_sale_group_deal(p_offer uuid,p_product uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); changed boolean:=false;
begin
 if u is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||u::text,84108));
 if exists(
  select 1 from public.launch_order_items i join public.launch_orders o on o.id=i.order_id
  where i.offer_id=p_offer and i.product_id=p_product and o.customer_id=u and o.status<>'cancelled'
 ) then raise exception 'An order was already requested; manage it in My Orders'; end if;
 update public.simple_sale_offer_joins j set status='cancelled',updated_at=now()
 where j.offer_id=p_offer and j.product_id=p_product and j.customer_id=u and j.status='active';
 changed:=found;
 if changed then
  insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
  values(u,'group_deal_left','Group Deal left','Your Group Deal participation was cancelled. No order was placed by this action.',
   '/cart','normal','simple_leave:'||p_offer::text||':'||p_product::text)
  on conflict(user_id,dedupe_key) do update set body=excluded.body,read_at=null,created_at=now();
 end if;
 return changed;
end $$;
revoke all on function public.leave_simple_sale_group_deal(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.leave_simple_sale_group_deal(uuid,uuid) to authenticated;

-- Aggregate real opt-in joins plus independently confirmed orders. Cart-only changes never count.
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
 select jsonb_agg(jsonb_build_object(
  'product_id',p.id,'name',p.name,'brand',p.brand,
  'category',p.category,'package_size',p.package_size,'unit',p.unit,
  'image_url',p.image_url,'price',i.price,'old_price',i.old_price,
  'available_quantity',coalesce(l.available_quantity,s.available_quantity,0)
 ) order by p.name) rows
 from public.simple_sale_offer_items i
 join public.products p on p.id=i.product_id and p.active and not p.is_demo
 left join public.pilot_vendor_product_listings l on l.product_id=p.id and l.launch_enabled
 left join public.launch_product_stock s on s.product_id=p.id
 where i.offer_id=o.id
) items
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
where cardinality(areas.ids)>0 and o.published
and exists(select 1 from public.simple_sale_offer_items where offer_id=o.id)
and (o.closes_at is null or o.closes_at>now())
and jsonb_array_length(coalesce(items.rows,'[]'::jsonb))=
 (select count(*) from public.simple_sale_offer_items where offer_id=o.id);
$$;
