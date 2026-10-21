-- All records are fictional, inside rolled-back disposable pgTAP transaction.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid='public.vendor_offer_drafts'::regclass),'Vendor draft pricing uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.pilot_payment_recipients'::regclass),'Customer receiving account uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.pilot_booking_payment_claims'::regclass),'Payment claim uses RLS');
select ok(not has_table_privilege('anon','public.pilot_payment_recipients','SELECT'),'Anonymous viewers cannot read bank/bKash account numbers');
select ok(not has_table_privilege('authenticated','public.pilot_booking_payment_claims','INSERT'),'Authenticated customer cannot forge payment claims directly');
select ok(not has_table_privilege('authenticated','public.pilot_booking_payment_claims','UPDATE'),'Customer cannot mark own claim verified');
select ok(not has_function_privilege('anon','public.pilot_payment_options(uuid)','EXECUTE'),'Anonymous users cannot retrieve payment destinations');
select ok(not has_function_privilege('anon','public.pilot_submit_payment_reference(uuid,uuid,text)','EXECUTE'),'Anonymous users cannot submit transfer references');
select is((select production_purchases_enabled from private.commerce_configuration),false,'Live Commerce purchases remain closed');

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000007701','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-owner-7701@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000007702','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-customer-7702@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000007703','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-reviewer-7703@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000007704','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-other-7704@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000007701','super_admin'),
 ('00000000-0000-4000-8000-000000007703','admin');
insert into private.platform_owner_identity(singleton,owner_user_id)
 values(true,'00000000-0000-4000-8000-000000007701')
 on conflict(singleton) do nothing;
insert into public.communities(id,name,slug) values
 ('00000000-0000-4000-8000-000000007710','Manual payment synthetic community','manual-payment-7710');
update public.profiles set full_name='Synthetic paid booking customer',
phone='01700007702',household_name='Synthetic',
onboarding_completed_at=now(),community_id='00000000-0000-4000-8000-000000007710'
where id='00000000-0000-4000-8000-000000007702';
insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
values('00000000-0000-4000-8000-000000007720','Synthetic 1kg butter','Dairy','1 kg','pack','MANUAL-7720','SUPPLIER_POOL',true,false);
insert into public.suppliers(id,business_name,active,reliability_status)
 values('00000000-0000-4000-8000-000000007730','Fictional vendor for manual payment test',true,'unrated');
insert into public.supplier_products(supplier_id,product_id,active,relationship_type)
 values('00000000-0000-4000-8000-000000007730','00000000-0000-4000-8000-000000007720',true,'vendor');
insert into public.vendor_offer_drafts(product_id,supplier_id,vendor_unit_cost,proposed_sale_price,updated_by)
 values('00000000-0000-4000-8000-000000007720','00000000-0000-4000-8000-000000007730',1100,1250,
 '00000000-0000-4000-8000-000000007701');
select is((select status from public.vendor_offer_drafts where product_id='00000000-0000-4000-8000-000000007720'),
'draft','Owner-proposed vendor offer never auto-publishes');
select is((select count(*)::int from public.commerce_offers),0,'Draft pricing creates no Commerce selling offer');

insert into public.pilot_payment_recipients(id,method,account_name,account_number,active,configured_by)
 values('00000000-0000-4000-8000-000000007740','bkash','Synthetic 2TBR Owner','01700007740',true,
 '00000000-0000-4000-8000-000000007701');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007701',true);
select is(public.is_current_platform_owner(),true,'Authoritative platform owner exists');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007702',true);
select is((select count(*)::int from public.pilot_payment_options('00000000-0000-4000-8000-000000007750')),
0,'No recipient revealed for missing booking');

create temp table manual_pay_test(booking_id uuid,claim_id uuid);
insert into manual_pay_test(booking_id)
select public.pilot_request_booking('00000000-0000-4000-8000-000000007720',
 1,'pickup',null,'Next day booking request','00000000-0000-4000-8000-000000007750',true);
select is((select count(*)::int from public.pilot_payment_options((select booking_id from manual_pay_test))),
0,'Recipient remains invisible for unconfirmed booking');
select throws_like(format('select public.pilot_submit_payment_reference(%L::uuid,%L::uuid,%L)',
 (select booking_id from manual_pay_test),'00000000-0000-4000-8000-000000007740','PAY7702-001'),
 '%confirmed booking%','Customer cannot submit payment before Admin confirmation');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007703',true);
select is(public.pilot_staff_update_booking((select booking_id from manual_pay_test),
 'confirmed',1250,50,'Vendor stock and next-day service independently confirmed'),
 'confirmed','Admin confirms product price, actual availability and fee');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007704',true);
select is((select count(*)::int from public.pilot_payment_options((select booking_id from manual_pay_test))),
0,'Another customer cannot view confirmed booking bank/bKash account');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007702',true);
select is((select count(*)::int from public.pilot_payment_options((select booking_id from manual_pay_test))),
1,'Confirmed owner of booking can view enabled approved recipient');
update manual_pay_test set claim_id=public.pilot_submit_payment_reference(
 (select booking_id from manual_pay_test),'00000000-0000-4000-8000-000000007740','PAY7702-001');
select is((select claimed_amount::int from public.pilot_booking_payment_claims where id=(select claim_id from manual_pay_test)),
1300,'Amount comes from server-confirmed products and delivery fee');
select is((select status from public.pilot_booking_payment_claims where id=(select claim_id from manual_pay_test)),
'pending','Customer reference alone is never marked paid');
select throws_like(format('select public.pilot_staff_review_payment_reference(%L::uuid,true,%L)',
 (select claim_id from manual_pay_test),'Review by customer disallowed'),
 '%Admin required%','Customer cannot review own reference');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007703',true);
select is(public.pilot_staff_review_payment_reference(
 (select claim_id from manual_pay_test),true,'Checked fictional original bank statement reference'),
 'verified','Independent Admin can review an externally checked claim');
select is((select status from public.pilot_booking_payment_claims where id=(select claim_id from manual_pay_test)),
 'verified','Only manual reference reviewed; not automatic cash receipt');
select is((select count(*)::int from public.payment_records),0,'Customer claim creates no original payment receipt');
select is((select count(*)::int from public.commerce_orders where not is_synthetic),0,'Manual pilot booking is not a Commerce order');
select is((select production_purchases_enabled from private.commerce_configuration),false,'Production checkout gate never lifted');

select * from finish();
rollback;
