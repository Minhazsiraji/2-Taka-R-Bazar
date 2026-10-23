-- Public offer feed: one parent offer, independent progress for each community's OPEN cycle.
-- The browsing screen must choose a community before showing earned tiers.
create or replace function public.get_public_simple_offers()
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'id',o.id,'kind',o.kind,'community_id',areas.ids[1],
 'community_ids',areas.ids,'community_name',areas.names,
 'title',o.title,'updated_at',o.updated_at,
 'closes_at',coalesce((select min(cy.closes_at) from public.simple_sale_cycles cy
   where cy.offer_id=o.id and cy.status='open'),o.closes_at),
 'items',items.rows,
 'buyer_count',0,'pending_buyers',0,'buyer_target',o.buyer_target,
 'community_progress',coalesce(progress.rows,'[]'::jsonb)
) order by o.updated_at desc),'[]'::jsonb)
from public.simple_sale_offers o
cross join lateral(
 select array_agg(c.id order by (c.id=o.community_id) desc,c.name,c.id) ids,
 string_agg(c.name,', ' order by (c.id=o.community_id) desc,c.name,c.id) names
 from public.simple_sale_offer_communities a
 join public.communities c on c.id=a.community_id and c.active where a.offer_id=o.id
) areas
cross join lateral(
 select jsonb_agg(jsonb_build_object(
 'community_id',a.community_id,'cycle_id',cy.id,
 'buyer_count',coalesce((select count(*) from public.simple_sale_cycle_members m where m.cycle_id=cy.id),0),
 'closes_at',coalesce(cy.closes_at,o.closes_at)
 ) order by a.community_id) rows
 from public.simple_sale_offer_communities a
 join public.communities c on c.id=a.community_id and c.active
 left join public.simple_sale_cycles cy on cy.offer_id=o.id
 and cy.community_id=a.community_id and cy.status='open'
 where a.offer_id=o.id
) progress
cross join lateral(
 select jsonb_agg(jsonb_build_object(
 'product_id',p.id,'name',p.name,'brand',p.brand,'category',p.category,
 'package_size',p.package_size,'unit',p.unit,'image_url',p.image_url,
 'price',i.price,'base_price',i.price,'old_price',i.old_price,
 'next_threshold',(select min(t.buyer_threshold) from public.simple_sale_offer_tiers t
 where t.offer_id=o.id and t.product_id=i.product_id),
 'next_price',(select t.unit_price from public.simple_sale_offer_tiers t where
 t.offer_id=o.id and t.product_id=i.product_id order by t.buyer_threshold,t.tier_no limit 1),
 'tiers',coalesce((select jsonb_agg(jsonb_build_object(
 'minimum',t.buyer_threshold,'price',t.unit_price) order by t.tier_no)
 from public.simple_sale_offer_tiers t where t.offer_id=o.id and t.product_id=i.product_id),'[]'::jsonb),
 'available_quantity',coalesce(l.available_quantity,s.available_quantity,0)
 ) order by p.name) rows
 from public.simple_sale_offer_items i join public.products p
 on p.id=i.product_id and p.active and not p.is_demo
 left join public.pilot_vendor_product_listings l on l.product_id=p.id and l.launch_enabled
 left join public.launch_product_stock s on s.product_id=p.id
 where i.offer_id=o.id
) items
where cardinality(areas.ids)>0 and o.published
and exists(select 1 from public.simple_sale_offer_items i where i.offer_id=o.id)
and (
 (o.kind='SOLO' and (o.closes_at is null or o.closes_at>now())) or
 (o.kind in ('GROUP_DEAL','COMMUNITY_POOL') and
  (exists(select 1 from public.simple_sale_cycles cy where cy.offer_id=o.id
    and cy.status='open' and (cy.closes_at is null or cy.closes_at>now()))
   or (not exists(select 1 from public.simple_sale_cycles cy where cy.offer_id=o.id)
     and (o.closes_at is null or o.closes_at>now()))))
)
and jsonb_array_length(coalesce(items.rows,'[]'::jsonb))=
 (select count(*) from public.simple_sale_offer_items i where i.offer_id=o.id);
$$;
