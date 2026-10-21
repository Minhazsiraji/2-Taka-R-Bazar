-- Owner-approved customer browsing for six real vendor-held products.
-- These are NOT commerce offers, reserved/verified stock, confirmed prices,
-- Finance postings, online checkout activation or supplier volume guarantees.
create table public.pilot_vendor_product_listings (
 product_id uuid primary key references public.products(id) on delete restrict,
 supplier_id uuid not null references public.suppliers(id) on delete restrict,
 approved_unit_price numeric(12,2) not null check(approved_unit_price>0),
 source_audit_id bigint not null,
 published boolean not null default false,
 approved_by uuid not null references auth.users(id),
 published_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index pilot_vendor_listing_supplier_idx on public.pilot_vendor_product_listings(supplier_id,published);
alter table public.pilot_vendor_product_listings enable row level security;
revoke all on public.pilot_vendor_product_listings from public,anon,authenticated,service_role;
-- Public information is exposed only through this narrow, read-only RPC.
create function public.get_public_pilot_vendor_catalog(p_product_id uuid default null)
 returns table(
  product_id uuid, name text, category text, package_size text,
  image_url text, approved_unit_price numeric, supplier_name text,
  supplier_handover_days integer
 )
 language sql stable security definer set search_path='' as $vendor_booking_public$
 select p.id,p.name,p.category,p.package_size,p.image_url,
   l.approved_unit_price,s.business_name,d.supplier_handover_days
 from public.pilot_vendor_product_listings l
 join public.products p on p.id=l.product_id and p.active and not p.is_demo
  and p.source_type='SUPPLIER_POOL'
 join public.suppliers s on s.id=l.supplier_id and s.active and s.reliability_status<>'blocked'
 join public.supplier_products sp on sp.product_id=p.id and sp.supplier_id=s.id and sp.active
 join public.vendor_offer_drafts d on d.product_id=p.id and d.supplier_id=s.id
  and d.status='draft' and d.source_audit_id=l.source_audit_id
  and d.proposed_sale_price=l.approved_unit_price and d.supply_mode='on_demand'
 where l.published
  and (p_product_id is null or p.id=p_product_id)
 order by l.published_at,p.name
 limit 24
 $vendor_booking_public$;
revoke all on function public.get_public_pilot_vendor_catalog(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_public_pilot_vendor_catalog(uuid) to anon,authenticated;

-- This release has explicit owner approval to display precisely the six
-- audited pilot products. Preserve supplier type, synthetic exclusion and
-- independent booking/manual-payment gates. Never show vendor purchase cost.
do $publish_pilot_vendor$
declare
 v_audit bigint:=958;
 v_vendor uuid:='0814a10b-f4dd-4239-a267-aeddadb355d6'::uuid;
 v_owner uuid; v_count integer; v_sum numeric;
begin
 select owner_user_id into v_owner from private.platform_owner_identity where singleton;
 -- A disposable test DB has no live owner audit. Do not insert any
 -- unpublished or synthetic listings there; real Production must validate all six.
 if not exists(
  select 1 from public.audit_events where id=v_audit
   and event_type='owner_revised_vendor_product_pricing'
   and metadata->>'supplier_id'=v_vendor::text
   and metadata->>'direct_exclusive_price_status'='draft_unpublished'
 ) then return;end if;
 if v_owner is null then raise exception 'A verified platform owner is required';end if;
 select count(*),coalesce(sum(d.proposed_sale_price),0)
 into v_count,v_sum
 from public.vendor_offer_drafts d
 join public.products p on p.id=d.product_id and p.active and not p.is_demo
  and p.source_type='SUPPLIER_POOL'
 join public.suppliers s on s.id=d.supplier_id and s.active
  and s.business_name='MashaAllah Grocery — Nabinagar'
 join public.supplier_products sp on sp.product_id=p.id
  and sp.supplier_id=s.id and sp.active
 where d.supplier_id=v_vendor and d.source_audit_id=v_audit
 and d.status='draft' and d.supply_mode='on_demand'
 and d.confirmation_policy='confirm_per_order'
 and d.supplier_handover_days=1 and d.proposed_sale_price>d.vendor_unit_cost;
 if v_count<>6 or v_sum<>6220 then
  raise exception 'Refusing catalog publication: six exact approved prices expected (% rows, % total)',v_count,v_sum;
 end if;
 insert into public.pilot_vendor_product_listings(
   product_id,supplier_id,approved_unit_price,source_audit_id,published,approved_by)
 select d.product_id,d.supplier_id,d.proposed_sale_price,v_audit,true,v_owner
 from public.vendor_offer_drafts d
 join public.products p on p.id=d.product_id and p.active and not p.is_demo and p.source_type='SUPPLIER_POOL'
 where d.supplier_id=v_vendor and d.source_audit_id=v_audit and d.status='draft';
 if (select count(*) from public.pilot_vendor_product_listings where published and source_audit_id=v_audit)<>6
 then raise exception 'All six approved product listings must publish atomically';end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(null,'owner_approved_pilot_vendor_catalog_published','product_catalog',null,
 jsonb_build_object('approved_source_audit',v_audit,'vendor_id',v_vendor,
 'product_count',6,'published_price_total_for_one_each_bdt',v_sum,
 'owner_requested_live',true,'product_sale_mode','booking_only',
 'requires_staff_booking_confirmation',true,
 'online_checkout_enabled',false,'inventory_quantity_created',false,
 'payment_destination_activated',false,'financial_posting_created',false));
end $publish_pilot_vendor$;
