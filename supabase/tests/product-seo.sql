-- Issue #80 disposable pgTAP: NEVER run against the shared Production database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
select ok((select relrowsecurity from pg_class where oid='public.product_seo_content'::regclass),'SEO content protected by RLS');
select ok((select relrowsecurity from pg_class where oid='public.product_seo_faqs'::regclass),'FAQs protected by RLS');
select ok((select relrowsecurity from pg_class where oid='public.product_seo_media'::regclass),'SEO media protected by RLS');
select ok(not has_table_privilege('anon','public.product_seo_content','SELECT'),'Anonymous cannot access internal SEO drafts');
select ok(not has_table_privilege('authenticated','public.product_seo_content','UPDATE'),'Authenticated cannot write SEO content directly');
select ok(has_function_privilege('anon','public.get_public_product_seo(text,integer,integer)','EXECUTE'),'Guests can read the narrow public projection');
select ok(not has_function_privilege('anon','public.admin_save_product_seo(uuid,jsonb,jsonb,jsonb)','EXECUTE'),'Anonymous cannot mutate SEO');
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000008001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','seo-editor-8001@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000008002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','seo-reviewer-8002@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000008001','admin'),
 ('00000000-0000-4000-8000-000000008002','super_admin');
insert into public.products(id,name,brand,category,package_size,unit,sku,image_url,is_demo)
values('00000000-0000-4000-8000-000000008003','Synthetic loose brown rice',null,'Rice & Grains','1 kg','kg','SEO-SYNTH-8003',
 'https://example.supabase.co/storage/v1/object/public/product-images/test/rice.jpg',false);
select is((select brand_type from public.products where id='00000000-0000-4000-8000-000000008003'),'UNBRANDED_LOOSE','Unbranded classification defaults safely');
select is((select count(*) from public.get_public_product_seo('synthetic-brown-rice',1,0)),0::bigint,'Nothing public without an explicit SEO publication');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008001',true);
select lives_ok($call$select public.admin_save_product_seo(
 '00000000-0000-4000-8000-000000008003',
 '{
  "slug":"synthetic-brown-rice","title_en":"Brown Rice (Loose) 1 kg","title_bn":"ব্রাউন রাইস (খোলা চাল) ১ কেজি",
  "description_en":"Unbranded brown rice sold loose by weight for everyday home cooking. Verify actual rice variety before purchase.",
  "description_bn":"দৈনন্দিন রান্নার জন্য ব্রাউন রাইস খোলা অবস্থায় ওজন অনুযায়ী বিক্রি করা হয়।",
  "meta_title_en":"Brown Rice Loose 1 kg in Bangladesh","meta_title_bn":"ব্রাউন রাইস খোলা চাল ১ কেজি",
  "meta_description_en":"Explore loose brown rice by weight and discover community buying opportunities in Bangladesh.",
  "meta_description_bn":"ব্রাউন রাইস খোলা চালের পণ্যের তথ্য ও কমিউনিটি কেনাকাটার সুযোগ দেখুন।",
  "alt_en":"Actual loose brown rice grains","alt_bn":"আসল খোলা ব্রাউন রাইসের দানা",
  "verification_notes":"Supplier-reported rice type and product photography reviewed.",
  "brand_type":"UNBRANDED_LOOSE","specs":{"package_kind":"loose"},"expected_version":0
 }'::jsonb,
 '[{"question_en":"Is it factory packed?","answer_en":"No, it is loose by weight.",
 "question_bn":"এটি কি প্যাকেটজাত?","answer_bn":"না, ওজন অনুযায়ী বিক্রি হয়।"}]'::jsonb,
 '[]'::jsonb)$call$,'Admin saves bilingual content as a draft');
select is((select status from public.product_seo_content where product_id='00000000-0000-4000-8000-000000008003'),'draft','A saved draft is not published');
select is((select count(*) from public.get_public_product_seo('synthetic-brown-rice',1,0)),0::bigint,'Draft cannot leak through anonymous projection');
select lives_ok($call$select public.admin_submit_product_seo('00000000-0000-4000-8000-000000008003')$call$,'Complete non-demo item can enter review');
select throws_ok($call$select public.admin_review_product_seo('00000000-0000-4000-8000-000000008003',true,'Verified independent review note')$call$,
 'P0001','Super Admin required','Ordinary Admin cannot approve');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008002',true);
select lives_ok($call$select public.admin_review_product_seo('00000000-0000-4000-8000-000000008003',true,'Evidence and bilingual text checked')$call$,'Independent Super Admin can publish');
select is((select count(*) from public.get_public_product_seo('synthetic-brown-rice',1,0)),1::bigint,'Only published real non-demo product visible');
select is((select sku from public.get_public_product_seo('synthetic-brown-rice',1,0)),'SEO-SYNTH-8003','Product structured SKU matches master');
select is((select count(*) from public.product_seo_faqs where product_id='00000000-0000-4000-8000-000000008003'),1::bigint,'Bilingual FAQ saved in same transaction');
update public.products set is_demo=true where id='00000000-0000-4000-8000-000000008003';
select is((select count(*) from public.get_public_product_seo('synthetic-brown-rice',1,0)),0::bigint,'Demo flag immediately hides published SEO');
select is((select count(*) from public.product_seo_audit where product_id='00000000-0000-4000-8000-000000008003'),3::bigint,'Save, submit and publish have an audit trail');
select * from finish();
rollback;
