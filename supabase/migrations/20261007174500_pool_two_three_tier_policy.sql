-- Enforce a deliberate 2–3 tier ladder for supplier-backed Pool items.
-- Pool pricing stays quantity-based; Group Deals remain people-based.

create or replace function private.validate_planning_tier()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_status text;
  v_frozen integer;
  v_delivery timestamptz;
  v_benchmark numeric;
  v_existing_count integer;
begin
  select po.status,pi.frozen_committed_quantity,po.supplier_delivery_at,pi.benchmark_price_snapshot
  into v_status,v_frozen,v_delivery,v_benchmark
  from public.pool_items pi
  join public.pools po on po.id=pi.pool_id
  where pi.id=new.pool_item_id;

  if v_status is null then raise exception 'Pool item not found'; end if;

  if new.quote_phase='planning_tier' then
    if v_status<>'draft' then
      raise exception 'Planning tiers can only be entered while the pool is Draft';
    end if;

    select count(*) into v_existing_count
    from public.supplier_quotes q
    where q.pool_item_id=new.pool_item_id
      and q.quote_phase='planning_tier'
      and (new.id is null or q.id<>new.id);

    if v_existing_count>=3 then
      raise exception 'A supplier-backed pool item can have at most 3 planning price tiers';
    end if;

    if exists(
      select 1
      from public.supplier_quotes q
      where q.pool_item_id=new.pool_item_id
        and q.quote_phase='planning_tier'
        and q.threshold_quantity=new.threshold_quantity
        and (new.id is null or q.id<>new.id)
    ) then
      raise exception 'A planning tier with this quantity threshold already exists';
    end if;

    if new.customer_ceiling_price < new.landed_unit_price then
      raise exception 'Planning customer ceiling cannot be below delivered supplier cost';
    end if;
    if new.customer_ceiling_price > v_benchmark then
      raise exception 'Planning customer ceiling cannot exceed the approved market benchmark';
    end if;

    if exists(
      select 1 from public.supplier_quotes q
      where q.pool_item_id=new.pool_item_id
        and q.quote_phase='planning_tier'
        and (new.id is null or q.id<>new.id)
        and q.threshold_quantity < new.threshold_quantity
        and q.customer_ceiling_price < new.customer_ceiling_price
    ) then
      raise exception 'Higher quantity tiers cannot unlock a worse customer price';
    end if;

    if exists(
      select 1 from public.supplier_quotes q
      where q.pool_item_id=new.pool_item_id
        and q.quote_phase='planning_tier'
        and (new.id is null or q.id<>new.id)
        and q.threshold_quantity > new.threshold_quantity
        and q.customer_ceiling_price > new.customer_ceiling_price
    ) then
      raise exception 'Lower quantity tiers cannot undercut an existing higher tier';
    end if;
  else
    if v_status not in ('pricing','final_price') then
      raise exception 'Final supplier quotes require frozen demand in Pricing';
    end if;
    if coalesce(new.delivery_included,false)=false then
      raise exception 'Final supplier quote must include delivery';
    end if;
    if v_frozen is null or v_frozen<1 or new.quantity<>v_frozen then
      raise exception 'Final supplier quote quantity must match frozen demand';
    end if;
    if new.available_quantity is not null and new.available_quantity<v_frozen then
      raise exception 'Final supplier quote does not cover frozen demand';
    end if;
    if v_delivery is not null and (new.delivery_target_at is null or new.delivery_target_at>v_delivery) then
      raise exception 'Final supplier delivery target misses the pool handover target';
    end if;
  end if;

  return new;
end; $$;

create or replace function private.enforce_pool_supplier_tier_count()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='draft' and new.status='open' then
    if exists(
      select 1
      from public.pool_items pi
      join public.products pr on pr.id=pi.product_id
      where pi.pool_id=new.id
        and pi.active
        and pr.source_type='SUPPLIER_POOL'
        and (
          select count(*)
          from public.supplier_quotes q
          where q.pool_item_id=pi.id
            and q.quote_phase='planning_tier'
            and (q.valid_until is null or q.valid_until>=current_date)
        ) not between 2 and 3
    ) then
      raise exception 'Every active supplier-backed pool item needs 2 or 3 valid planning price tiers before opening';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists pools_supplier_tier_count_guard on public.pools;
create trigger pools_supplier_tier_count_guard
before update of status on public.pools
for each row execute function private.enforce_pool_supplier_tier_count();

revoke all on function private.validate_planning_tier() from public;
revoke all on function private.enforce_pool_supplier_tier_count() from public;
