-- Public storefront discovery, without opening private pool, GPS, profile or deal tables.
-- Guest views are strictly read-only and show verified, active non-demo offers only.

create function public.get_public_storefront_areas()
returns table(
  community_id uuid,
  community_name text,
  community_slug text,
  center_latitude numeric,
  center_longitude numeric,
  match_radius_m integer
)
language sql stable security definer set search_path=''
as $$
  select c.id,c.name,c.slug,
    case when c.location_matching_enabled then c.center_latitude else null end,
    case when c.location_matching_enabled then c.center_longitude else null end,
    case when c.location_matching_enabled then c.match_radius_m else null end
  from public.communities c
  where c.active
  order by c.sort_order,c.name
  limit 100;
$$;
revoke all on function public.get_public_storefront_areas() from public;
grant execute on function public.get_public_storefront_areas() to anon,authenticated;

create function public.get_public_storefront_offers(p_community_id uuid default null)
returns table (
  offer_id uuid,
  offer_kind text,
  community_id uuid,
  product_id uuid,
  product_name text,
  brand text,
  category text,
  package_size text,
  unit text,
  image_url text,
  offer_title text,
  reference_price numeric,
  confirmed_price numeric,
  upcoming_price numeric,
  buyer_count bigint,
  quantity_joined bigint,
  next_threshold integer,
  closes_at timestamptz,
  price_status text
)
language sql stable security definer set search_path=''
as $$
  select
    d.id,'GROUP_DEAL'::text,dc.community_id,p.id,p.name,p.brand,p.category,p.package_size,p.unit,p.image_url,
    d.title,d.market_price_snapshot,
    private.group_deal_price(d.id,stats.buyers),
    next_tier.customer_unit_price,stats.buyers,stats.units,next_tier.buyer_threshold,
    d.closes_at,
    case when private.group_deal_price(d.id,stats.buyers) is null then 'awaiting_threshold' else 'unlocked' end
  from public.group_deals d
  join public.group_deal_communities dc on dc.group_deal_id=d.id
  join public.communities c on c.id=dc.community_id and c.active
  join public.products p on p.id=d.product_id and p.active and not p.is_demo
  cross join lateral (
    select count(distinct gc.customer_id)::bigint as buyers,
           coalesce(sum(gc.quantity),0)::bigint as units
    from public.group_deal_commitments gc
    where gc.group_deal_id=d.id and gc.status in ('qualified','fulfilled')
  ) stats
  left join lateral (
    select t.buyer_threshold,t.customer_unit_price
    from public.group_deal_tiers t
    where t.group_deal_id=d.id and t.buyer_threshold>stats.buyers
    order by t.buyer_threshold asc
    limit 1
  ) next_tier on true
  where d.status='open' and now()>=d.opens_at and now()<d.closes_at
    and (p_community_id is null or dc.community_id=p_community_id)

  union all

  select
    pi.id,'COMMUNITY_POOL'::text,po.community_id,p.id,p.name,p.brand,p.category,p.package_size,p.unit,p.image_url,
    po.title,pi.benchmark_price_snapshot,
    case when po.status in ('final_price','confirmation') then pi.final_customer_price else null end,
    null::numeric,
    stats.buyers,stats.units,null::integer,po.commitment_closes_at,
    case when po.status in ('final_price','confirmation') and pi.final_customer_price is not null
      then 'final' else 'pending_final_price' end
  from public.pool_items pi
  join public.pools po on po.id=pi.pool_id
  join public.communities c on c.id=po.community_id and c.active
  join public.products p on p.id=pi.product_id and p.active and not p.is_demo
  cross join lateral (
    select count(distinct co.customer_id)::bigint as buyers,
           coalesce(sum(co.quantity),0)::bigint as units
    from public.commitments co
    where co.pool_item_id=pi.id and co.status in ('active','confirmed')
  ) stats
  where pi.active and not coalesce(po.is_paused,false)
    and po.status in ('open','pricing','final_price','confirmation')
    and (po.opens_at is null or po.opens_at<=now())
    and case when po.status in ('open','pricing') then po.commitment_closes_at is not null and po.commitment_closes_at>now()
      else po.confirmation_closes_at is not null and po.confirmation_closes_at>now() end
    and (p_community_id is null or po.community_id=p_community_id)
  order by 18 nulls last,11
  limit 150;
$$;
revoke all on function public.get_public_storefront_offers(uuid) from public;
grant execute on function public.get_public_storefront_offers(uuid) to anon,authenticated;
