-- Runtime correction: name UNION aggregate columns before ordering/selecting them.

create or replace function public.get_supplier_open_demand()
returns table(
  supplier_id uuid,
  demand_source text,
  reference_id uuid,
  title text,
  product_name text,
  sku text,
  buyer_count bigint,
  required_units bigint,
  closes_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.supplier_memberships where user_id=v_user and active) then
    raise exception 'Supplier access required';
  end if;

  return query
  with allowed as (
    select sm.supplier_id,sp.product_id,p.name,p.sku
    from public.supplier_memberships sm
    join public.supplier_products sp on sp.supplier_id=sm.supplier_id and sp.active
    join public.products p on p.id=sp.product_id and p.active
    join public.suppliers s on s.id=sm.supplier_id and s.active
    where sm.user_id=v_user and sm.active
  ),
  combined as (
    select
      a.supplier_id as supplier_id,
      'pool'::text as demand_source,
      po.id as reference_id,
      po.title as title,
      a.name as product_name,
      a.sku as sku,
      count(distinct c.customer_id)::bigint as buyer_count,
      coalesce(sum(c.quantity),0)::bigint as required_units,
      po.commitment_closes_at as closes_at
    from allowed a
    join public.pool_items pi on pi.product_id=a.product_id and pi.active
    join public.pools po on po.id=pi.pool_id and po.status='open'
    join public.commitments c on c.pool_item_id=pi.id and c.status in ('active','confirmed')
    group by a.supplier_id,po.id,po.title,a.name,a.sku,po.commitment_closes_at
    having count(distinct c.customer_id)>=5

    union all

    select
      a.supplier_id as supplier_id,
      'group_deal'::text as demand_source,
      gd.id as reference_id,
      gd.title as title,
      a.name as product_name,
      a.sku as sku,
      count(distinct gc.customer_id)::bigint as buyer_count,
      coalesce(sum(gc.quantity),0)::bigint as required_units,
      gd.closes_at as closes_at
    from allowed a
    join public.group_deals gd on gd.product_id=a.product_id and gd.status='open'
    join public.group_deal_commitments gc on gc.group_deal_id=gd.id and gc.status='qualified'
    group by a.supplier_id,gd.id,gd.title,a.name,a.sku,gd.closes_at
    having count(distinct gc.customer_id)>=5
  )
  select
    c.supplier_id,c.demand_source,c.reference_id,c.title,c.product_name,c.sku,
    c.buyer_count,c.required_units,c.closes_at
  from combined c
  order by c.closes_at;
end $$;

revoke all on function public.get_supplier_open_demand() from public,anon,authenticated,service_role;
grant execute on function public.get_supplier_open_demand() to authenticated;
