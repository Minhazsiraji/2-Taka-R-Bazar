-- Disposable CI database only. Fixtures are rolled back; never run against customer data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
select ok((select relrowsecurity from pg_class where oid='public.pool_storefront_publication'::regclass),'Publication table has RLS');
select ok(not has_table_privilege('anon','public.pool_storefront_publication','SELECT'),'Guests cannot read publication internals');
select ok(not has_table_privilege('authenticated','public.pool_storefront_publication','UPDATE'),'Direct authenticated publication writes are denied');
select ok(has_function_privilege('anon','public.get_public_featured_pools(uuid)','EXECUTE'),'Guests can read the public projection');
select ok(not has_function_privilege('anon','public.admin_publish_storefront_pool(uuid,uuid[],boolean,integer)','EXECUTE'),'Guests cannot publish');
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000811','00000000-0000-0000-0000-000000000000','authenticated','authenticated','storefront-admin@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values('00000000-0000-4000-8000-000000000811','admin');
insert into public.communities(id,name,slug) values('00000000-0000-4000-8000-000000000812','Synthetic storefront community','synthetic-storefront-812');
insert into public.products(id,name,category,package_size,unit,sku,source_type,is_demo) values
 ('00000000-0000-4000-8000-000000000813','Synthetic rice','Rice','1 kg','bag','storefront-813','PRIVATE_LABEL',false),
 ('00000000-0000-4000-8000-000000000814','Synthetic demo rice','Rice','1 kg','bag','storefront-814','PRIVATE_LABEL',true);
insert into public.pools(id,community_id,title,status,cadence,opens_at,commitment_closes_at,confirmation_closes_at) values
 ('00000000-0000-4000-8000-000000000815','00000000-0000-4000-8000-000000000812','Synthetic published pool','open','weekly',now()-interval '1 hour',now()+interval '1 day',now()+interval '2 days');
insert into public.pool_items(id,pool_id,product_id,benchmark_price_snapshot) values
 ('00000000-0000-4000-8000-000000000816','00000000-0000-4000-8000-000000000815','00000000-0000-4000-8000-000000000813',100),
 ('00000000-0000-4000-8000-000000000817','00000000-0000-4000-8000-000000000815','00000000-0000-4000-8000-000000000814',100);
select is(public.get_public_featured_pools('00000000-0000-4000-8000-000000000812'),'[]'::jsonb,'Unpublished Pool remains invisible');
select throws_ok($$select public.admin_publish_storefront_pool('00000000-0000-4000-8000-000000000815',array['00000000-0000-4000-8000-000000000813'::uuid],true)$$,'P0001','Admin required','No-session publication is rejected');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000811',true);
select throws_ok($$select public.admin_publish_storefront_pool('00000000-0000-4000-8000-000000000815',array['00000000-0000-4000-8000-000000000814'::uuid],true)$$,'P0001','Select active non-demo products belonging to this Pool','Demo image cannot be published');
select throws_ok($$select public.admin_publish_storefront_pool('00000000-0000-4000-8000-000000000815',array['00000000-0000-4000-8000-000000000813'::uuid,'00000000-0000-4000-8000-000000000813'::uuid],true)$$,'P0001','Choose up to three distinct products','Duplicate selections are rejected');
select throws_ok($$select public.admin_publish_storefront_pool('00000000-0000-4000-8000-000000000815',array['00000000-0000-4000-8000-000000000818'::uuid],true)$$,'P0001','Select active non-demo products belonging to this Pool','Foreign image is rejected');
select lives_ok($$select public.admin_publish_storefront_pool('00000000-0000-4000-8000-000000000815',array['00000000-0000-4000-8000-000000000813'::uuid],true)$$,'Admin can publish valid Pool');
select is(jsonb_array_length(public.get_public_featured_pools('00000000-0000-4000-8000-000000000812')),1,'One valid Pool appears');
select is(public.get_public_featured_pools('00000000-0000-4000-8000-000000000812')->0->'livePricing'->'currentPrice','null'::jsonb,'Unconfirmed basket price stays null');
select is(public.get_public_featured_pools('00000000-0000-4000-8000-000000000812')->0->'sampleHouseholds','0'::jsonb,'No invented household count');
select is(jsonb_array_length(public.get_public_featured_pools('00000000-0000-4000-8000-000000000812')->0->'bundle'),1,'Demo products are excluded from public bundle');
select ok(not (public.get_public_featured_pools('00000000-0000-4000-8000-000000000812')->0 ? 'updated_by'),'Public response omits publishing user');
update public.pools set commitment_closes_at=now()-interval '1 minute' where id='00000000-0000-4000-8000-000000000815';
select is(public.get_public_featured_pools('00000000-0000-4000-8000-000000000812'),'[]'::jsonb,'Expired commitment window is hidden');
update public.pools set commitment_closes_at=now()+interval '1 day' where id='00000000-0000-4000-8000-000000000815';
update public.products set active=false where id='00000000-0000-4000-8000-000000000813';
select is(public.get_public_featured_pools('00000000-0000-4000-8000-000000000812'),'[]'::jsonb,'Deactivated selected product hides stale publication');
select is(public.get_public_featured_pools('00000000-0000-4000-8000-000000000819'),'[]'::jsonb,'Different community returns no fixture Pool');
select ok(not has_function_privilege('anon','public.join_group_deal(uuid,integer)','EXECUTE'),'Browsing does not grant guest transaction rights');
select * from finish();
rollback;
