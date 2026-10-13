-- Disposable pgTAP only. Tests never use or mutate real accounts or transactions.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_table_privilege('authenticated','public.commerce_offer_purchase_limits','INSERT'),'Customer cannot define a cap');
select ok(not has_table_privilege('authenticated','public.commerce_verified_household_members','INSERT'),'Customer cannot self-verify household');
select ok(not has_function_privilege('anon','public.commerce_request_purchase_limit(uuid,text,integer,integer,text,text)','EXECUTE'),'Guest cannot request promotion cap');
select ok(not has_function_privilege('authenticated','private.commerce_assert_purchase_limit(uuid,integer,uuid,uuid,uuid,boolean)','EXECUTE'),'Private promotion guard is not callable');
update private.commerce_configuration set preview_secret_hash=encode(extensions.digest('synthetic-disposable-commerce-proof-64','sha256'),'hex');

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000680'||n)::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'purchase-limit-'||n||'@example.invalid',now(),now()
from generate_series(1,6) n;
insert into public.user_roles(user_id,role) values
('00000000-0000-4000-8000-000000006805','admin'),
('00000000-0000-4000-8000-000000006806','super_admin');
insert into public.communities(id,name,slug) values
('00000000-0000-4000-8000-000000006810','Synthetic limited-offer community','synthetic-limits-6810');
update public.profiles set full_name='Synthetic promotion buyer',
 household_name='Synthetic test household',onboarding_completed_at=now(),
 phone='017'||right(replace(id::text,'-',''),8),
 community_id='00000000-0000-4000-8000-000000006810'
where id in ('00000000-0000-4000-8000-000000006801','00000000-0000-4000-8000-000000006802',
'00000000-0000-4000-8000-000000006803','00000000-0000-4000-8000-000000006804');
insert into public.products(id,name,category,package_size,unit,sku,source_type,is_demo)
values('00000000-0000-4000-8000-000000006820','Synthetic 5L soybean promotional product','Oil','5 L','bottle','commerce-promo-6820','PRIVATE_LABEL',false);
insert into public.own_product_costs(product_id,purchase_cost)
values('00000000-0000-4000-8000-000000006820',80);
insert into public.own_product_inventory(product_id,stock_on_hand) values
('00000000-0000-4000-8000-000000006820',30)
on conflict(product_id) do update set stock_on_hand=30,reserved_quantity=0;
insert into public.pickup_points(id,community_id,name,address)
values('00000000-0000-4000-8000-000000006811',
'00000000-0000-4000-8000-000000006810','Promo UAT collection point','Synthetic delivery point');

create temp table promo_test_ids(key text primary key,id uuid);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006805',true);
insert into promo_test_ids values ('offer1',public.commerce_request_offer(
(select id from public.commerce_skus where product_id='00000000-0000-4000-8000-000000006820'),
'00000000-0000-4000-8000-000000006810','SOLO',null,null,null,100,now()+interval '2 days',true,true,60,
'synthetic-disposable-commerce-proof-64'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006806',true);
select lives_ok($$select public.commerce_review_offer((select id from promo_test_ids where key='offer1'),
true,'Independent synthetic promotion offer review','synthetic-disposable-commerce-proof-64')$$,
'Checker can approve synthetic offer');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006805',true);
insert into promo_test_ids values('limit1',public.commerce_request_purchase_limit(
(select id from promo_test_ids where key='offer1'),'SOY5L_20PCT',1,null,'One bottle promotional allowance',
'synthetic-disposable-commerce-proof-64'));
select throws_like($$select public.commerce_review_purchase_limit((select id from promo_test_ids where key='limit1'),true,'Self review should be blocked','synthetic-disposable-commerce-proof-64')$$,'%Super Admin required%','Maker cannot approve its own cap');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006806',true);
select lives_ok($$select public.commerce_review_purchase_limit((select id from promo_test_ids where key='limit1'),
true,'Approved synthetic one-bottle campaign','synthetic-disposable-commerce-proof-64')$$,'Independent checker approves cap');
select is((public.commerce_catalog(true,'00000000-0000-4000-8000-000000006810')->0->>'max_per_account')::integer,1,
'Public card discloses approved one-per-account cap');
select set_config('request.jwt.claim.sub','',true);
select throws_like($$select public.commerce_set_cart_item(repeat('a',64),(select id from promo_test_ids where key='offer1'),2,'synthetic-disposable-commerce-proof-64')$$,'%Promotion limit%','Guest cannot put two discounted bottles in cart');
select lives_ok($$select public.commerce_set_cart_item(repeat('a',64),(select id from promo_test_ids where key='offer1'),1,'synthetic-disposable-commerce-proof-64')$$,'Guest can preview one');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006801',true);
select lives_ok($$select public.commerce_get_cart(repeat('a',64),'synthetic-disposable-commerce-proof-64')$$,'Guest merges one item at login');
insert into promo_test_ids select 'quote1',(public.commerce_create_quote(repeat('a',64),'pickup',
'00000000-0000-4000-8000-000000006811',null,'synthetic-disposable-commerce-proof-64')->>'id')::uuid;
insert into promo_test_ids select 'order1',(public.commerce_confirm_checkout((select id from promo_test_ids where key='quote1'),
'00000000-0000-4000-8000-000000006850','2026-10-05','synthetic-disposable-commerce-proof-64')->>0)::uuid;
select is((select sum(quantity)::integer from public.commerce_order_items where order_id=(select id from promo_test_ids where key='order1')),1,
'First one-bottle checkout recorded');
select throws_like($$select public.commerce_set_cart_item(null,(select id from promo_test_ids where key='offer1'),1,'synthetic-disposable-commerce-proof-64')$$,'%Promotion limit reached for this account%','Same customer cannot reopen offer in new cart');
select lives_ok($$select public.commerce_confirm_checkout((select id from promo_test_ids where key='quote1'),
'00000000-0000-4000-8000-000000006850','2026-10-05','synthetic-disposable-commerce-proof-64')$$,'Idempotent checkout retry does not consume allowance twice');

-- Another independently approved offer using the SAME SKU/campaign cannot reset the allowance.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006805',true);
insert into promo_test_ids values ('offer2',public.commerce_request_offer(
(select id from public.commerce_skus where product_id='00000000-0000-4000-8000-000000006820'),
'00000000-0000-4000-8000-000000006810','SOLO',null,null,null,98,now()+interval '2 days',true,true,60,
'synthetic-disposable-commerce-proof-64'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006806',true);
select public.commerce_review_offer((select id from promo_test_ids where key='offer2'),true,
'Synthetic alternative offer approval','synthetic-disposable-commerce-proof-64');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006805',true);
insert into promo_test_ids values('limit2',public.commerce_request_purchase_limit(
(select id from promo_test_ids where key='offer2'),'SOY5L_20PCT',1,null,'Cap shared by same campaign',
'synthetic-disposable-commerce-proof-64'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006806',true);
select public.commerce_review_purchase_limit((select id from promo_test_ids where key='limit2'),
true,'Approve common campaign cap','synthetic-disposable-commerce-proof-64');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006801',true);
select throws_like($$select public.commerce_set_cart_item(null,(select id from promo_test_ids where key='offer2'),1,'synthetic-disposable-commerce-proof-64')$$,'%Promotion limit reached for this account%','Second same-campaign offer cannot evade cap');

-- Optional stricter verified HOUSEHOLD cap. No GPS/typed household_name grants membership.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006805',true);
insert into promo_test_ids values ('offer3',public.commerce_request_offer(
(select id from public.commerce_skus where product_id='00000000-0000-4000-8000-000000006820'),
'00000000-0000-4000-8000-000000006810','SOLO',null,null,null,99,now()+interval '2 days',true,true,60,
'synthetic-disposable-commerce-proof-64'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006806',true);
select public.commerce_review_offer((select id from promo_test_ids where key='offer3'),true,
'Synthetic household offer approval','synthetic-disposable-commerce-proof-64');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006805',true);
insert into promo_test_ids values('limit3',public.commerce_request_purchase_limit(
(select id from promo_test_ids where key='offer3'),'SOY5L_FAMILY',1,1,'One bottle per verified household',
'synthetic-disposable-commerce-proof-64'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006806',true);
select public.commerce_review_purchase_limit((select id from promo_test_ids where key='limit3'),
true,'Approve independent household cap','synthetic-disposable-commerce-proof-64');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006803',true);
select throws_like($$select public.commerce_set_cart_item(null,(select id from promo_test_ids where key='offer3'),1,'synthetic-disposable-commerce-proof-64')$$,'%Verified household required%','No account can self-claim a verified household');

insert into public.delivery_buildings(id,community_id,zone_code,building_code,display_name,verified_at)
values('00000000-0000-4000-8000-000000006831','00000000-0000-4000-8000-000000006810','ZONE1','BUILDING1','Synthetic checked building',now());
insert into public.customer_delivery_addresses(id,customer_id,community_id,building_id,building_label,unit_label,street_line,address_text,verification_status)
values
('00000000-0000-4000-8000-000000006841','00000000-0000-4000-8000-000000006803','00000000-0000-4000-8000-000000006810','00000000-0000-4000-8000-000000006831','Synthetic building','Flat A','Road 1','Flat A, Synthetic building, Road 1','operator_verified'),
('00000000-0000-4000-8000-000000006842','00000000-0000-4000-8000-000000006804','00000000-0000-4000-8000-000000006810','00000000-0000-4000-8000-000000006831','Synthetic building','Flat A','Road 1','Flat A, Synthetic building, Road 1','operator_verified');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006806',true);
select lives_ok($$select public.commerce_verify_household_address('00000000-0000-4000-8000-000000006841',
'Independently confirmed same checked building and flat','synthetic-disposable-commerce-proof-64')$$,'Staff can verify first account household');
select lives_ok($$select public.commerce_verify_household_address('00000000-0000-4000-8000-000000006842',
'Independently confirmed second occupant at checked flat','synthetic-disposable-commerce-proof-64')$$,'Staff can verify second account household');
select is((select count(distinct household_id)::integer from public.commerce_verified_household_members where customer_id in
('00000000-0000-4000-8000-000000006803','00000000-0000-4000-8000-000000006804')),1,'Both independently verified accounts share one trusted household');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006803',true);
select public.commerce_set_cart_item(null,(select id from promo_test_ids where key='offer3'),1,'synthetic-disposable-commerce-proof-64');
insert into promo_test_ids select 'quote3',(public.commerce_create_quote(null,'pickup',
'00000000-0000-4000-8000-000000006811',null,'synthetic-disposable-commerce-proof-64')->>'id')::uuid;
select lives_ok($$select public.commerce_confirm_checkout((select id from promo_test_ids where key='quote3'),
'00000000-0000-4000-8000-000000006853','2026-10-05','synthetic-disposable-commerce-proof-64')$$,
'First verified household account purchases one promotional bottle');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006804',true);
select throws_like($$select public.commerce_set_cart_item(null,(select id from promo_test_ids where key='offer3'),1,'synthetic-disposable-commerce-proof-64')$$,'%Promotion limit reached for this verified household%','Second account of same verified family denied');
select * from finish();
rollback;
