-- Isolated, synthetic Pool multi-line & expiry fault injection. Entire test rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
do $pool_test$
declare admin_id uuid:=gen_random_uuid();
 buyers uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
 gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();
 rice uuid:=gen_random_uuid();oil uuid:=gen_random_uuid();pool uuid;
 cycle_a uuid;cycle_b uuid;new_a uuid;quote_id uuid;idx int;blocked boolean;
 lines jsonb;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 select x,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'scenario-pool-'||x||'@example.invalid',now(),now()
 from unnest(array[admin_id]||buyers) x;
 insert into public.user_roles(user_id,role) values(admin_id,'admin');
 insert into public.communities(id,name,slug,active) values
 (a,'Scenario Pool A','scenario-pool-a-'||a,true),
 (b,'Scenario Pool B','scenario-pool-b-'||b,true);
 for idx in 1..7 loop
  update public.profiles set community_id=case when idx=7 then b else a end,
   full_name='Scenario Pool Buyer '||idx,household_name='Scenario Family '||idx,
   phone='0180000000'||idx,onboarding_completed_at=now() where id=buyers[idx];
  if not found then raise exception 'Pool fixture customer missing';end if;
 end loop;
 insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
 values(rice,'Scenario Brown Rice','Rice','1 kg','kg','POOL-RICE-'||rice,'SUPPLIER_POOL',true,false),
 (oil,'Scenario Oil','Oil','5 L','L','POOL-OIL-'||oil,'SUPPLIER_POOL',true,false);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 pool:=public.admin_save_simple_offer_with_tiers(null,'COMMUNITY_POOL',array[a,b],
 'Multi-line hypothetical Pool',
 jsonb_build_array(
  jsonb_build_object('product_id',rice,'price',100,'old_price',140,'available_quantity',100),
  jsonb_build_object('product_id',oil,'price',200,'old_price',250,'available_quantity',100)),
 true,now()+interval '7 days',
 jsonb_build_array(
  jsonb_build_object('threshold',5,'prices',jsonb_build_array(
   jsonb_build_object('product_id',rice,'price',90),
   jsonb_build_object('product_id',oil,'price',170))),
  jsonb_build_object('threshold',10,'prices',jsonb_build_array(
   jsonb_build_object('product_id',rice,'price',80),
   jsonb_build_object('product_id',oil,'price',150)))));
 if pool is null then raise exception 'Pool not saved';end if;
 lines:=jsonb_build_array(jsonb_build_object('product_id',rice,'quantity',2),
  jsonb_build_object('product_id',oil,'quantity',3));
 perform set_config('request.jwt.claim.sub',buyers[1]::text,true);
 blocked:=false;
 begin perform public.join_simple_sale_pool_quantified(pool,jsonb_build_array(
  jsonb_build_object('product_id',rice,'quantity',2),
  jsonb_build_object('product_id',rice,'quantity',3)),a);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Pool duplicate products accepted';end if;
 blocked:=false;
 begin perform public.join_simple_sale_pool_quantified(pool,jsonb_build_array(
  jsonb_build_object('product_id',rice,'quantity',0)),a);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Invalid Pool quantity accepted';end if;
 for idx in 1..6 loop
  perform set_config('request.jwt.claim.sub',buyers[idx]::text,true);
  perform public.join_simple_sale_pool_quantified(pool,case when idx=1 then lines
   else jsonb_build_array(jsonb_build_object('product_id',rice,'quantity',1),
    jsonb_build_object('product_id',oil,'quantity',1)) end,a);
 end loop;
 perform set_config('request.jwt.claim.sub',buyers[7]::text,true);
 perform public.join_simple_sale_pool_quantified(pool,
  jsonb_build_array(jsonb_build_object('product_id',rice,'quantity',1)),b);
 select id into cycle_a from public.simple_sale_cycles where offer_id=pool and community_id=a and status='open';
 select id into cycle_b from public.simple_sale_cycles where offer_id=pool and community_id=b and status='open';
 if cycle_a=cycle_b or cycle_a is null or cycle_b is null then raise exception 'Pool cycles collided';end if;
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_a)<>6
 or (select count(*) from public.simple_sale_cycle_items where cycle_id=cycle_a)<>12
 or (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_b)<>1 then
  raise exception 'Household counted per line or wrong area';end if;
 perform set_config('request.jwt.claim.sub',buyers[1]::text,true);
 perform public.set_simple_sale_commitment_quantity(pool,rice,4);
 if (select quantity from public.simple_sale_cycle_items where cycle_id=cycle_a and customer_id=buyers[1] and product_id=rice)<>4
 then raise exception 'Pool quantity change not persisted';end if;
 -- Time expiry closes both independent community cycles at their own thresholds.
 update public.simple_sale_cycles set closes_at=now()-interval '1 second' where id in(cycle_a,cycle_b);
 if private.close_due_simple_sale_cycles_impl()<>2 then raise exception 'Expected two independently expired cycles';end if;
 if (select locked_threshold from public.simple_sale_cycles where id=cycle_a)<>5
 or (select locked_threshold from public.simple_sale_cycles where id=cycle_b)<>0 then
  raise exception 'Pool close used global participation instead of community count';end if;
 select id into quote_id from public.simple_sale_cycle_quotes where cycle_id=cycle_a and customer_id=buyers[1];
 if (select product_total from public.simple_sale_cycle_quotes where id=quote_id)<>870 then
  raise exception 'Whole-Pool price wrong: expected 4*90 + 3*170 = 870';end if;
 if (select sum(quantity*retail_reference) from public.simple_sale_cycle_quote_items where quote_id=quote_id)<>1310 then
  raise exception 'Whole-Pool retail reference mismatch';end if;
 if (select product_total from public.simple_sale_cycle_quotes where cycle_id=cycle_b)<>100 then
  raise exception 'Unmet Pool tier must use baseline starting price';end if;
 if (select count(*) from public.simple_sale_cycle_quotes where cycle_id=cycle_a)<>6 then
  raise exception 'Pool generated duplicate quotes for multi-item households';end if;
 select next_cycle_id into new_a from public.simple_sale_cycles where id=cycle_a;
 if new_a=cycle_a or new_a is null then raise exception 'Expired Pool not reopened';end if;
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=new_a)<>0 then
  raise exception 'Reopened Pool retained prior members';end if;
 if (select count(*) from public.launch_orders where customer_id=any(buyers))<>0 then
  raise exception 'Pool closure created premature order';end if;
 raise notice 'PASS: fictional Pool areas, 6+1 buyers, 2 products per household, quantity edit, whole-Pool 5-tier totals, expiry, zero-tier cancellation option, rollover';
end $pool_test$;
select ok(true,'Pool multi-line community pricing and timed closing passed');
select * from finish();
rollback;
