-- Explicit admin publication; no preview data, order, inventory or financial writes.
create table public.pool_storefront_publication (
 pool_id uuid primary key references public.pools(id) on delete cascade,
 featured_product_ids uuid[] not null default '{}',
 published boolean not null default false,
 sort_order integer not null default 100,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 check(cardinality(featured_product_ids) between 0 and 3)
);
alter table public.pool_storefront_publication enable row level security;
create policy pool_storefront_admin_read on public.pool_storefront_publication
 for select to authenticated using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
revoke all on public.pool_storefront_publication from public,anon,authenticated;
grant select on public.pool_storefront_publication to authenticated;

create function public.admin_publish_storefront_pool(p_pool_id uuid,p_product_ids uuid[],p_published boolean,p_sort_order integer default 100)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_pool public.pools%rowtype;
begin
 if v_user is null or not (private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found then raise exception 'Pool not found'; end if;
 if p_product_ids is null or cardinality(p_product_ids)>3 or exists(select 1 from unnest(p_product_ids) x group by x having x is null or count(*)>1) then raise exception 'Choose up to three distinct products'; end if;
 if p_published and (v_pool.status not in ('open','pricing','final_price','confirmation') or v_pool.is_paused or v_pool.cadence not in ('weekly','monthly','special') or cardinality(p_product_ids)=0) then raise exception 'Only an active Pool with selected products can be published'; end if;
 if exists(select 1 from unnest(p_product_ids) x where not exists(select 1 from public.pool_items i join public.products p on p.id=i.product_id where i.pool_id=p_pool_id and i.product_id=x and i.active and p.active and not p.is_demo)) then raise exception 'Select active non-demo products belonging to this Pool'; end if;
 insert into public.pool_storefront_publication(pool_id,featured_product_ids,published,sort_order,updated_by)
 values(p_pool_id,p_product_ids,p_published,coalesce(p_sort_order,100),v_user)
 on conflict(pool_id) do update set featured_product_ids=excluded.featured_product_ids,published=excluded.published,sort_order=excluded.sort_order,updated_by=v_user,updated_at=now();
end; $$;
revoke all on function public.admin_publish_storefront_pool(uuid,uuid[],boolean,integer) from public,anon;
grant execute on function public.admin_publish_storefront_pool(uuid,uuid[],boolean,integer) to authenticated;

-- An intentionally narrow public read model, because source tables contain private commercial data.
create function public.get_public_featured_pools(p_community_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(v.content order by v.sort_order,v.pool_id),'[]'::jsonb) from (
 select po.id as pool_id,pub.sort_order,
 jsonb_build_object('id',po.id,'slug',po.cadence,'community_id',po.community_id,
 'title',jsonb_build_object('en',po.title,'bn',po.title),
 'subtitle',jsonb_build_object('en',c.name,'bn',c.name),
 'description',jsonb_build_object('en','','bn',''),'image','',
 'featuredProductIds',pub.featured_product_ids,'bundle',bundle.items,
 'minHouseholds',null,'sampleHouseholds',stats.buyers,
 'collection',jsonb_build_object('en','See Pool for collection schedule','bn','সংগ্রহের সময়সূচি পুলে দেখুন'),
 'isDemo',false,'livePricing',jsonb_build_object('currentPrice',bundle.current_price,'nextPrice',null,'upcoming',null,'householdsNeeded',0,'soloPrice',null)) as content
 from public.pool_storefront_publication pub
 join public.pools po on po.id=pub.pool_id
 join public.communities c on c.id=po.community_id and c.active
 cross join lateral (
  select jsonb_agg(jsonb_build_object('offer',to_jsonb(o),'qty',1) order by i.created_at,i.id) items,
   case when bool_and(o.confirmed_price is not null) then sum(o.confirmed_price) else null end current_price
  from public.pool_items i
  join public.get_public_storefront_offers(po.community_id) o on o.offer_id=i.id and o.offer_kind='COMMUNITY_POOL'
  where i.pool_id=po.id and i.active
 ) bundle
 cross join lateral (
  select count(distinct co.customer_id) buyers from public.commitments co
  join public.pool_items i on i.id=co.pool_item_id
  where i.pool_id=po.id and co.status in ('active','confirmed')
 ) stats
 where pub.published and not po.is_paused and po.status in ('open','pricing','final_price','confirmation')
 and (p_community_id is null or po.community_id=p_community_id)
 and bundle.items is not null
 and not exists(select 1 from unnest(pub.featured_product_ids) x where not exists(select 1 from public.pool_items i join public.products p on p.id=i.product_id where i.pool_id=po.id and i.product_id=x and i.active and p.active and not p.is_demo))
 order by pub.sort_order,po.id limit 12
 ) v;
$$;
revoke all on function public.get_public_featured_pools(uuid) from public;
grant execute on function public.get_public_featured_pools(uuid) to anon,authenticated;
