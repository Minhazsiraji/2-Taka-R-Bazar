-- 2-TAKA-R-BAZAR own products: source, economics, pricing and inventory.
alter table public.products add column source_type text not null default 'SUPPLIER_POOL';
alter table public.products add column manufacturer_reference text;
alter table public.products add column batch_number text;
alter table public.products add column manufacture_date date;
alter table public.products add column expiry_date date;
alter table public.products add constraint products_source_type_check check (source_type in ('SUPPLIER_POOL','DIRECT_PRODUCT','PRIVATE_LABEL','EXCLUSIVE_PARTNER'));
alter table public.products add constraint products_expiry_after_mfg check (expiry_date is null or manufacture_date is null or expiry_date >= manufacture_date);

-- Publicly readable product images; only Admin/Super Admin may create or delete objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy own_product_images_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id='product-images' and (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
);
create policy own_product_images_admin_select on storage.objects
for select to authenticated using (
  bucket_id='product-images' and (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
);
create policy own_product_images_admin_delete on storage.objects
for delete to authenticated using (
  bucket_id='product-images' and (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
);

create table public.own_product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  purchase_cost numeric(12,2) not null default 0 check (purchase_cost >= 0),
  packaging_cost numeric(12,2) not null default 0 check (packaging_cost >= 0),
  inbound_transport numeric(12,2) not null default 0 check (inbound_transport >= 0),
  handling_cost numeric(12,2) not null default 0 check (handling_cost >= 0),
  other_landed_cost numeric(12,2) not null default 0 check (other_landed_cost >= 0),
  total_landed_cost numeric(12,2) generated always as (round(purchase_cost+packaging_cost+inbound_transport+handling_cost+other_landed_cost,2)) stored,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table public.own_product_inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  fulfilled_quantity integer not null default 0 check (fulfilled_quantity >= 0),
  updated_at timestamptz not null default now(),
  check (reserved_quantity <= stock_on_hand)
);create table public.own_product_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete set null,
  movement_type text not null check (movement_type in ('PURCHASE_IN','MANUAL_ADJUSTMENT','RESERVATION','RESERVATION_RELEASE','SALE_FULFILMENT','RETURN')),
  quantity integer not null check (quantity > 0),
  event_key text not null unique,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index own_product_inventory_movements_product_idx on public.own_product_inventory_movements(product_id,created_at desc);

alter table public.pool_items add column pricing_mode text;
alter table public.pool_items add column own_fixed_price numeric(12,2);
alter table public.pool_items add column own_target_quantity integer;
alter table public.pool_items add column own_target_price numeric(12,2);
alter table public.pool_items add constraint pool_items_pricing_mode_check check (pricing_mode is null or pricing_mode in ('FIXED_POOL_PRICE','QUANTITY_TIER','TARGET_PRICE'));
alter table public.pool_items add constraint pool_items_own_fixed_check check (own_fixed_price is null or own_fixed_price > 0);
alter table public.pool_items add constraint pool_items_own_target_qty_check check (own_target_quantity is null or own_target_quantity > 0);
alter table public.pool_items add constraint pool_items_own_target_price_check check (own_target_price is null or own_target_price > 0);

create table public.own_product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  pool_item_id uuid not null references public.pool_items(id) on delete cascade,
  min_quantity integer not null check (min_quantity > 0),
  unit_price numeric(12,2) not null check (unit_price > 0),
  created_at timestamptz not null default now(),
  unique(pool_item_id,min_quantity)
);alter table public.own_product_costs enable row level security;
alter table public.own_product_inventory enable row level security;
alter table public.own_product_inventory_movements enable row level security;
alter table public.own_product_price_tiers enable row level security;

create policy own_product_costs_admin on public.own_product_costs for all to authenticated
  using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'))
  with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'));
create policy own_product_inventory_admin on public.own_product_inventory for all to authenticated
  using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'))
  with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'));
create policy own_product_inventory_movements_admin on public.own_product_inventory_movements for select to authenticated
  using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'));
create policy own_product_price_tiers_admin on public.own_product_price_tiers for all to authenticated
  using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'))
  with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin'));
create policy own_product_price_tiers_customer_read on public.own_product_price_tiers for select to authenticated
  using (exists(select 1 from public.pool_items pi join public.pools po on po.id=pi.pool_id join public.profiles p on p.id=auth.uid()
    where pi.id=own_product_price_tiers.pool_item_id and pi.active and po.community_id=p.community_id and po.status not in ('draft','cancelled')));

grant select,insert,update,delete on public.own_product_costs,public.own_product_inventory,public.own_product_price_tiers to authenticated;
grant select on public.own_product_inventory_movements to authenticated;
revoke select on public.own_product_costs,public.own_product_inventory,public.own_product_inventory_movements from anon;

create or replace function private.is_own_product(p_product_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.products where id=p_product_id and source_type in ('DIRECT_PRODUCT','PRIVATE_LABEL','EXCLUSIVE_PARTNER'));
$$;
revoke all on function private.is_own_product(uuid) from public;create or replace function public.admin_upsert_own_product(p_product_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid:=p_product_id; v_source text; v_initial integer;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  v_source:=coalesce(nullif(p_data->>'source_type',''),'DIRECT_PRODUCT');
  if v_source not in ('DIRECT_PRODUCT','PRIVATE_LABEL','EXCLUSIVE_PARTNER') then raise exception 'Invalid own-product source'; end if;
  if coalesce(trim(p_data->>'name'),'')='' or coalesce(trim(p_data->>'category'),'')='' or coalesce(trim(p_data->>'package_size'),'')='' or coalesce(trim(p_data->>'unit'),'')='' or coalesce(trim(p_data->>'sku'),'')='' then raise exception 'Complete required product fields'; end if;
  if v_id is null then
    insert into public.products(name,brand,category,package_size,unit,sku,image_url,is_demo,active,source_type,manufacturer_reference,batch_number,manufacture_date,expiry_date)
    values(trim(p_data->>'name'),nullif(trim(p_data->>'brand'),''),trim(p_data->>'category'),trim(p_data->>'package_size'),trim(p_data->>'unit'),upper(trim(p_data->>'sku')),nullif(trim(p_data->>'image_url'),''),coalesce((p_data->>'is_demo')::boolean,false),true,v_source,nullif(trim(p_data->>'manufacturer_reference'),''),nullif(trim(p_data->>'batch_number'),''),nullif(p_data->>'manufacture_date','')::date,nullif(p_data->>'expiry_date','')::date)
    returning id into v_id;
  else
    update public.products set name=trim(p_data->>'name'),brand=nullif(trim(p_data->>'brand'),''),category=trim(p_data->>'category'),package_size=trim(p_data->>'package_size'),unit=trim(p_data->>'unit'),sku=upper(trim(p_data->>'sku')),image_url=nullif(trim(p_data->>'image_url'),''),is_demo=coalesce((p_data->>'is_demo')::boolean,false),active=coalesce((p_data->>'active')::boolean,true),source_type=v_source,manufacturer_reference=nullif(trim(p_data->>'manufacturer_reference'),''),batch_number=nullif(trim(p_data->>'batch_number'),''),manufacture_date=nullif(p_data->>'manufacture_date','')::date,expiry_date=nullif(p_data->>'expiry_date','')::date,updated_at=now() where id=v_id and source_type<>'SUPPLIER_POOL';
    if not found then raise exception 'Own product not found'; end if;
  end if;
  insert into public.own_product_costs(product_id,purchase_cost,packaging_cost,inbound_transport,handling_cost,other_landed_cost,updated_by)
  values(v_id,coalesce((p_data->>'purchase_cost')::numeric,0),coalesce((p_data->>'packaging_cost')::numeric,0),coalesce((p_data->>'inbound_transport')::numeric,0),coalesce((p_data->>'handling_cost')::numeric,0),coalesce((p_data->>'other_landed_cost')::numeric,0),v_user)
  on conflict(product_id) do update set purchase_cost=excluded.purchase_cost,packaging_cost=excluded.packaging_cost,inbound_transport=excluded.inbound_transport,handling_cost=excluded.handling_cost,other_landed_cost=excluded.other_landed_cost,updated_at=now(),updated_by=v_user;
  insert into public.own_product_inventory(product_id) values(v_id) on conflict(product_id) do nothing;
  v_initial:=greatest(coalesce((p_data->>'initial_stock')::int,0),0);
  if p_product_id is null and v_initial>0 then perform public.admin_adjust_own_stock(v_id,v_initial,'Initial stock'); end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,case when p_product_id is null then 'own_product_created' else 'own_product_updated' end,'product',v_id,jsonb_build_object('source_type',v_source));
  return v_id;
end; $$;
revoke all on function public.admin_upsert_own_product(uuid,jsonb) from public,anon;
grant execute on function public.admin_upsert_own_product(uuid,jsonb) to authenticated;create or replace function public.admin_adjust_own_stock(p_product_id uuid,p_delta integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_inv public.own_product_inventory%rowtype; v_new integer;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  if not private.is_own_product(p_product_id) then raise exception 'Own product required'; end if;
  if p_delta=0 or nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Non-zero adjustment and reason required'; end if;
  insert into public.own_product_inventory(product_id) values(p_product_id) on conflict(product_id) do nothing;
  select * into v_inv from public.own_product_inventory where product_id=p_product_id for update;
  v_new:=v_inv.stock_on_hand+p_delta;
  if v_new<0 or v_new<v_inv.reserved_quantity then raise exception 'Adjustment would reduce stock below reserved quantity'; end if;
  update public.own_product_inventory set stock_on_hand=v_new,updated_at=now() where product_id=p_product_id;
  insert into public.own_product_inventory_movements(product_id,movement_type,quantity,event_key,reason,actor_user_id)
  values(p_product_id,case when p_delta>0 then 'PURCHASE_IN' else 'MANUAL_ADJUSTMENT' end,abs(p_delta),'manual:'||gen_random_uuid(),trim(p_reason),v_user);
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_user,'own_product_stock_adjusted','product',p_product_id,jsonb_build_object('delta',p_delta,'stock_on_hand',v_new,'reason',p_reason));
end; $$;
revoke all on function public.admin_adjust_own_stock(uuid,integer,text) from public,anon;
grant execute on function public.admin_adjust_own_stock(uuid,integer,text) to authenticated;

create or replace function private.resolve_own_product_price(p_pool_item_id uuid,p_quantity integer)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare v_item public.pool_items%rowtype; v_price numeric;
begin
  select * into v_item from public.pool_items where id=p_pool_item_id;
  if not found or not private.is_own_product(v_item.product_id) then return null; end if;
  if v_item.pricing_mode='FIXED_POOL_PRICE' then return v_item.own_fixed_price; end if;
  if v_item.pricing_mode='TARGET_PRICE' then
    if p_quantity>=coalesce(v_item.own_target_quantity,2147483647) then return v_item.own_target_price; end if;
    return v_item.own_fixed_price;
  end if;
  select unit_price into v_price from public.own_product_price_tiers where pool_item_id=p_pool_item_id and min_quantity<=p_quantity order by min_quantity desc limit 1;
  return v_price;
end; $$;
revoke all on function private.resolve_own_product_price(uuid,integer) from public;create or replace function public.admin_configure_own_pool_item(p_pool_id uuid,p_product_id uuid,p_pricing_mode text,p_fixed_price numeric,p_target_quantity integer,p_target_price numeric,p_min_quantity integer,p_max_quantity integer,p_tiers jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_pool public.pools%rowtype; v_benchmark public.market_price_benchmarks%rowtype; v_item uuid; r jsonb;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  if not private.is_own_product(p_product_id) then raise exception 'Own product required'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update;
  if not found or v_pool.status<>'draft' then raise exception 'Own product can only be configured while pool is Draft'; end if;
  select * into v_benchmark from public.market_price_benchmarks where product_id=p_product_id and community_id=v_pool.community_id and approved and superseded_at is null;
  if not found then raise exception 'Approve a current market benchmark first'; end if;
  if p_pricing_mode not in ('FIXED_POOL_PRICE','QUANTITY_TIER','TARGET_PRICE') then raise exception 'Invalid pricing mode'; end if;
  if p_max_quantity<coalesce(p_min_quantity,1) then raise exception 'Invalid quantity limits'; end if;
  if p_pricing_mode='FIXED_POOL_PRICE' and coalesce(p_fixed_price,0)<=0 then raise exception 'Fixed price required'; end if;
  if p_pricing_mode='TARGET_PRICE' and (coalesce(p_target_quantity,0)<=0 or coalesce(p_target_price,0)<=0 or coalesce(p_fixed_price,0)<=0) then raise exception 'Target quantity, target price and pre-target price required'; end if;
  insert into public.pool_items(pool_id,product_id,benchmark_id,benchmark_price_snapshot,expected_pool_price,min_quantity,max_quantity,pricing_mode,own_fixed_price,own_target_quantity,own_target_price)
  values(p_pool_id,p_product_id,v_benchmark.id,v_benchmark.benchmark_price,coalesce(p_fixed_price,p_target_price),greatest(coalesce(p_min_quantity,1),1),p_max_quantity,p_pricing_mode,p_fixed_price,p_target_quantity,p_target_price)
  returning id into v_item;
  if p_pricing_mode='QUANTITY_TIER' then
    if jsonb_array_length(coalesce(p_tiers,'[]'::jsonb))=0 then raise exception 'At least one quantity tier required'; end if;
    for r in select value from jsonb_array_elements(p_tiers) loop
      insert into public.own_product_price_tiers(pool_item_id,min_quantity,unit_price) values(v_item,(r->>'min_quantity')::int,(r->>'unit_price')::numeric);
    end loop;
  end if;
  if coalesce(private.resolve_own_product_price(v_item,coalesce(p_min_quantity,1)),0)>v_benchmark.benchmark_price then raise exception 'Own-product price cannot exceed approved market benchmark'; end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'own_product_pool_configured','pool_item',v_item,jsonb_build_object('pricing_mode',p_pricing_mode));
  return v_item;
end; $$;
revoke all on function public.admin_configure_own_pool_item(uuid,uuid,text,numeric,integer,numeric,integer,integer,jsonb) from public,anon;
grant execute on function public.admin_configure_own_pool_item(uuid,uuid,text,numeric,integer,numeric,integer,integer,jsonb) to authenticated;create or replace function public.get_pool_price_unlocks(p_pool_id uuid)
returns table(pool_item_id uuid,current_quantity integer,unlocked_price numeric,unlocked_threshold integer,next_threshold integer,next_price numeric,units_needed integer)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_community uuid; v_user_community uuid; r record; v_qty int; v_price numeric; v_threshold int; v_next_threshold int; v_next_price numeric;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select community_id into v_community from public.pools where id=p_pool_id and status not in ('draft','cancelled');
  if v_community is null then raise exception 'Pool not available'; end if;
  select community_id into v_user_community from public.profiles where id=v_user;
  if v_user_community is distinct from v_community and not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin') then raise exception 'Pool is outside your community'; end if;
  for r in select pi.*,pr.source_type,po.status from public.pool_items pi join public.products pr on pr.id=pi.product_id join public.pools po on po.id=pi.pool_id where pi.pool_id=p_pool_id and pi.active loop
    select coalesce(sum(c.quantity),0)::int into v_qty from public.commitments c where c.pool_item_id=r.id and c.status in ('active','confirmed');
    v_next_threshold:=null;v_next_price:=null;
    if r.source_type='SUPPLIER_POOL' then
      v_price:=case when r.status='open' then r.best_unlocked_customer_ceiling_price else coalesce(r.frozen_customer_ceiling_price,r.best_unlocked_customer_ceiling_price) end;
      v_threshold:=case when r.status='open' then r.best_unlocked_threshold else coalesce(r.frozen_tier_threshold,r.best_unlocked_threshold) end;
      select q.threshold_quantity,q.customer_ceiling_price into v_next_threshold,v_next_price from public.supplier_quotes q where q.pool_item_id=r.id and q.quote_phase='planning_tier' and q.threshold_quantity>v_qty and q.threshold_quantity>coalesce(v_threshold,0) and (q.valid_until is null or q.valid_until>=current_date) and (v_price is null or q.customer_ceiling_price<v_price) order by q.threshold_quantity,q.customer_ceiling_price limit 1;
    else
      v_price:=private.resolve_own_product_price(r.id,v_qty);
      if r.pricing_mode='QUANTITY_TIER' then
        select max(t.min_quantity) into v_threshold from public.own_product_price_tiers t where t.pool_item_id=r.id and t.min_quantity<=v_qty;
        select t.min_quantity,t.unit_price into v_next_threshold,v_next_price from public.own_product_price_tiers t where t.pool_item_id=r.id and t.min_quantity>v_qty order by t.min_quantity limit 1;
      elsif r.pricing_mode='TARGET_PRICE' then
        v_threshold:=case when v_qty>=r.own_target_quantity then r.own_target_quantity else 1 end;
        if v_qty<r.own_target_quantity then v_next_threshold:=r.own_target_quantity;v_next_price:=r.own_target_price; end if;
      else v_threshold:=1;
      end if;
    end if;
    pool_item_id:=r.id;current_quantity:=v_qty;unlocked_price:=v_price;unlocked_threshold:=v_threshold;next_threshold:=v_next_threshold;next_price:=v_next_price;units_needed:=case when v_next_threshold is null then 0 else greatest(v_next_threshold-v_qty,0) end;return next;
  end loop;
end; $$;
revoke all on function public.get_pool_price_unlocks(uuid) from public,anon;
grant execute on function public.get_pool_price_unlocks(uuid) to authenticated;create or replace function private.reserve_own_inventory(p_order_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.order_items%rowtype; v_product public.products%rowtype; v_inv public.own_product_inventory%rowtype;
begin
  select * into v_item from public.order_items where id=p_order_item_id;
  if not found or not private.is_own_product(v_item.product_id) then return; end if;
  if exists(select 1 from public.own_product_inventory_movements where event_key='reservation:'||p_order_item_id) then return; end if;
  select * into v_product from public.products where id=v_item.product_id;
  if v_product.expiry_date is not null and v_product.expiry_date<current_date then raise exception 'Expired stock cannot be reserved'; end if;
  select * into v_inv from public.own_product_inventory where product_id=v_item.product_id for update;
  if not found or v_inv.stock_on_hand-v_inv.reserved_quantity<v_item.quantity then raise exception 'Insufficient own-product stock'; end if;
  update public.own_product_inventory set reserved_quantity=reserved_quantity+v_item.quantity,updated_at=now() where product_id=v_item.product_id;
  insert into public.own_product_inventory_movements(product_id,order_item_id,movement_type,quantity,event_key,reason,actor_user_id)
  values(v_item.product_id,v_item.id,'RESERVATION',v_item.quantity,'reservation:'||v_item.id,'Customer final confirmation',auth.uid());
end; $$;
revoke all on function private.reserve_own_inventory(uuid) from public;

create or replace function private.release_own_inventory(p_order_item_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.order_items%rowtype;
begin
  select * into v_item from public.order_items where id=p_order_item_id;
  if not found or not private.is_own_product(v_item.product_id) then return; end if;
  if not exists(select 1 from public.own_product_inventory_movements where event_key='reservation:'||p_order_item_id) then return; end if;
  if exists(select 1 from public.own_product_inventory_movements where event_key in ('release:'||p_order_item_id,'fulfilment:'||p_order_item_id)) then return; end if;
  update public.own_product_inventory set reserved_quantity=greatest(reserved_quantity-v_item.quantity,0),updated_at=now() where product_id=v_item.product_id;
  insert into public.own_product_inventory_movements(product_id,order_item_id,movement_type,quantity,event_key,reason,actor_user_id)
  values(v_item.product_id,v_item.id,'RESERVATION_RELEASE',v_item.quantity,'release:'||v_item.id,p_reason,auth.uid());
end; $$;
revoke all on function private.release_own_inventory(uuid,text) from public;create or replace function private.fulfil_own_inventory(p_order_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.order_items%rowtype; v_inv public.own_product_inventory%rowtype;
begin
  select * into v_item from public.order_items where id=p_order_item_id;
  if not found or not private.is_own_product(v_item.product_id) then return; end if;
  if exists(select 1 from public.own_product_inventory_movements where event_key='fulfilment:'||p_order_item_id) then return; end if;
  if not exists(select 1 from public.own_product_inventory_movements where event_key='reservation:'||p_order_item_id) then raise exception 'Own-product stock was not reserved'; end if;
  select * into v_inv from public.own_product_inventory where product_id=v_item.product_id for update;
  if not found or v_inv.reserved_quantity<v_item.quantity or v_inv.stock_on_hand<v_item.quantity then raise exception 'Invalid own-product inventory state'; end if;
  update public.own_product_inventory set stock_on_hand=stock_on_hand-v_item.quantity,reserved_quantity=reserved_quantity-v_item.quantity,fulfilled_quantity=fulfilled_quantity+v_item.quantity,updated_at=now() where product_id=v_item.product_id;
  insert into public.own_product_inventory_movements(product_id,order_item_id,movement_type,quantity,event_key,reason,actor_user_id)
  values(v_item.product_id,v_item.id,'SALE_FULFILMENT',v_item.quantity,'fulfilment:'||v_item.id,'Successful collection',auth.uid());
end; $$;
revoke all on function private.fulfil_own_inventory(uuid) from public;

create or replace function public.confirm_commitment_order(p_commitment_id uuid,p_pickup_point_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_c public.commitments%rowtype; v_pi public.pool_items%rowtype;
  v_pool public.pools%rowtype; v_profile public.profiles%rowtype; v_order_id uuid; v_order_status text;
  v_order_item_id uuid; v_pickup uuid; v_amount numeric(12,2); v_saving numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not private.has_active_subscription(v_user) then raise exception 'Active membership required. Renew or redeem a valid free coupon before confirming this purchase.'; end if;
  select * into v_c from public.commitments where id=p_commitment_id and customer_id=v_user for update;
  if not found or v_c.status<>'active' then raise exception 'Active commitment not found'; end if;
  select * into v_pi from public.pool_items where id=v_c.pool_item_id;
  select * into v_pool from public.pools where id=v_pi.pool_id;
  if v_pool.status<>'confirmation' then raise exception 'Pool is not in confirmation'; end if;
  if v_pi.final_customer_price is null then raise exception 'Final price is not published'; end if;
  select * into v_profile from public.profiles where id=v_user;
  if v_profile.community_id is distinct from v_pool.community_id then raise exception 'Community mismatch'; end if;
  select id,pickup_point_id,status into v_order_id,v_pickup,v_order_status from public.orders where customer_id=v_user and pool_id=v_pool.id for update;
  if found then
    if v_order_status<>'confirmed' then raise exception 'Existing order is no longer accepting confirmation'; end if;
  else
    v_pickup:=p_pickup_point_id;
    if v_pickup is null or not exists(select 1 from public.pickup_points pp join public.pool_pickup_points ppp on ppp.pickup_point_id=pp.id where ppp.pool_id=v_pool.id and pp.id=v_pickup and pp.community_id=v_pool.community_id and pp.active=true) then raise exception 'Choose one of the pickup points enabled for this pool'; end if;
    insert into public.orders(customer_id,pool_id,pickup_point_id,status,payment_status,confirmed_at) values(v_user,v_pool.id,v_pickup,'confirmed','unpaid',now()) returning id into v_order_id;
  end if;
  v_amount:=round(v_pi.final_customer_price*v_c.quantity,2); v_saving:=greatest(round((v_pi.benchmark_price_snapshot-v_pi.final_customer_price)*v_c.quantity,2),0);
  insert into public.order_items(order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price,expected_saving) values(v_order_id,v_pi.id,v_pi.product_id,v_c.quantity,v_pi.benchmark_price_snapshot,v_pi.final_customer_price,v_saving) on conflict(order_id,pool_item_id) do nothing returning id into v_order_item_id;
  if v_order_item_id is null then raise exception 'This commitment is already confirmed'; end if;
  perform private.reserve_own_inventory(v_order_item_id);
  update public.orders set total_amount=total_amount+v_amount where id=v_order_id;
  update public.commitments set status='confirmed',confirmed_at=now() where id=v_c.id;
  insert into public.fulfilments(order_id,pickup_point_id,status) values(v_order_id,v_pickup,'pending') on conflict(order_id) do nothing;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'order_item_confirmed','order',v_order_id,jsonb_build_object('commitment_id',v_c.id,'order_item_id',v_order_item_id,'amount',v_amount,'pickup_point_id',v_pickup));
  return v_order_id;
end; $$;
revoke all on function public.confirm_commitment_order(uuid,uuid) from public,anon;
grant execute on function public.confirm_commitment_order(uuid,uuid) to authenticated;

create or replace function private.release_inventory_on_order_cancel()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' then
    for r in select id from public.order_items where order_id=new.id loop perform private.release_own_inventory(r.id,coalesce(new.cancellation_reason,'Order cancelled')); end loop;
  end if; return new;
end; $$;
create trigger orders_release_own_inventory after update of status on public.orders for each row execute function private.release_inventory_on_order_cancel();

create or replace function private.fulfil_inventory_on_collection()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if new.status='collected' and old.status is distinct from 'collected' then
    for r in select id from public.order_items where order_id=new.order_id loop perform private.fulfil_own_inventory(r.id); end loop;
  end if; return new;
end; $$;
create trigger fulfilments_fulfil_own_inventory after update of status on public.fulfilments for each row execute function private.fulfil_inventory_on_collection();

create or replace view public.admin_own_product_performance with (security_invoker=true) as
select pr.id product_id,pr.name,pr.source_type,c.total_landed_cost,i.stock_on_hand,i.reserved_quantity,(i.stock_on_hand-i.reserved_quantity) available_quantity,i.fulfilled_quantity,
  coalesce(sum(oi.quantity) filter(where o.status<>'cancelled'),0)::bigint confirmed_units,
  coalesce(sum(oi.quantity) filter(where o.status='completed'),0)::bigint fulfilled_order_units,
  coalesce(sum(oi.unit_price*oi.quantity) filter(where o.status='completed'),0)::numeric(14,2) revenue,
  coalesce(sum(c.total_landed_cost*oi.quantity) filter(where o.status='completed'),0)::numeric(14,2) landed_cogs,
  coalesce(sum((oi.unit_price-c.total_landed_cost)*oi.quantity) filter(where o.status='completed'),0)::numeric(14,2) gross_contribution,
  coalesce(sum(sl.amount),0)::numeric(14,2) verified_customer_saving
from public.products pr join public.own_product_costs c on c.product_id=pr.id join public.own_product_inventory i on i.product_id=pr.id
left join public.order_items oi on oi.product_id=pr.id left join public.orders o on o.id=oi.order_id left join public.savings_ledger sl on sl.order_item_id=oi.id
group by pr.id,pr.name,pr.source_type,c.total_landed_cost,i.stock_on_hand,i.reserved_quantity,i.fulfilled_quantity;
revoke all on public.admin_own_product_performance from anon,authenticated;
grant select on public.admin_own_product_performance to authenticated;create or replace function public.admin_set_pool_status(p_pool_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_pool public.pools%rowtype; v_item_count int:=0; v_pickup_count int:=0; v_commitment_count int:=0; v_order_count int:=0; v_quote_count int:=0; v_allowed boolean:=false;
  r record; v_qty int; v_best_quote uuid; v_best_threshold int; v_best_ceiling numeric; v_own_price numeric; v_available int;
begin
  if v_user is null or (not private.has_role(v_user,'admin') and not private.has_role(v_user,'super_admin')) then raise exception 'Admin required'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update; if not found then raise exception 'Pool not found'; end if;
  select count(*) into v_item_count from public.pool_items where pool_id=p_pool_id and active;
  select count(*) into v_pickup_count from public.pool_pickup_points where pool_id=p_pool_id;
  select count(*) into v_commitment_count from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  select count(*) into v_order_count from public.orders where pool_id=p_pool_id and status<>'cancelled';
  select count(*) into v_quote_count from public.supplier_quotes q join public.pool_items pi on pi.id=q.pool_item_id where pi.pool_id=p_pool_id and q.quote_phase='final';
  if p_status='draft' then
    if v_pool.status not in ('open','pricing') then raise exception 'Only Open or Pricing pools can be returned to Draft'; end if;
    if v_commitment_count>0 or v_order_count>0 or v_quote_count>0 then raise exception 'Cannot return to Draft after commitments, supplier quotes, or orders exist'; end if;
    update public.pools set status='draft' where id=p_pool_id; insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to','draft','reason','safe_admin_reset')); return;
  end if;
  v_allowed:=(v_pool.status='draft' and p_status in ('open','cancelled')) or (v_pool.status='open' and p_status in ('pricing','cancelled')) or (v_pool.status='pricing' and p_status in ('final_price','cancelled')) or (v_pool.status='final_price' and p_status in ('confirmation','cancelled')) or (v_pool.status='confirmation' and p_status in ('ordered','cancelled')) or (v_pool.status='ordered' and p_status in ('ready_for_pickup','cancelled')) or (v_pool.status='ready_for_pickup' and p_status in ('completed','cancelled'));
  if not v_allowed then raise exception 'Invalid pool transition: % -> %',v_pool.status,p_status; end if;
  if v_pool.status='draft' and p_status='open' then
    if v_item_count=0 then raise exception 'Add at least one product before opening this pool'; end if;
    if v_pickup_count=0 then raise exception 'Select at least one pickup option before opening this pool'; end if;
    if v_pool.receiving_pickup_point_id is null or not exists(select 1 from public.pool_pickup_points where pool_id=p_pool_id and pickup_point_id=v_pool.receiving_pickup_point_id) then raise exception 'Choose a valid designated receiving point before opening'; end if;
    if v_pool.commitment_closes_at is null or v_pool.confirmation_closes_at is null or v_pool.supplier_delivery_at is null or v_pool.pickup_at is null then raise exception 'Commitment close, confirmation close, supplier delivery and pickup start are required before opening'; end if;
    if v_pool.opens_at is not null and v_pool.commitment_closes_at<=v_pool.opens_at then raise exception 'Commitment close must be after pool open time'; end if;
    if v_pool.commitment_closes_at<=now() or v_pool.confirmation_closes_at<=v_pool.commitment_closes_at or v_pool.supplier_delivery_at<=v_pool.confirmation_closes_at or v_pool.supplier_delivery_at>=v_pool.pickup_at then raise exception 'Pool timeline is invalid'; end if;
  end if;  if v_pool.status='draft' and p_status='open' then
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active and pr.source_type='SUPPLIER_POOL' and not exists(select 1 from public.supplier_quotes q where q.pool_item_id=pi.id and q.quote_phase='planning_tier' and (q.valid_until is null or q.valid_until>=current_date))) then raise exception 'Every active supplier-pool item needs a planning price tier before opening'; end if;
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id left join public.own_product_inventory oi on oi.product_id=pi.product_id where pi.pool_id=p_pool_id and pi.active and pr.source_type<>'SUPPLIER_POOL' and (pi.pricing_mode is null or coalesce(oi.stock_on_hand-oi.reserved_quantity,0)<=0)) then raise exception 'Every own-product item needs pricing configuration and available stock before opening'; end if;
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active and pr.source_type<>'SUPPLIER_POOL' and private.resolve_own_product_price(pi.id,pi.min_quantity) is null) then raise exception 'Own-product pricing must provide a valid starting price'; end if;
  end if;

  if v_pool.status='open' and p_status='pricing' then
    if v_commitment_count=0 then raise exception 'No customer commitments exist. Keep the pool open or cancel it instead of moving to Pricing'; end if;
    for r in select pi.id,pi.product_id,pr.source_type from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active loop
      select coalesce(sum(quantity),0)::int into v_qty from public.commitments where pool_item_id=r.id and status in ('active','confirmed');
      if r.source_type='SUPPLIER_POOL' then
        perform private.refresh_pool_item_unlock(r.id);
        select best_unlocked_tier_quote_id,best_unlocked_threshold,best_unlocked_customer_ceiling_price into v_best_quote,v_best_threshold,v_best_ceiling from public.pool_items where id=r.id;
        if v_qty=0 then update public.pool_items set frozen_committed_quantity=0,pricing_locked_at=now(),active=false where id=r.id;
        elsif v_best_ceiling is null then update public.pool_items set frozen_committed_quantity=v_qty,pricing_locked_at=now(),active=false where id=r.id; update public.commitments set status='cancelled' where pool_item_id=r.id and status='active';
        else update public.pool_items set frozen_committed_quantity=v_qty,frozen_tier_quote_id=v_best_quote,frozen_tier_threshold=v_best_threshold,frozen_customer_ceiling_price=v_best_ceiling,pricing_locked_at=now() where id=r.id; end if;
      else
        if v_qty=0 then update public.pool_items set frozen_committed_quantity=0,pricing_locked_at=now(),active=false where id=r.id; continue; end if;
        v_own_price:=private.resolve_own_product_price(r.id,v_qty);
        if v_own_price is null then update public.pool_items set frozen_committed_quantity=v_qty,pricing_locked_at=now(),active=false where id=r.id; update public.commitments set status='cancelled' where pool_item_id=r.id and status='active'; continue; end if;
        select stock_on_hand-reserved_quantity into v_available from public.own_product_inventory where product_id=r.product_id for update;
        if coalesce(v_available,0)<v_qty then raise exception 'Own-product stock is below frozen demand for product %',r.product_id; end if;
        update public.pool_items set frozen_committed_quantity=v_qty,frozen_customer_ceiling_price=v_own_price,final_customer_price=v_own_price,pricing_locked_at=now() where id=r.id;
      end if;
      insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pool_item_demand_frozen','pool_item',r.id,jsonb_build_object('quantity',v_qty,'source_type',r.source_type));
    end loop;
    if not exists(select 1 from public.pool_items where pool_id=p_pool_id and active) then raise exception 'No pool item reached a valid price. Keep the pool open or cancel it.'; end if;
  end if;  if v_pool.status='pricing' and p_status='final_price' then
    if exists(select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id where pi.pool_id=p_pool_id and pi.active and ((pr.source_type='SUPPLIER_POOL' and (pi.final_customer_price is null or pi.selected_supplier_quote_id is null)) or (pr.source_type<>'SUPPLIER_POOL' and pi.final_customer_price is null))) then raise exception 'Every active item needs a final customer price; supplier items also need a winning quote'; end if;
  end if;
  if v_pool.status='confirmation' and p_status='ordered' and v_order_count=0 then raise exception 'No confirmed customer orders exist. Do not move an empty pool to Ordered'; end if;
  if v_pool.status='ordered' and p_status='ready_for_pickup' and exists(
    select 1 from public.pool_items pi join public.products pr on pr.id=pi.product_id
    left join public.supplier_receipts sr on sr.pool_item_id=pi.id and sr.supplier_quote_id=pi.selected_supplier_quote_id
    where pi.pool_id=p_pool_id and pi.active and pr.source_type='SUPPLIER_POOL'
      and (pi.selected_supplier_quote_id is null or sr.id is null or sr.status<>'received' or sr.received_quantity<sr.expected_quantity)
  ) then raise exception 'Required supplier deliveries must be fully received before customer pickup can start'; end if;

  update public.pools set status=p_status where id=p_pool_id;
  if p_status='ordered' then
    update public.orders set status='ordered' where pool_id=p_pool_id and status='confirmed';
    update public.commitments c set status='cancelled' from public.pool_items pi where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status='active';
  end if;
  if p_status='ready_for_pickup' then
    update public.orders set status='ready_for_pickup',ready_at=now() where pool_id=p_pool_id and status in ('confirmed','ordered');
    update public.fulfilments f set status='ready' from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status='pending';
  end if;
  if p_status='cancelled' then
    update public.orders set status='cancelled',cancelled_at=now(),cancellation_reason=coalesce(cancellation_reason,'Pool cancelled by operations') where pool_id=p_pool_id and status<>'completed';
    update public.fulfilments f set status='cancelled' from public.orders o where f.order_id=o.id and o.pool_id=p_pool_id and f.status<>'collected';
    update public.commitments c set status='cancelled' from public.pool_items pi where c.pool_item_id=pi.id and pi.pool_id=p_pool_id and c.status in ('active','confirmed');
  end if;
  if p_status='completed' and exists(select 1 from public.orders where pool_id=p_pool_id and status not in ('completed','cancelled')) then raise exception 'All orders must be completed or cancelled'; end if;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_user,'pool_status_changed','pool',p_pool_id,jsonb_build_object('from',v_pool.status,'to',p_status));
end; $$;
revoke all on function public.admin_set_pool_status(uuid,text) from public,anon;
grant execute on function public.admin_set_pool_status(uuid,text) to authenticated;