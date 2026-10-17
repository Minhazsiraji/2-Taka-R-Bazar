-- Independent physical stock verification (disposable DB only; always rollback).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(not has_table_privilege('authenticated','public.commerce_live_stock_attestations','SELECT'),
 'Customers cannot read physical verification evidence');
select ok(not has_table_privilege('authenticated','public.commerce_live_stock_attestations','INSERT'),
 'Customers cannot forge evidence');
select ok(not has_table_privilege('service_role','public.commerce_live_stock_attestations','UPDATE'),
 'Service API cannot directly approve physical stock');
select ok(not has_function_privilege('authenticated','private.commerce_live_stock_eligible(uuid,uuid,integer)','EXECUTE'),
 'Eligibility helper is private');
select is((select production_purchases_enabled from private.commerce_configuration),false,
 'Commerce purchases remain disabled after new migration');

select is((select public from storage.buckets where id='commerce-evidence'),false,
 'Evidence bucket is private by default');
select ok((select file_size_limit from storage.buckets where id='commerce-evidence') between 1 and 10485760,
 'Evidence bucket limits individual file size to at most 10 MiB');
select ok(exists(select 1 from pg_policies where schemaname='storage'
 and tablename='objects' and policyname='commerce_live_stock_evidence_upload'),
 'Stock proof upload is restricted through an authenticated policy');

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000009101','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stock-maker@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000009102','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stock-checker@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000009101','admin'),
 ('00000000-0000-4000-8000-000000009102','super_admin');
insert into public.communities(id,name,slug) values
 ('00000000-0000-4000-8000-000000009110','Synthetic stock pilot','synthetic-stock-9110');
insert into public.products(id,name,category,package_size,unit,sku,source_type,is_demo,active)
 values('00000000-0000-4000-8000-000000009120','Synthetic 1kg bag','Groceries','1 Kg','Kg','STOCK-VERIFY-9120','PRIVATE_LABEL',false,true);
insert into public.own_product_costs(product_id,purchase_cost) values('00000000-0000-4000-8000-000000009120',100);
insert into public.own_product_inventory(product_id,stock_on_hand) values('00000000-0000-4000-8000-000000009120',3);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009101',true);
select throws_like($select public.commerce_request_live_stock_attestation(
 '00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',4,'Kg',
 '00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009190.pdf',
 repeat('a',64),now()+interval '1 day')$$,
 '%reconcile physical inventory%', 'A wrong physical count cannot be certified');
create temp table real_stock_case(key text primary key,id uuid);
insert into real_stock_case values('claim',public.commerce_request_live_stock_attestation(
 '00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',3,'Kg',
 '00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009190.pdf',
 repeat('a',64),now()+interval '1 day'));
select ok(not private.commerce_live_stock_eligible('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',1),
 'Pending maker submission cannot authorize real sale');
select throws_like($select public.commerce_request_live_stock_attestation(
 '00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',3,'Kg',
 '00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009190.pdf',
 repeat('a',64),now()+interval '1 day')$$,
 '%awaits independent review%', 'Duplicate pending attestations are blocked');
select throws_like($select public.commerce_review_live_stock_attestation(
 (select id from real_stock_case where key='claim'),true,'Self review not allowed')$$,
 '%Independent Super Admin approval required%', 'Maker cannot approve as Admin');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009102',true);
select throws_like($$select public.commerce_review_live_stock_attestation(
 (select id from real_stock_case where key='claim'),true,'A separate stock checker requires the original evidence')$$,
 '%Original evidence file missing%', 'Evidence path alone cannot pass independent review');
insert into storage.objects(bucket_id,name) values(
 'commerce-evidence',
 '00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009190.pdf');
select ok(private.commerce_live_stock_checker_can_read(
 '00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009190.pdf'),
 'Independent checker may inspect only attested evidence');
select ok(not private.commerce_live_stock_checker_can_read(
 '00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009191.pdf'),
 'Independent checker may not inspect unrelated user files');
select lives_ok($$select public.commerce_review_live_stock_attestation(
 (select id from real_stock_case where key='claim'),true,'Independently checked the synthetic physical stock count')$$,
 'Independent Super Admin approval works');
select ok(private.commerce_live_stock_eligible('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',3),
 'Independently verified quantity eligible for full reservation');

-- Model an orphaned attestation reference in a disposable transaction.
-- Supabase correctly forbids direct SQL deletion from storage.objects.
update public.commerce_live_stock_attestations set
 evidence_path='00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009191.pdf'
 where id=(select id from real_stock_case where key='claim');
select ok(not private.commerce_live_stock_eligible('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',1),
 'Missing evidence makes an otherwise approved attestation ineligible');
update public.commerce_live_stock_attestations set
 evidence_path='00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009190.pdf'
 where id=(select id from real_stock_case where key='claim');
select ok(not private.commerce_live_stock_eligible('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',4),
 'Overselling beyond physical stock remains blocked');
update public.own_product_inventory set reserved_quantity=2 where product_id='00000000-0000-4000-8000-000000009120';
select ok(not private.commerce_live_stock_eligible('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',2),
 'Reserved physical stock cannot be double sold');
select ok(private.commerce_live_stock_eligible('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',1),
 'Remaining verified physical stock may be offered');
update public.own_product_inventory set stock_on_hand=10,reserved_quantity=0 where product_id='00000000-0000-4000-8000-000000009120';
select ok(not private.commerce_live_stock_eligible('00000000-0000-4000-8000-000000009120','00000000-0000-4000-8000-000000009110',1),
 'Unverified stock increases invalidate approved physical quantity');
select throws_like($select public.commerce_review_live_stock_attestation(
 (select id from real_stock_case where key='claim'),true,'Double approval invalid')$$,
 '%pending stock attestation%', 'One verification cannot be approved twice');
select is((select count(*)::integer from public.commerce_offers where not is_synthetic),0,
 'No real Commerce offer was created');
select * from finish();
rollback;
