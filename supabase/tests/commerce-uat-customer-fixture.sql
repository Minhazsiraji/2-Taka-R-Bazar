begin;
create extension if not exists pgtap with schema extensions;
select plan(21);
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000006911','fixture-one@example.invalid',now(),now(),now()),
 ('00000000-0000-4000-8000-000000006912','fixture-two@example.invalid',now(),now(),now()),
 ('00000000-0000-4000-8000-000000006913','genuine-looking@example.com',now(),now(),now());
insert into public.communities(id,name,slug) values('00000000-0000-4000-8000-000000006921','Synthetic fixture area','synthetic-fixture-area');
insert into public.pickup_points(id,community_id,name,address) values('00000000-0000-4000-8000-000000006922','00000000-0000-4000-8000-000000006921','Synthetic pickup','Synthetic test street');
insert into public.products(id,name,category,package_size,unit,sku,source_type,is_demo) values
 ('00000000-0000-4000-8000-000000006923','Synthetic fixture rice','Rice','1 kg','bag','fixture-6923','PRIVATE_LABEL',false);
insert into public.own_product_inventory(product_id,stock_on_hand) values('00000000-0000-4000-8000-000000006923',10) on conflict(product_id) do update set stock_on_hand=10;
insert into public.commerce_offers(id,sku_id,community_id,mode,unit_price,valid_until,status,requested_by,reviewed_by) select
 '00000000-0000-4000-8000-000000006924',id,'00000000-0000-4000-8000-000000006921','SOLO',100,now()+interval '1 day','approved','00000000-0000-4000-8000-000000006912','00000000-0000-4000-8000-000000006913' from public.commerce_skus where product_id='00000000-0000-4000-8000-000000006923';
update private.commerce_configuration set preview_secret_hash=encode(extensions.digest(repeat('q',64),'sha256'),'hex');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006911',true);
select ok(not private.commerce_uat_customer_active(auth.uid()),'Email alone is not a qualified customer');
select throws_ok($$select public.commerce_create_quote(null,'pickup','00000000-0000-4000-8000-000000006922',null,repeat('q',64))$$,'P0001','Complete your household and community first','Normal email customer still needs mobile onboarding');
insert into private.commerce_uat_signin_leases(actor_id,expires_at,reason) values
 ('00000000-0000-4000-8000-000000006911',clock_timestamp()+interval '1 hour','Disposable fixture sign-in approval'),
 ('00000000-0000-4000-8000-000000006913',clock_timestamp()+interval '1 hour','Genuine identity rejection qualification');
select ok(not private.commerce_uat_customer_active(auth.uid()),'Sign-in lease alone cannot enable checkout');
insert into private.commerce_uat_customer_fixtures(actor_id,community_id,full_name,household_name,expires_at,reason) values
 ('00000000-0000-4000-8000-000000006911','00000000-0000-4000-8000-000000006921','Synthetic test customer','Synthetic fixture',clock_timestamp()+interval '1 hour','Explicit synthetic customer qualification'),
 ('00000000-0000-4000-8000-000000006913','00000000-0000-4000-8000-000000006921','Excluded real identity','Excluded fixture',clock_timestamp()+interval '1 hour','Genuine identity exclusion qualification');
select ok(private.commerce_uat_customer_active(auth.uid()),'Approved leased synthetic email fixture is active');
select is(private.commerce_customer_community(auth.uid()),'00000000-0000-4000-8000-000000006921'::uuid,'Fixture resolves only assigned community');
select ok((public.commerce_uat_customer_context(repeat('q',64))->>'is_test_fixture')::boolean,'Context explicitly identifies synthetic fixture');
select ok((select phone is null and community_id is null and onboarding_completed_at is null from public.profiles where id=auth.uid()),'Real customer profile remains unverified and unchanged');
select lives_ok($$select public.commerce_set_cart_item(null,'00000000-0000-4000-8000-000000006924',1,repeat('q',64))$$,'Synthetic item can be placed in cart');
select throws_ok($$select public.commerce_create_quote(null,'pickup','00000000-0000-4000-8000-000000006922',null,repeat('q',64))$$,'P0001','Only allowlisted synthetic Buy Alone test offers are eligible','Unapproved fixture offer cannot be quoted');
insert into private.commerce_uat_fixture_offers(actor_id,offer_id) values('00000000-0000-4000-8000-000000006911','00000000-0000-4000-8000-000000006924');
create temporary table qa_fixture_quote as select public.commerce_create_quote(null,'pickup','00000000-0000-4000-8000-000000006922',null,repeat('q',64)) q;
select is((select (q->>'total_amount')::numeric from qa_fixture_quote),100::numeric,'Allowlisted SOLO quote uses unchanged server totals');
delete from private.commerce_uat_fixture_offers where actor_id=auth.uid();
select throws_ok($$select public.commerce_confirm_checkout((select (q->>'id')::uuid from qa_fixture_quote),gen_random_uuid(),'2026-10-05',repeat('q',64))$$,'P0001','Only allowlisted synthetic Buy Alone test offers are eligible','Revocation between quote and checkout is enforced');
select is((select reserved_quantity from public.own_product_inventory where product_id='00000000-0000-4000-8000-000000006923'),0,'Denied checkout does not reserve stock');
insert into private.commerce_uat_fixture_offers(actor_id,offer_id) values('00000000-0000-4000-8000-000000006911','00000000-0000-4000-8000-000000006924');
select lives_ok($$select public.commerce_confirm_checkout((select (q->>'id')::uuid from qa_fixture_quote),gen_random_uuid(),'2026-10-05',repeat('q',64))$$,'Qualified fixture creates a synthetic order normally');
select ok((select phone is null and community_id is null and onboarding_completed_at is null from public.profiles where id=auth.uid()),'Successful checkout does not invent mobile/onboarding claims');
select ok(not has_table_privilege('authenticated','private.commerce_uat_customer_fixtures','INSERT') and not has_table_privilege('authenticated','private.commerce_uat_fixture_offers','INSERT'),'Customer cannot approve own fixture or offers');
select ok(not has_function_privilege('anon','public.commerce_uat_customer_context(text)','EXECUTE'),'Anonymous caller has no fixture context endpoint');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006912',true);
select ok(public.commerce_uat_customer_context(repeat('q',64)) is null,'Other customer cannot borrow fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006913',true);
select ok(not private.commerce_uat_customer_active(auth.uid()),'Genuine-looking email is never a fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006911',true);
update private.commerce_uat_customer_fixtures set issued_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where actor_id=auth.uid();
select ok(public.commerce_uat_customer_context(repeat('q',64)) is null,'Expired fixture fails closed');
select ok(not exists(select 1 from private.finance_uat_leases where actor_id=auth.uid()) and not exists(select 1 from public.commerce_verified_household_members where customer_id=auth.uid()),'Fixture creates no Finance lease or verified household');
select throws_ok($$select public.commerce_uat_customer_context(repeat('z',64))$$,'42501','Commerce purchases are disabled outside authorized synthetic Preview','Missing Preview proof fails closed');
select * from finish();rollback;
