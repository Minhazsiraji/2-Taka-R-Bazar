-- Disposable CI database ONLY. Never run this synthetic data test on the shared 2TBR DB.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
select ok((select relrowsecurity from pg_class where oid='public.product_deletion_audit'::regclass),'Deletion history is protected by RLS');
select ok(not has_function_privilege('anon','public.admin_delete_unused_product(uuid,text,text)','EXECUTE'),'Anonymous cannot delete product');
select ok(not has_function_privilege('authenticated','public.product_deletion_audit','INSERT'),'Normal users cannot alter deletion audit');
select ok(has_function_privilege('authenticated','public.admin_create_product_with_seo(jsonb,jsonb,jsonb,jsonb)','EXECUTE'),'Authenticated role has guarded wizard RPC');
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000008601','00000000-0000-0000-0000-000000000000','authenticated','authenticated','issue86-admin@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000008602','00000000-0000-0000-0000-000000000000','authenticated','authenticated','issue86-checker@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000008601','admin'),
 ('00000000-0000-4000-8000-000000008602','super_admin');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008601',true);
select lives_ok($q$select public.admin_create_product_with_seo(
 '{"name":"Synthetic wizard rice","brand":null,"category":"Rice & Grains","package_size":"1 kg","unit":"kg","sku":"ISSUE86-UNUSED-01","is_demo":true}'::jsonb,
 '{"slug":"synthetic-issue86-unused-rice","title_en":"Synthetic wizard rice","title_bn":"পরীক্ষার চাল","brand_type":"UNBRANDED_LOOSE","expected_version":0}'::jsonb,
 '[]'::jsonb,'[]'::jsonb)$q$,'Single creation RPC atomically creates master and SEO draft');
select is((select count(*) from public.products where sku='ISSUE86-UNUSED-01'),1::bigint,'Master exists once');
select is((select status from public.product_seo_content where slug='synthetic-issue86-unused-rice'),'draft','New content always starts Draft');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008602',true);
select is((select (public.admin_product_delete_check(id)->>'eligible')::boolean from public.products where sku='ISSUE86-UNUSED-01'),true,'Unused product qualifies for safe deletion');
select lives_ok($q$select public.admin_delete_unused_product((select id from public.products where sku='ISSUE86-UNUSED-01'),'ISSUE86-UNUSED-01','Created only for isolated test')$q$,'Unused draft can be deleted by Super Admin');
select is((select count(*) from public.products where sku='ISSUE86-UNUSED-01'),0::bigint,'Unused product actually removed');
select is((select count(*) from public.product_deletion_audit where original_sku='ISSUE86-UNUSED-01'),1::bigint,'Independent deletion audit preserved');
insert into public.products(id,name,category,package_size,unit,sku,is_demo)
values('00000000-0000-4000-8000-000000008603','Used product','Rice & Grains','1 kg','kg','ISSUE86-USED-01',true);
insert into public.commerce_skus(product_id,sku,active)
values('00000000-0000-4000-8000-000000008603','ISSUE86-USED-01',true);
select is((public.admin_product_delete_check('00000000-0000-4000-8000-000000008603')->>'eligible')::boolean,false,'Commerce-linked product cannot be deleted, even before a sale');
select throws_ok($q$select public.admin_delete_unused_product('00000000-0000-4000-8000-000000008603','ISSUE86-USED-01','Must preserve commerce history')$q$,
 'P0001','Delete blocked by usage/history. Archive instead: ["public.commerce_skus"]','Deletion rejects commerce-linked product');
select lives_ok($q$select public.admin_product_archive('00000000-0000-4000-8000-000000008603','Discontinued after being linked')$q$,'Linked product may be safely archived');
select is((select active from public.products where id='00000000-0000-4000-8000-000000008603'),false,'Archive marks product inactive without removing history');
select * from finish();
rollback;
