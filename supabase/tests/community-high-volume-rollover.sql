-- Rollback-only hypothetical 24-household upper-tier Pool rollover.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
do $scenario$
declare
 staff uuid:=gen_random_uuid();people uuid[]:=array[]::uuid[];
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();product_id uuid:=gen_random_uuid();
 scenario_offer uuid;closed_a uuid;new_a uuid;open_b uuid;u uuid;i integer;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 values(staff,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'hypo-admin-'||staff||'@example.invalid',now(),now());
 insert into public.user_roles(user_id,role) values(staff,'admin');
 insert into public.communities(id,name,slug,active) values
 (a,'Large Synthetic Community A','synthetic-large-a-'||a,true),
 (b,'Small Synthetic Community B','synthetic-small-b-'||b,true);
 insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
 values(product_id,'Synthetic High Volume Rice','Rice','1 kg','kg',
 'HIGH-VOLUME-'||left(product_id::text,8),'SUPPLIER_POOL',true,false);
 for i in 1..24 loop
  u:=gen_random_uuid();
  people:=array_append(people,u);
  insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
  values(u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'hypo-high-'||u||'@example.invalid',now(),now());
  update public.profiles set
   full_name='Synthetic buyer '||i,household_name='Household '||i,
   phone='017000'||lpad(i::text,5,'0'),
   community_id=case when i<=20 then a else b end,
   onboarding_completed_at=now()
  where id=u;
  if not found then raise exception 'Missing customer profile %',i;end if;
 end loop;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 scenario_offer:=public.admin_save_simple_offer_with_tiers(
  null,'COMMUNITY_POOL',array[a,b],'Hypothetical 3-tier Large Pool',
  jsonb_build_array(jsonb_build_object('product_id',product_id,
   'price',100,'old_price',150,'available_quantity',500)),
  true,now()+interval '7 days',
  jsonb_build_array(
   jsonb_build_object('threshold',5,'prices',jsonb_build_array(
    jsonb_build_object('product_id',product_id,'price',95))),
   jsonb_build_object('threshold',10,'prices',jsonb_build_array(
    jsonb_build_object('product_id',product_id,'price',85))),
   jsonb_build_object('threshold',20,'prices',jsonb_build_array(
    jsonb_build_object('product_id',product_id,'price',75)))));
 if scenario_offer is null then raise exception 'Synthetic Pool failed to publish';end if;
 -- Simulate a direct RPC caller omitting a closing date: every open cycle must get one.
 update public.simple_sale_cycles set closes_at=null
 where offer_id=scenario_offer and status='open';
 if exists(select 1 from public.simple_sale_cycles where offer_id=scenario_offer and status='open'
  and (closes_at is null or closes_at>now()+interval '8 days')) then
  raise exception 'Undated shared cycle was not assigned its automatic closing window';end if;
 for i in 1..24 loop
  perform set_config('request.jwt.claim.sub',people[i]::text,true);
  perform public.join_simple_sale_pool_quantified(scenario_offer,
   jsonb_build_array(jsonb_build_object('product_id',product_id,'quantity',1)),
   case when i<=20 then a else b end);
 end loop;
 select id,next_cycle_id into closed_a,new_a from public.simple_sale_cycles
 where offer_id=scenario_offer and community_id=a and cycle_number=1 and status='closed';
 if closed_a is null or new_a is null or closed_a=new_a then
  raise exception 'Max Pool tier did not create a new cycle ID';end if;
 if (select locked_threshold from public.simple_sale_cycles where id=closed_a)<>20 then
  raise exception 'Upper tier was not frozen at 20 households';end if;
 if (select count(*) from public.simple_sale_cycle_quotes where cycle_id=closed_a)<>20
 or exists(select 1 from public.simple_sale_cycle_quotes
   where cycle_id=closed_a and product_total<>75)
 then raise exception 'Expected 20 immutable quotes at top-tier unit price 75';end if;
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=new_a)<>0 then
  raise exception 'Next Pool cycle has phantom members';end if;
 select id into open_b from public.simple_sale_cycles
 where offer_id=scenario_offer and community_id=b and status='open';
 if open_b is null or (select count(*) from public.simple_sale_cycle_members where cycle_id=open_b)<>4 then
  raise exception 'Second community progress changed with first community closure';end if;
 if (select count(*) from public.launch_orders
  where customer_id=any(people))<>0 then
  raise exception 'Commitment-only Pool created premature order';end if;
 raise notice 'PASS 24 fictional households: 20 top-tier price quotes, new empty A cycle, B 4/5 unchanged, no early orders';
end $scenario$;
select ok(true,'24-household 3-tier Pool closed independently at target 20');
select * from finish();
rollback;
