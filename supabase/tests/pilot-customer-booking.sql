-- Disposable isolated CI only: pilot bookings do NOT enable Production Commerce.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok((select relrowsecurity from pg_class where oid='public.pilot_booking_requests'::regclass),
 'Pilot booking records enforce RLS');
select ok(not has_table_privilege('anon','public.pilot_booking_requests','SELECT'),
 'Anonymous users cannot read customer phone and address');
select ok(has_table_privilege('authenticated','public.pilot_booking_requests','SELECT'),
 'Authenticated customers can read their own requests under RLS');
select ok(not has_table_privilege('authenticated','public.pilot_booking_requests','INSERT'),
 'Customers cannot forge booking rows directly');
select ok(not has_table_privilege('authenticated','public.pilot_booking_requests','UPDATE'),
 'Customers cannot forge accepted prices or confirmation');
select ok(not has_table_privilege('service_role','public.pilot_booking_requests','UPDATE'),
 'Service API cannot update financial booking fields directly');
select ok(not has_table_privilege('authenticated','public.pilot_booking_events','SELECT'),
 'Status history is internal, not publicly exposed');
select ok(not has_function_privilege('anon','public.pilot_request_booking(uuid,integer,text,text,text,uuid,boolean)','EXECUTE'),
 'Guests cannot call authenticated booking submission');
select ok(not has_function_privilege('anon','public.pilot_staff_update_booking(uuid,text,numeric,numeric,text)','EXECUTE'),
 'Guests cannot update booking status');
select is((select production_purchases_enabled from private.commerce_configuration),false,
 'Real Commerce purchases remain disabled');
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
('00000000-0000-4000-8000-000000008801','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pilot-buyer@example.invalid',now(),now()),
('00000000-0000-4000-8000-000000008802','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pilot-other@example.invalid',now(),now()),
('00000000-0000-4000-8000-000000008803','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pilot-admin@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
('00000000-0000-4000-8000-000000008803','admin');
insert into public.communities(id,name,slug) values
('00000000-0000-4000-8000-000000008810','Synthetic pilot','synthetic-pilot-8810');
update public.profiles set full_name='Synthetic pilot buyer',
 phone='01712348801',household_name='Synthetic',onboarding_completed_at=now(),
 community_id='00000000-0000-4000-8000-000000008810'
 where id='00000000-0000-4000-8000-000000008801';
insert into public.products(id,name,category,package_size,unit,sku,source_type,is_demo,active)
values('00000000-0000-4000-8000-000000008820','Synthetic pilot butter','Groceries','1kg','pack','PILOT-8820','PRIVATE_LABEL',false,true);
create temp table pilot_ids(id uuid);
select set_config('request.jwt.claim.sub','',true);
select throws_like($$select public.pilot_request_booking(
 '00000000-0000-4000-8000-000000008820',1,'pickup',null,'',
 '00000000-0000-4000-8000-000000008890',true)$$,
 '%Sign in to request%', 'Missing session denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008802',true);
select throws_like($$select public.pilot_request_booking(
 '00000000-0000-4000-8000-000000008820',1,'pickup',null,'',
 '00000000-0000-4000-8000-000000008891',true)$$,
 '%Finish household onboarding%', 'Incomplete household blocked');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008801',true);
select throws_like($$select public.pilot_request_booking(
 '00000000-0000-4000-8000-000000008820',1,'pickup',null,'',
 '00000000-0000-4000-8000-000000008891',false)$$,
 '%Accept current terms%', 'Policy consent is required in the database');
select throws_like($$select public.pilot_request_booking(
 '00000000-0000-4000-8000-000000008820',21,'pickup',null,'',
 '00000000-0000-4000-8000-000000008891',true)$$,
 '%quantity between 1 and 20%', 'Maximum request size enforced');
select throws_like($$select public.pilot_request_booking(
 '00000000-0000-4000-8000-000000008820',1,'home_delivery',null,'',
 '00000000-0000-4000-8000-000000008891',true)$$,
 '%valid address%', 'Delivery requires valid address');
insert into pilot_ids values (public.pilot_request_booking(
 '00000000-0000-4000-8000-000000008820',2,'pickup',null,'Call in the evening',
 '00000000-0000-4000-8000-000000008890',true));
select is((select status from public.pilot_booking_requests where id=(select id from pilot_ids)),
 'requested','Pilot request persisted without paid or confirmed status');
select is((select contact_phone from public.pilot_booking_requests where id=(select id from pilot_ids)),
 '01712348801','Contact comes from actual authenticated household profile');
select is((select count(*)::integer from public.notifications where kind='pilot_booking'
 and user_id='00000000-0000-4000-8000-000000008803'
 and href='/admin/pilot-bookings'),1,'New requests notify authorized staff');
select is(public.pilot_request_booking(
 '00000000-0000-4000-8000-000000008820',2,'pickup',null,'Call in the evening',
 '00000000-0000-4000-8000-000000008890',true),(select id from pilot_ids),
 'Retried submission reuses idempotency key');
select is((select count(*)::integer from public.pilot_booking_requests),1,
 'Double-click does not create duplicate booking');
select throws_like($$select public.pilot_staff_update_booking(
 (select id from pilot_ids),'confirmed',1240,0,'Pretend staff')$$,
 '%Admin access required%', 'Customer cannot confirm booking');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008802',true);
select throws_like($$select public.pilot_cancel_my_booking(
 (select id from pilot_ids))$$,
 '%does not belong%', 'Another customer cannot cancel booking');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008803',true);
select throws_like($$select public.pilot_staff_update_booking(
 (select id from pilot_ids),'confirmed',null,null,'Invalid quote')$$,
 '%Confirm customer price%', 'Staff confirmation requires actual price and fees');
select is(public.pilot_staff_update_booking(
 (select id from pilot_ids),'confirmed',1240,0,'Called customer and agreed free pickup'),
 'confirmed','Staff can confirm agreed booking and no online payment');
select is((select confirmed_unit_price::integer from public.pilot_booking_requests
 where id=(select id from pilot_ids)),1240,'Exact agreed price persisted');
select is((select count(*)::integer from public.notifications where kind='pilot_booking'
 and user_id='00000000-0000-4000-8000-000000008801'
 and href='/pilot-bookings'),1,'Customer is notified about staff confirmation');
select is((select count(*)::integer from public.pilot_booking_events
 where booking_id=(select id from pilot_ids)),2,'Request and staff confirmation create immutable event history');
select is((select count(*)::integer from public.commerce_orders where not is_synthetic),0,
 'Pilot booking does not write a real Commerce order');
select is((select production_purchases_enabled from private.commerce_configuration),false,
 'Pilot request does not lift financial checkout default-deny');

-- Customer-facing arrangements can be corrected after confirmation, without
-- modifying the already agreed price or creating financial transactions.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008801',true);
select throws_like($$select public.pilot_staff_send_service_update(
 (select id from pilot_ids),'Pickup at community collection point at 6 PM')$$,
 '%Admin access required%', 'Customer cannot alter service instructions');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008803',true);
select throws_like($$select public.pilot_staff_send_service_update(
 (select id from pilot_ids),'')$$,
 '%between 5 and 500 characters%', 'Empty pickup message rejected');
select is(public.pilot_staff_send_service_update(
 (select id from pilot_ids),'Collect at community point tomorrow 6 PM'),
 'updated', 'Admin may publish updated pickup timing after confirmation');
select is((select staff_note from public.pilot_booking_requests
 where id=(select id from pilot_ids)),
 'Collect at community point tomorrow 6 PM', 'Customer-facing instructions persisted');
select is((select status from public.pilot_booking_requests where id=(select id from pilot_ids)),
 'confirmed','Service note preserves confirmed status');
select is((select confirmed_unit_price::integer from public.pilot_booking_requests
 where id=(select id from pilot_ids)),1240, 'Service note cannot alter agreed price');
select is((select count(*)::integer from public.pilot_booking_events
 where booking_id=(select id from pilot_ids)),3, 'Service note creates auditable event');
select is((select count(*)::integer from public.notifications
 where kind='pilot_booking' and user_id='00000000-0000-4000-8000-000000008801'
 and href='/pilot-bookings'),2,'Customer gets a second in-app notification');
select throws_like($$select public.pilot_staff_send_service_update(
 (select id from pilot_ids),'Collect at community point tomorrow 6 PM')$$,
 '%already has this update%', 'Duplicate service update rejected');
select is((select count(*)::integer from public.commerce_orders where not is_synthetic),0,
 'Updated customer instructions do not create a Commerce order');

select * from finish();
rollback;
