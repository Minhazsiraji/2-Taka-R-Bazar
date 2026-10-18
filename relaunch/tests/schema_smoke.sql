-- Clean v2 commerce smoke runs against disposable local Postgres only.
-- If any assertion is wrong, RAISE aborts GitHub CI.
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000011001'),
 ('00000000-0000-4000-8000-000000011002'),
 ('00000000-0000-4000-8000-000000011003');
insert into public.store_members(user_id,role) values
 ('00000000-0000-4000-8000-000000011001','super_admin'),
 ('00000000-0000-4000-8000-000000011002','customer');
insert into public.store_products(id,sku,title,unit,regular_price,on_hand,status)
values
 ('00000000-0000-4000-8000-000000011011','V2-GHEE-1KG','Test Ghee','pack',1450,3,'live'),
 ('00000000-0000-4000-8000-000000011012','V2-BUTTER-1KG','Test Butter','pack',1240,10,'live');
insert into public.store_offers(id,title,kind,min_households,status)
values ('00000000-0000-4000-8000-000000011013','Test Ghee pool','pool',2,'live');
insert into public.store_offer_items(offer_id,product_id,offer_price)
values ('00000000-0000-4000-8000-000000011013',
 '00000000-0000-4000-8000-000000011011',1300);
update public.store_settings set home_delivery_fee=80 where id=true;

-- Anonymous can browse published inventory, but can't access order PII.
set role anon;
do $$
begin
 if (select count(*) from public.store_products where status='live')<>2
 then raise exception 'Published catalog not publicly accessible';end if;
 if has_table_privilege('anon','public.store_orders','SELECT')
 then raise exception 'Order PII was exposed to anonymous users';end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011002',false);
do $$
declare
 v_order uuid;v_retry uuid;v_group uuid;v_home uuid;
 v_total numeric;
begin
 if public.store_is_staff() then raise exception 'Customer escalated privileges';end if;
 if has_table_privilege('authenticated','public.store_orders','UPDATE')
 then raise exception 'Customer can modify order status directly';end if;
 begin
   perform public.store_set_role('00000000-0000-4000-8000-000000011002','admin');
   raise exception 'Role escalation was accepted';
 exception when insufficient_privilege then null;
 end;
 select public.store_place_order(
  '[{"product_id":"00000000-0000-4000-8000-000000011011","quantity":1}]'::jsonb,
  null,'pickup',null,'Test Customer','01700000001',
  '00000000-0000-4000-8000-000000011101') into v_order;
 select public.store_place_order(
  '[{"product_id":"00000000-0000-4000-8000-000000011011","quantity":1}]'::jsonb,
  null,'pickup',null,'Test Customer','01700000001',
  '00000000-0000-4000-8000-000000011101') into v_retry;
 if v_retry<>v_order then raise exception 'Idempotency failed';end if;
 if (select count(*) from public.store_orders)<>1
 then raise exception 'Repeated order created duplicate';end if;
 if (select reserved from public.store_products where sku='V2-GHEE-1KG')<>1
 then raise exception 'Order did not reserve inventory';end if;
 begin
  perform public.store_place_order(
   '[{"product_id":"00000000-0000-4000-8000-000000011011","quantity":4}]'::jsonb,
   null,'pickup',null,'Test Customer','01700000001',
   '00000000-0000-4000-8000-000000011102');
  raise exception 'Overselling was allowed';
 exception when others then
  if sqlerrm not like 'Insufficient available stock%' then raise;end if;
 end;
 begin
  perform public.store_staff_order_status(v_order,'confirmed','wrong actor');
  raise exception 'Customer performed staff confirmation';
 exception when insufficient_privilege then null;
 end;

 select public.store_place_order(
  '[{"product_id":"00000000-0000-4000-8000-000000011011","quantity":1}]'::jsonb,
  '00000000-0000-4000-8000-000000011013',
  'pickup',null,'Test Customer','01700000001',
  '00000000-0000-4000-8000-000000011103') into v_group;

 select public.store_place_order(
  '[{"product_id":"00000000-0000-4000-8000-000000011012","quantity":1}]'::jsonb,
  null,'home_delivery','House 25 Test Road Test City',
  'Test Customer','01700000001',
  '00000000-0000-4000-8000-000000011104') into v_home;
 select total_amount into v_total from public.store_orders where id=v_home;
 if v_total<>1320 then raise exception 'Server delivery fee was not applied: %',v_total;end if;
 perform set_config('v2.test_order',v_order::text,false);
 perform set_config('v2.test_group',v_group::text,false);
 perform set_config('v2.test_home',v_home::text,false);
end $$;

-- Super Admin can manage roles, validate target, update order and payment.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011001',false);
do $$
declare v_order uuid:=current_setting('v2.test_order')::uuid;
 v_group uuid:=current_setting('v2.test_group')::uuid;
 v_home uuid:=current_setting('v2.test_home')::uuid;
begin
 if not public.store_is_super_admin() then raise exception 'Super Admin role missing';end if;
 if public.store_set_role('00000000-0000-4000-8000-000000011003','admin')<>'admin'
 then raise exception 'Admin assignment failed';end if;
 begin
  perform public.store_staff_order_status(v_group,'confirmed','Group not ready');
  raise exception 'Pool unlocked without minimum households';
 exception when others then
  if sqlerrm not like 'Group/Pool target not yet reached' then raise;end if;
 end;
 if public.store_staff_order_status(v_order,'confirmed','Stock confirmed')<>'confirmed'
 then raise exception 'Order confirmation failed';end if;
 perform public.store_staff_order_status(v_order,'preparing','Preparing');
 perform public.store_staff_order_status(v_order,'ready_for_pickup','At pickup point');
 begin
  perform public.store_staff_order_status(v_order,'completed','Not handed over');
  raise exception 'Skipped handover';
 exception when others then
  if sqlerrm not like 'Invalid order transition' then raise;end if;
 end;
 perform public.store_mark_payment_collected(v_order,'cash','TEST-RECEIPT');
 begin
  perform public.store_staff_order_status(v_order,'cancelled','Wrong after cash');
  raise exception 'Collected order canceled without refund';
 exception when others then
  if sqlerrm not like 'Collected payment requires a documented refund%' then raise;end if;
 end;
 perform public.store_staff_order_status(v_order,'handed_over','Customer collected');
 begin
  perform public.store_staff_order_status(v_order,'completed','Unverified cash');
  raise exception 'Unverified payment marked completed';
 exception when others then
  if sqlerrm not like 'Verify payment before completion' then raise;end if;
 end;
 perform public.store_verify_payment(v_order);
 perform public.store_staff_order_status(v_order,'completed','Cash verified and delivered');
 if (select status from public.store_orders where id=v_order)<>'completed'
 then raise exception 'Order completion missing';end if;
 if (select on_hand from public.store_products where sku='V2-GHEE-1KG')<>2
 then raise exception 'Handover did not deduct on-hand inventory';end if;
 if (select reserved from public.store_products where sku='V2-GHEE-1KG')<>1
 then raise exception 'Incorrect remaining reservation';end if;
 perform public.store_staff_order_status(v_home,'cancelled','Customer cancelled');
 if (select reserved from public.store_products where sku='V2-BUTTER-1KG')<>0
 then raise exception 'Cancellation did not release reservation';end if;
 if (select count(*) from public.store_payment_receipts where order_id=v_order)<>1
 then raise exception 'Payment receipt duplication';end if;
 if (select count(*) from public.store_order_events where order_id=v_order)<6
 then raise exception 'Immutable order audit missing';end if;
end $$;
reset role;
select 'PASS: v2 schema, published browse, role guard, booking idempotency, stock, pool threshold, delivery fee, payment and order completion' as result;
