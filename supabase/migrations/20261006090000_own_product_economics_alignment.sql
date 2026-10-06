-- Align own-product pool economics with supplier-product economics fields.
-- This keeps one reporting contract for benchmark, effective cost, final price,
-- customer saving and 2-TBR gross contribution without changing own-product COGS logic.

create or replace function private.sync_own_pool_item_economics()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_source_type text;
  v_landed numeric(12,2);
begin
  select source_type into v_source_type
  from public.products
  where id=new.product_id;

  if v_source_type is null or v_source_type='SUPPLIER_POOL' then
    return new;
  end if;

  if new.final_customer_price is null then
    new.effective_cost_per_unit:=null;
    new.platform_margin_per_unit:=null;
    new.customer_saving_per_unit:=null;
    new.commercialized_at:=null;
    return new;
  end if;

  select total_landed_cost into v_landed
  from public.own_product_costs
  where product_id=new.product_id;

  if v_landed is null then
    raise exception 'Own-product landed cost is required before commercialization';
  end if;
  if new.final_customer_price<v_landed then
    raise exception 'Own-product final price cannot be below landed cost %',v_landed;
  end if;
  if new.final_customer_price>new.benchmark_price_snapshot then
    raise exception 'Own-product final price cannot exceed benchmark %',new.benchmark_price_snapshot;
  end if;

  new.variable_cost_per_unit:=0;
  new.supplier_rebate_per_unit:=0;
  new.brand_support_per_unit:=0;
  new.effective_cost_per_unit:=round(v_landed,2);
  new.platform_margin_per_unit:=round(new.final_customer_price-v_landed,2);
  new.customer_saving_per_unit:=round(new.benchmark_price_snapshot-new.final_customer_price,2);
  new.commercialized_at:=coalesce(new.commercialized_at,now());
  return new;
end;
$$;

drop trigger if exists sync_own_pool_item_economics on public.pool_items;
create trigger sync_own_pool_item_economics
before insert or update of product_id,final_customer_price,benchmark_price_snapshot
on public.pool_items
for each row
execute function private.sync_own_pool_item_economics();

-- Backfill already-commercialized own-product pool items so reporting uses
-- the same common economics fields as supplier products.
update public.pool_items pi
set final_customer_price=pi.final_customer_price
from public.products pr
where pr.id=pi.product_id
  and pr.source_type<>'SUPPLIER_POOL'
  and pi.final_customer_price is not null;
