-- Fictional fixtures only; exercises the real RPCs and rolls everything back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
do $$
declare a uuid:=gen_random_uuid();u uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();cid uuid:=gen_random_uuid();
 direct_id uuid;deal_id uuid;pool_id uuid;oid uuid;k uuid:=gen_random_uuid();blocked boolean;payload jsonb;v jsonb;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','offer-test-'||a||'@example.invalid',now(),now()),
 (u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','offer-test-'||u||'@example.invalid',now(),now());
 insert into public.user_roles(user_id,role) values(a,'admin');
 insert into public.communities(id,name,slug,active) values(cid,'Fictional offer area','offer-test-'||cid,true);
 insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
 values(pid,'Fictional shared rice','Rice','1 kg','kg','OFFER-TEST-'||pid,'SUPPLIER_POOL',true,false);
 perform set_config('request.jwt.claim.sub',u::text,true);
 blocked=false;
 begin perform public.admin_save_simple_offer(null,'SOLO',cid,'Unauthorized test',jsonb_build_array(jsonb_build_object('product_id',pid,'price',100)),true);exception when others then blocked=true;end;
 if not blocked then raise exception 'Non-admin published an offer';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 direct_id=public.admin_save_simple_offer(null,'SOLO',cid,'Fictional Direct',jsonb_build_array(jsonb_build_object('product_id',pid,'price',100,'old_price',0,'available_quantity',10)),true);
 deal_id=public.admin_save_simple_offer(null,'GROUP_DEAL',cid,'Fictional Deal',jsonb_build_array(jsonb_build_object('product_id',pid,'price',90)),true);
 pool_id=public.admin_save_simple_offer(null,'COMMUNITY_POOL',cid,'Fictional Pool',jsonb_build_array(jsonb_build_object('product_id',pid,'price',80)),false);
 if (select available_quantity from public.launch_product_stock where product_id=pid)<>10 then raise exception 'Adding another offer reset shared stock';end if;
 if exists(select 1 from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=pool_id) then raise exception 'Draft visible publicly';end if;
 perform public.admin_save_simple_offer(pool_id,'COMMUNITY_POOL',cid,'Fictional Pool',jsonb_build_array(jsonb_build_object('product_id',pid,'price',80)),true);
 execute 'set local role anon';
 if not exists(select 1 from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=pool_id) then raise exception 'Published pool missing from anonymous feed';end if;
 if has_table_privilege('anon','public.simple_sale_offers','select') or has_function_privilege('anon','public.admin_save_simple_offer(uuid,text,uuid,text,jsonb,boolean,timestamptz)','execute') then raise exception 'Anonymous access too broad';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',u::text,true);
 -- Joining a Group Deal is a commitment, not a checkout order.
 payload=jsonb_build_array(jsonb_build_object('product_id',pid,'offer_id',deal_id,'quantity',2,'unit_price',0.01));
 blocked=false;
 begin
  perform public.launch_submit_order(payload,k,'Fictional buyer','01700000000','Fictional delivery address','pickup',true);
 exception when others then
  if sqlerrm like 'Group Deal and Pool are commitments only%' then blocked=true;else raise;end if;
 end;
 if not blocked then raise exception 'Premature Group Deal checkout was accepted';end if;
 if exists(select 1 from public.launch_orders where request_key=k) then raise exception 'Premature checkout created a real order';end if;
 if (select available_quantity from public.launch_product_stock where product_id=pid)<>10 then raise exception 'Premature commitment consumed stock';end if;
 if (select (o->>'buyer_count')::integer from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=deal_id)<>0 then raise exception 'Rejected order counted as participant';end if;
 -- SOLO direct product checkout still works, with idempotency, review and stock rollback.
 payload=jsonb_build_array(jsonb_build_object('product_id',pid,'offer_id',direct_id,'quantity',2,'unit_price',0.01));
 oid=public.launch_submit_order(payload,k,'Fictional buyer','01700000000','Fictional delivery address','pickup',true);
 if (select subtotal from public.launch_orders where id=oid)<>200 then raise exception 'Direct price was not enforced';end if;
 if public.launch_submit_order(payload,k,'Fictional buyer','01700000000','Fictional delivery address','pickup',true)<>oid then raise exception 'Idempotent Direct retry failed';end if;
 if (select available_quantity from public.launch_product_stock where product_id=pid)<>8 then raise exception 'Direct stock not decremented correctly';end if;
 if (select (i->>'available_quantity')::integer from jsonb_array_elements(public.get_public_simple_offers()) o cross join lateral jsonb_array_elements(o->'items') i where (o->>'id')::uuid=pool_id)<>8 then raise exception 'Pool has stale shared-stock display';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.launch_review_order(oid,'confirm',20,'Fictional Direct review');
 if (select (o->>'buyer_count')::integer from jsonb_array_elements(public.get_public_simple_offers()) o where (o->>'id')::uuid=deal_id)<>0 then raise exception 'Direct buyer counted toward Group Deal';end if;
 perform public.launch_review_order(oid,'cancel',0,'Fictional cancellation');
 if (select available_quantity from public.launch_product_stock where product_id=pid)<>10 then raise exception 'Direct cancellation failed to restore stock';end if;
 perform public.admin_save_simple_offer(pool_id,'COMMUNITY_POOL',cid,'Fictional Pool',jsonb_build_array(jsonb_build_object('product_id',pid,'price',80)),false);
 perform set_config('request.jwt.claim.sub',u::text,true);
 blocked=false;
 begin perform public.launch_submit_order(jsonb_build_array(jsonb_build_object('product_id',pid,'offer_id',pool_id,'quantity',1)),gen_random_uuid(),'Fictional buyer','01700000000','Fictional delivery address','pickup',true);exception when others then blocked=true;end;
 if not blocked then raise exception 'Unpublished offer accepted at checkout';end if;
 if (select available_quantity from public.launch_product_stock where product_id=pid)<>10 then raise exception 'Failed checkout consumed inventory';end if;
 select x into v from jsonb_array_elements(public.get_public_launch_catalog(pid)) x limit 1;
 if (v->>'approved_unit_price')::numeric<>100 then raise exception 'Direct catalog has wrong price';end if;
 execute 'set local role authenticated';
 if exists(select 1 from public.simple_sale_offers where id=direct_id) then raise exception 'Customer can read admin drafts';end if;
 execute 'reset role';
end $$;
select ok(true,'Master reuse, draft privacy, early Deal/Pool order block, Direct idempotency, stock restoration and safe cancellation');
select * from finish();
rollback;
