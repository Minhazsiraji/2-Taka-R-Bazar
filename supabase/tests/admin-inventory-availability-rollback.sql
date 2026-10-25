-- Fictional and rollback-only: audit vendor sellable allocation without
-- representing it as physical inventory or editing any real pilot orders.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
do $scenario$
declare
 admin_u uuid:=gen_random_uuid();buyer_u uuid:=gen_random_uuid();
 vendor uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();
 old_quantity integer:=24;old_price numeric:=125; blocked boolean;
 audit_before integer;order_before integer;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 (admin_u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventory-admin-'||admin_u||'@example.invalid',now(),now()),
 (buyer_u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventory-buyer-'||buyer_u||'@example.invalid',now(),now());
 insert into public.user_roles(user_id,role) values(admin_u,'admin');
 insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
 values(pid,'Fictional 2TBR Butter','Dairy','1 kg','kg','TEST-INV-'||pid,'SUPPLIER_POOL',true,false);
 insert into public.suppliers(id,business_name,active,reliability_status)
 values(vendor,'Fictional Vendor (rollback)',true,'unrated');
 insert into public.supplier_products(supplier_id,product_id,active,relationship_type)
 values(vendor,pid,true,'vendor');
 insert into public.vendor_offer_drafts(product_id,supplier_id,vendor_unit_cost,proposed_sale_price,updated_by,source_audit_id)
 values(pid,vendor,85,old_price,admin_u,1);
 insert into public.pilot_vendor_product_listings
 (product_id,supplier_id,approved_unit_price,source_audit_id,published,approved_by,launch_enabled,available_quantity,old_price)
 values(pid,vendor,old_price,1,true,admin_u,true,old_quantity,150);
 select count(*) into audit_before from private.pilot_listing_availability_audit where product_id=pid;
 select count(*) into order_before from public.launch_orders;
 perform set_config('request.jwt.claim.sub',buyer_u::text,true);
 blocked:=false;
 begin perform public.admin_set_pilot_listing_availability(pid,old_quantity,30,'Unauthorized buyer adjustment');
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Customer could change supplier allocation';end if;
 blocked:=false;
 begin perform 1 from public.admin_get_pilot_inventory() where product_id=pid;
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Customer could access admin-only inventory';end if;
 perform set_config('request.jwt.claim.sub',admin_u::text,true);
 if (select count(*) from public.admin_get_pilot_inventory() where product_id=pid)<>1
 then raise exception 'Admin inventory list missed product';end if;
 if public.admin_set_pilot_listing_availability(pid,old_quantity,30,
   'Supplier confirmed 30 sellable units for the upcoming pilot')<>30
 then raise exception 'Allocation adjustment returned wrong quantity';end if;
 if (select available_quantity from public.pilot_vendor_product_listings where product_id=pid)<>30
 then raise exception 'Allocation adjustment did not persist';end if;
 blocked:=false;
 begin perform public.admin_set_pilot_listing_availability(pid,old_quantity,50,
   'Stale availability from an older admin tab');
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Stale update overwrote newer quantity';end if;
 blocked:=false;
 begin perform public.admin_set_pilot_listing_availability(pid,30,-1,'Invalid negative vendor allocation');
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Negative quantity was accepted';end if;
 blocked:=false;
 begin perform public.admin_set_pilot_listing_availability(pid,30,22,'');
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Adjustment without reason was accepted';end if;
 if public.admin_set_pilot_listing_availability(pid,30,30,
   'Idempotent same quantity retry')<>30
 then raise exception 'Idempotent replay failed';end if;
 if (select count(*) from private.pilot_listing_availability_audit where product_id=pid)<>audit_before+1
 then raise exception 'Exactly one audit record was not created';end if;
 if (select approved_unit_price from public.pilot_vendor_product_listings where product_id=pid)<>old_price
 then raise exception 'Availability update changed price';end if;
 if (select count(*) from public.launch_orders)<>order_before
 then raise exception 'Inventory update changed customer orders';end if;
end $scenario$;
select ok(true,'Pilot vendor availability: owner-only read/write, audited optimistic update, stale/negative/no-reason rejection, no quote/order/price mutation');
select * from finish();
rollback;
