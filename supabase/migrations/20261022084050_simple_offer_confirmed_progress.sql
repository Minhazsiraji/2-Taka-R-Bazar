-- Verified Buyer Progress for published simple offers.
-- Cart/local drafts never become a joined buyer. Only independently confirmed
-- launch orders count. Requested orders are exposed as aggregate pending count.
ALTER TABLE public.simple_sale_offers ADD COLUMN IF NOT EXISTS buyer_target integer;
ALTER TABLE public.simple_sale_offers
 ADD CONSTRAINT simple_sale_offer_buyer_target_valid
 CHECK(buyer_target IS NULL OR buyer_target BETWEEN 2 AND 100000);
-- The platform's published minimum for a Group Deal is 5 verified buyers.
-- This is a participation goal, NOT a fabricated tier price or price unlock.
UPDATE public.simple_sale_offers SET buyer_target=5
 WHERE kind='GROUP_DEAL' AND buyer_target IS NULL;

CREATE OR REPLACE FUNCTION public.admin_save_simple_offer_with_target(
 p_id uuid,p_kind text,p_communities uuid[],p_title text,p_items jsonb,
 p_published boolean,p_closes timestamptz,p_target integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); oid uuid;
BEGIN
 IF u IS NULL OR NOT(private.has_role(u,'admin') OR private.has_role(u,'super_admin'))
  THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF p_kind='GROUP_DEAL' AND (p_target IS NULL OR p_target NOT BETWEEN 5 AND 100000)
  THEN RAISE EXCEPTION 'Group Deals require a confirmed-buyer target of at least 5'; END IF;
 IF p_kind='COMMUNITY_POOL' AND p_target IS NOT NULL AND p_target NOT BETWEEN 2 AND 100000
  THEN RAISE EXCEPTION 'Invalid Pool participation target'; END IF;
 IF p_kind='SOLO' AND p_target IS NOT NULL
  THEN RAISE EXCEPTION 'Direct products cannot have a participation target'; END IF;
 oid:=public.admin_save_simple_offer_areas(
   p_id,p_kind,p_communities,p_title,p_items,p_published,p_closes);
 UPDATE public.simple_sale_offers SET buyer_target=CASE WHEN p_kind='SOLO' THEN NULL ELSE p_target END WHERE id=oid;
 RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_simple_offer_with_target(uuid,text,uuid[],text,jsonb,boolean,timestamptz,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_simple_offer_with_target(uuid,text,uuid[],text,jsonb,boolean,timestamptz,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_simple_offers()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
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
  select count(distinct ord.customer_id) filter(where ord.status='confirmed') buyers,
   count(distinct ord.customer_id) filter(where ord.status='requested') pending_buyers
  from public.launch_order_items li join public.launch_orders ord
   on ord.id=li.order_id and ord.status<>'cancelled'
  where li.offer_id=o.id
 ) counts
 where cardinality(areas.ids)>0 and o.published
  and exists(select 1 from public.simple_sale_offer_items where offer_id=o.id)
  and (o.closes_at is null or o.closes_at>now())
  and jsonb_array_length(coalesce(items.rows,'[]'::jsonb))=
   (select count(*) from public.simple_sale_offer_items where offer_id=o.id);
$$;
