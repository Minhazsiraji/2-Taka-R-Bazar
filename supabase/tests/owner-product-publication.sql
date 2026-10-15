-- Issue #96: owner publication authority, on isolated transactional test database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000009601','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-9601@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000009602','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-9602@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000009603','00000000-0000-0000-0000-000000000000','authenticated','authenticated','other-super-9603@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000009601','super_admin'),
 ('00000000-0000-4000-8000-000000009602','admin'),
 ('00000000-0000-4000-8000-000000009603','super_admin');
-- Disposable CI has no owner yet; binding a test principal requires privileged SQL.
insert into private.platform_owner_identity(singleton,owner_user_id)
values(true,'00000000-0000-4000-8000-000000009601')
on conflict(singleton) do nothing;

select ok((select owner_user_id='00000000-0000-4000-8000-000000009601'::uuid from private.platform_owner_identity),
 'Platform owner is bound to an immutable single identity');
select ok(not has_table_privilege('authenticated','private.platform_owner_identity','INSERT'),
 'Authenticated staff cannot grant itself ownership');
select ok(not has_function_privilege('anon','public.is_current_platform_owner()','EXECUTE'),
 'Anonymous users cannot invoke the owner capability check');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009601',true);
select is(public.is_current_platform_owner(),true,'Verified owner with Super Admin role recognized');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009602',true);
select is(public.is_current_platform_owner(),false,'Ordinary Admin is not owner');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009603',true);
select is(public.is_current_platform_owner(),false,'Another Super Admin is not owner');

insert into public.products(id,name,category,package_size,unit,sku,active,is_demo,image_url) values
 ('00000000-0000-4000-8000-000000009610','Synthetic owner butter','Dairy','1 kg','pack','OWNER-BUTTER-9610',true,false,'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
 ('00000000-0000-4000-8000-000000009611','Synthetic staff ghee','Dairy','1 kg','pack','STAFF-GHEE-9611',true,false,'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
 ('00000000-0000-4000-8000-000000009612','Synthetic non-owner Super Admin item','Dairy','1 kg','pack','SECOND-SUPER-9612',true,false,'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
 ('00000000-0000-4000-8000-000000009613','Synthetic existing owner review','Dairy','1 kg','pack','OWNER-REVIEW-9613',true,false,'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
 ('00000000-0000-4000-8000-000000009614','Synthetic owner missing photo','Dairy','1 kg','pack','OWNER-NOPHOTO-9614',true,false,null);

insert into public.product_seo_content
(product_id,slug,title_en,title_bn,description_en,description_bn,
 meta_title_en,meta_title_bn,meta_description_en,meta_description_bn,
 alt_en,alt_bn,verification_notes,edited_by,status)
select p.id,lower(p.sku),p.name,'পরীক্ষার পণ্য',
 'Synthetic product description with sufficient verifiable text for independent product SEO testing only.',
 'এটি শুধুমাত্র বিচ্ছিন্ন ডেটাবেসে পণ্যের পরীক্ষার জন্য তৈরি বিবরণ।',
 'Sample dairy product for isolated SEO checks','পরীক্ষামূলক দুগ্ধজাত পণ্য',
 'Synthetic local product catalog description for role-isolation SEO testing; no retail offer exists.',
 'এটি শুধুমাত্র পরীক্ষামূলক পণ্যের মেটা বিবরণ।',
 'A verified isolated product master image','পরীক্ষার জন্য পণ্যের আসল ছবি',
 'Evidence recorded for this synthetic unit test only.',
 case when p.sku in ('OWNER-BUTTER-9610','OWNER-REVIEW-9613','OWNER-NOPHOTO-9614')
 then '00000000-0000-4000-8000-000000009601'::uuid
 when p.sku='STAFF-GHEE-9611' then '00000000-0000-4000-8000-000000009602'::uuid
 else '00000000-0000-4000-8000-000000009603'::uuid end,
 case when p.sku='OWNER-REVIEW-9613' then 'review' else 'draft' end
from public.products p where p.sku in ('OWNER-BUTTER-9610','STAFF-GHEE-9611','SECOND-SUPER-9612','OWNER-REVIEW-9613','OWNER-NOPHOTO-9614');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009601',true);
select lives_ok($test$select public.admin_submit_product_seo('00000000-0000-4000-8000-000000009610')$test$,
 'Owner can publish their valid draft directly, no separate reviewer');
select is((select status from public.product_seo_content where product_id='00000000-0000-4000-8000-000000009610'),
 'published','Owner-authored product becomes published');
select is((select count(*) from public.get_public_product_seo('owner-butter-9610',1,0)),
 1::bigint,'Owner-published product is visible in narrow public SEO endpoint');
select is((select event from public.product_seo_audit where product_id='00000000-0000-4000-8000-000000009610' order by changed_at desc limit 1),
 'published','Owner direct-publication creates standard publish audit event');
select lives_ok($test$select public.admin_submit_product_seo('00000000-0000-4000-8000-000000009613')$test$,
 'Existing owner-authored Review status can publish without second approver');
select is((select status from public.product_seo_content where product_id='00000000-0000-4000-8000-000000009613'),
 'published','Existing owner Review becomes published');
select throws_ok($test$select public.admin_submit_product_seo('00000000-0000-4000-8000-000000009614')$test$,
 'P0001','Content incomplete, unverified, inactive or missing genuine image',
 'Even owner cannot publish missing genuine photo');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009602',true);
select lives_ok($test$select public.admin_submit_product_seo('00000000-0000-4000-8000-000000009611')$test$,
 'Admin content enters independent review');
select is((select status from public.product_seo_content where product_id='00000000-0000-4000-8000-000000009611'),
 'review','Ordinary Admin cannot self-publish');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009603',true);
select lives_ok($test$select public.admin_submit_product_seo('00000000-0000-4000-8000-000000009612')$test$,
 'Non-owner Super Admin submission enters independent review');
select is((select status from public.product_seo_content where product_id='00000000-0000-4000-8000-000000009612'),
 'review','Another Super Admin cannot use owner direct publication');
select throws_ok($test$select public.admin_review_product_seo('00000000-0000-4000-8000-000000009612',true,'Trying self review with Super Admin account')$test$,
 'P0001','Independent review and reason required','Non-owner Super Admin cannot approve their own content');

select * from finish();
rollback;
