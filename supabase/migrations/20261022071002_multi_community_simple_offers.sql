-- One offer, price and stock balance can serve several selected communities.
create table public.simple_sale_offer_communities(
 offer_id uuid not null references public.simple_sale_offers(id) on delete cascade,
 community_id uuid not null references public.communities(id),
 primary key(offer_id,community_id)
);
create index simple_offer_communities_area on public.simple_sale_offer_communities(community_id);
alter table public.simple_sale_offer_communities enable row level security;
revoke all on public.simple_sale_offer_communities from public,anon,authenticated,service_role;
grant select on public.simple_sale_offer_communities to authenticated;
create policy simple_offer_communities_admin on public.simple_sale_offer_communities for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
insert into public.simple_sale_offer_communities(offer_id,community_id)
 select id,community_id from public.simple_sale_offers;

-- Keep the old single-community RPC compatible during rolling deployment.
create function private.sync_simple_offer_community() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.community_id is not distinct from old.community_id then return new;end if;
  delete from public.simple_sale_offer_communities where offer_id=new.id;
 end if;
 insert into public.simple_sale_offer_communities(offer_id,community_id) values(new.id,new.community_id) on conflict do nothing;
 return new;
end $$;
revoke all on function private.sync_simple_offer_community() from public,anon,authenticated,service_role;
create trigger simple_offer_primary_community after insert or update of community_id on public.simple_sale_offers
 for each row execute function private.sync_simple_offer_community();

create function public.admin_save_simple_offer_areas(p_id uuid,p_kind text,p_communities uuid[],p_title text,p_items jsonb,p_published boolean,p_closes timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();areas uuid[];primary_area uuid;oid uuid;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin')) then raise exception 'Admin access required';end if;
 select array_agg(distinct id order by id) into areas from unnest(p_communities) id where id is not null;
 if coalesce(cardinality(areas),0)=0 then raise exception 'Select at least one community / area';end if;
 if p_id is not null then
  select community_id into primary_area from public.simple_sale_offers where id=p_id for update;
 end if;
 perform 1 from public.communities where id=any(areas) order by id for share;
 if (select count(*) from public.communities where id=any(areas) and active)<>cardinality(areas) then raise exception 'Choose active communities / areas';end if;
 if primary_area is null or not(primary_area=any(areas)) then primary_area=areas[1];end if;
 -- This retains existing product validation, stock locks and customer-order protection.
 oid=public.admin_save_simple_offer(p_id,p_kind,primary_area,p_title,p_items,p_published,p_closes);
 delete from public.simple_sale_offer_communities where offer_id=oid and not(community_id=any(areas));
 insert into public.simple_sale_offer_communities(offer_id,community_id)
  select oid,id from unnest(areas) id on conflict do nothing;
 return oid;
end $$;
revoke all on function public.admin_save_simple_offer_areas(uuid,text,uuid[],text,jsonb,boolean,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_simple_offer_areas(uuid,text,uuid[],text,jsonb,boolean,timestamptz) to authenticated;

-- Emit an offer once, including all active target areas. Browsing filters match
-- membership without duplicating cards, products, prices, orders or inventory.
create or replace function public.get_public_simple_offers() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'community_id',areas.ids[1],'community_ids',areas.ids,'community_name',areas.names,'title',o.title,'updated_at',o.updated_at,'closes_at',o.closes_at,'items',items.rows,'buyer_count',counts.buyers) order by o.updated_at desc),'[]'::jsonb)
 from public.simple_sale_offers o
 cross join lateral(
  select array_agg(c.id order by (c.id=o.community_id) desc,c.name,c.id) ids,
   string_agg(c.name,', ' order by (c.id=o.community_id) desc,c.name,c.id) names
  from public.simple_sale_offer_communities a join public.communities c on c.id=a.community_id and c.active where a.offer_id=o.id
 ) areas
 cross join lateral(select jsonb_agg(jsonb_build_object('product_id',p.id,'name',p.name,'brand',p.brand,'category',p.category,'package_size',p.package_size,'unit',p.unit,'image_url',p.image_url,'price',i.price,'old_price',i.old_price,'available_quantity',coalesce(l.available_quantity,s.available_quantity,0)) order by p.name) rows from public.simple_sale_offer_items i join public.products p on p.id=i.product_id and p.active and not p.is_demo left join public.pilot_vendor_product_listings l on l.product_id=p.id and l.launch_enabled left join public.launch_product_stock s on s.product_id=p.id where i.offer_id=o.id) items
 cross join lateral(select count(distinct ord.customer_id) filter(where ord.status='confirmed') buyers from public.launch_order_items li join public.launch_orders ord on ord.id=li.order_id and ord.status<>'cancelled' where li.offer_id=o.id) counts
 where cardinality(areas.ids)>0 and o.published and exists(select 1 from public.simple_sale_offer_items where offer_id=o.id) and (o.closes_at is null or o.closes_at>now()) and jsonb_array_length(coalesce(items.rows,'[]'::jsonb))=(select count(*) from public.simple_sale_offer_items where offer_id=o.id);
$$;

create or replace function public.get_public_launch_catalog(p_product_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with direct as (
  select distinct on (i->>'product_id') i||jsonb_build_object('offer_id',o->>'id','community_id',o->>'community_id','community_ids',o->'community_ids') item
  from jsonb_array_elements(public.get_public_simple_offers()) o cross join lateral jsonb_array_elements(o->'items') i
  where o->>'kind'='SOLO' and (p_product_id is null or (i->>'product_id')::uuid=p_product_id)
  order by i->>'product_id',(o->>'updated_at')::timestamptz desc,o->>'id'
 ), rows as (
  select jsonb_build_object('product_id',item->>'product_id','name',item->>'name','category',item->>'category','package_size',item->>'package_size','image_url',item->'image_url','approved_unit_price',item->'price','old_price',item->'old_price','available_quantity',item->'available_quantity','launch_enabled',true,'offer_id',item->>'offer_id','community_id',item->>'community_id','community_ids',item->'community_ids','supplier_name','','supplier_handover_days',0) row from direct
  union all
  select to_jsonb(c)||jsonb_build_object('available_quantity',l.available_quantity,'old_price',l.old_price,'launch_enabled',l.launch_enabled)
  from public.get_public_pilot_vendor_catalog(p_product_id) c join public.pilot_vendor_product_listings l on l.product_id=c.product_id
  where not exists(select 1 from direct where item->>'product_id'=c.product_id::text)
 ) select coalesce(jsonb_agg(row order by row->>'name'),'[]'::jsonb) from rows;
$$;
notify pgrst,'reload schema';
