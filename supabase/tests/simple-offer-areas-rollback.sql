-- Fictional multi-area offers; no hosted business data. All changes rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
do $$
declare a uuid:=gen_random_uuid();u uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();
 ca uuid:=gen_random_uuid();cb uuid:=gen_random_uuid();cc uuid:=gen_random_uuid();off uuid:=gen_random_uuid();
 oid uuid;v jsonb;items jsonb;kind text;blocked boolean;existing integer;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','areas-'||a||'@example.invalid',now(),now()),
 (u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','areas-'||u||'@example.invalid',now(),now());
 insert into public.user_roles(user_id,role) values(a,'admin');
 insert into public.communities(id,name,slug,active) values
 (ca,'Fictional area A','areas-'||ca,true),(cb,'Fictional area B','areas-'||cb,true),(cc,'Fictional inactive','areas-'||cc,false);
 insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
 values(pid,'Fictional multi-area rice','Rice','1 kg','kg','AREAS-'||pid,'SUPPLIER_POOL',true,false);
 items=jsonb_build_array(jsonb_build_object('product_id',pid,'price',80,'available_quantity',10));
 perform set_config('request.jwt.claim.sub',u::text,true);
 blocked=false;
 begin perform public.admin_save_simple_offer_areas(null,'SOLO',array[ca,cb],'Not authorized',items,true);exception when others then blocked=true;end;
 if not blocked then raise exception 'Customer saved an offer';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 foreach kind in array array['SOLO','GROUP_DEAL','COMMUNITY_POOL'] loop
  oid=public.admin_save_simple_offer_areas(null,kind,array[ca,cb,ca],'Fictional multi-area '||kind,items,true);
  if (select count(*) from public.simple_sale_offer_communities where offer_id=oid)<>2 then raise exception 'Selected areas not saved / deduplicated';end if;
  select o into v from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=oid;
  if jsonb_array_length(v->'community_ids')<>2 or not(v->'community_ids' ? ca::text) or not(v->'community_ids' ? cb::text) then raise exception 'Public areas missing';end if;
  if (select count(*) from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=oid)<>1 then raise exception 'Offer duplicated publicly';end if;
 end loop;
 -- No cap on areas: the same RPC is used by Select all. Invalid sets fail atomically.
 select count(*) into existing from public.simple_sale_offers where created_by=a;
 blocked=false;
 begin perform public.admin_save_simple_offer_areas(null,'SOLO',array[ca,cc],'Inactive area',items,true);exception when others then blocked=true;end;
 if not blocked then raise exception 'Inactive area accepted';end if;
 blocked=false;
 begin perform public.admin_save_simple_offer_areas(null,'SOLO','{}'::uuid[],'Empty areas',items,true);exception when others then blocked=true;end;
 if not blocked or (select count(*) from public.simple_sale_offers where created_by=a)<>existing then raise exception 'Invalid save partially wrote offers';end if;
 -- Editing/retrying is one offer, with one shared stock balance.
 perform public.admin_save_simple_offer_areas(oid,'COMMUNITY_POOL',array[ca,cb],'Fictional edited Pool',jsonb_build_array(jsonb_build_object('product_id',pid,'price',75)),true);
 if (select count(*) from public.simple_sale_offers where created_by=a)<>existing or (select available_quantity from public.launch_product_stock where product_id=pid)<>10 then raise exception 'Edit duplicated offer or reset stock';end if;
 update public.communities set active=false where id=ca;
 select o into v from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=oid;
 if v is null or v->'community_ids'<>jsonb_build_array(cb) or (v->>'community_id')::uuid<>cb then raise exception 'Inactive primary hid other active target area';end if;
 update public.communities set active=true where id=ca;
 -- Single-community callers still work; a changed primary replaces its targets.
 off=public.admin_save_simple_offer(null,'SOLO',ca,'Fictional legacy',items,false);
 if not exists(select 1 from public.simple_sale_offer_communities where offer_id=off and community_id=ca) then raise exception 'Legacy insert lost area';end if;
 perform public.admin_save_simple_offer(off,'SOLO',cb,'Fictional legacy changed',items,false);
 if (select count(*) from public.simple_sale_offer_communities where offer_id=off)<>1 or not exists(select 1 from public.simple_sale_offer_communities where offer_id=off and community_id=cb) then raise exception 'Legacy primary change left stale targets';end if;
 perform public.admin_save_simple_offer_areas(oid,'COMMUNITY_POOL',array[cb],'Fictional edited Pool',jsonb_build_array(jsonb_build_object('product_id',pid,'price',75)),true);
 if (select count(*) from public.simple_sale_offer_communities where offer_id=oid)<>1 then raise exception 'Removed area retained';end if;
 execute 'set local role anon';
 if has_table_privilege('anon','public.simple_sale_offer_communities','select') or has_function_privilege('anon','public.admin_save_simple_offer_areas(uuid,text,uuid[],text,jsonb,boolean,timestamptz)','execute') then raise exception 'Anonymous permissions too broad';end if;
 if not exists(select 1 from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=oid) then raise exception 'Anonymous browse lost public offer';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.simple_sale_offer_communities where offer_id=oid) then raise exception 'Customer can read admin area configuration';end if;
 execute 'reset role';
end $$;
select ok(true,'Multi-area save, all three types, no duplicate cards, active areas, atomic validation, edits, stock, legacy compatibility and RLS');
select * from finish();
rollback;
