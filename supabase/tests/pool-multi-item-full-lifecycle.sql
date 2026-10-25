-- Rollback-only synthetic UAT: 20-SKU Pool, community isolation, rejoin/leave,
-- deadline with no tier, explicit consent, maker/checker payment and 1-order-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
do $scenario$
declare
 maker uuid:=gen_random_uuid();checker uuid:=gen_random_uuid();
 members uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
  gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();
 products uuid[]:=array[]::uuid[]; pid uuid;
 pool_offer uuid; cycle_a uuid; cycle_next uuid;cycle_b uuid;
 point uuid:=gen_random_uuid();recipient uuid:=gen_random_uuid();
 items jsonb:='[]'::jsonb;lines jsonb:='[]'::jsonb;one_line jsonb;
 prices_three jsonb:='[]'::jsonb;prices_five jsonb:='[]'::jsonb;
 first_quote uuid; b_quote uuid; created_order uuid;old_stock int; blocked boolean;
 i int; j int;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 select u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'pool20-'||u||'@example.invalid',now(),now()
 from unnest(array[maker,checker]||members) u;
 insert into public.user_roles(user_id,role) values(maker,'admin'),(checker,'admin');
 insert into public.communities(id,name,slug,active) values
 (a,'Synthetic Twenty SKU A','pool-twenty-a-'||a,true),
 (b,'Synthetic Twenty SKU B','pool-twenty-b-'||b,true);
 for i in 1..6 loop
  update public.profiles set
   full_name='Synthetic Pool buyer '||i,household_name='Hypothetical Pool Household '||i,
   phone='0170050'||lpad(i::text,4,'0'),
   community_id=case when i=6 then b else a end,
   onboarding_completed_at=now() where id=members[i];
  if not found then raise exception 'Missing fictional profile %',i;end if;
 end loop;
 for i in 1..20 loop
  pid:=gen_random_uuid();products:=array_append(products,pid);
  insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
  values(pid,'Fictional Pool Item '||i,'Grocery','1 kg','kg',
   'POOL20-'||left(pid::text,8),'SUPPLIER_POOL',true,false);
  items:=items||jsonb_build_array(jsonb_build_object('product_id',pid,
   'price',100,'old_price',130,'available_quantity',100));
  prices_three:=prices_three||jsonb_build_array(jsonb_build_object('product_id',pid,'price',90));
  prices_five:=prices_five||jsonb_build_array(jsonb_build_object('product_id',pid,'price',80));
  lines:=lines||jsonb_build_array(jsonb_build_object('product_id',pid,
   'quantity',case when i=1 then 2 else 1 end));
 end loop;
 insert into public.pickup_points(id,community_id,name,address,active)
 values(point,a,'Fictional Community Gate','Synthetic Station Road, A',true);
 insert into public.pilot_payment_recipients(id,method,account_name,account_number,active,configured_by)
 values(recipient,'bkash','Fictional Recipient','01700000000',true,maker);
 perform set_config('request.jwt.claim.sub',maker::text,true);
 pool_offer:=public.admin_save_simple_offer_with_tiers(null,'COMMUNITY_POOL',array[a,b],
  'Fictional 20-item Two-area Monthly Pool',items,true,now()+interval '7 days',
  jsonb_build_array(
    jsonb_build_object('threshold',3,'prices',prices_three),
    jsonb_build_object('threshold',5,'prices',prices_five)));
 if pool_offer is null then raise exception '20-item Pool could not be saved';end if;
 -- Cross-area join and invalid 21-line basket must be rejected atomically.
 perform set_config('request.jwt.claim.sub',members[1]::text,true);
 blocked:=false;
 begin perform public.join_simple_sale_pool_quantified(pool_offer,lines,b);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Cross-community Pool join was allowed';end if;
 blocked:=false;
 begin perform public.join_simple_sale_pool_quantified(pool_offer,
  lines||jsonb_build_array(jsonb_build_object('product_id',products[1],'quantity',1)),a);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Duplicate 21-line Pool basket was allowed';end if;
 -- A 20-item basket counts as only ONE household; identical retries do not double-count.
 if not public.join_simple_sale_pool_quantified(pool_offer,lines,a)
 then raise exception 'Initial Pool join failed';end if;
 if public.join_simple_sale_pool_quantified(pool_offer,lines,a)
 then raise exception 'Identical Pool join counted twice';end if;
 for i in 2..5 loop
  perform set_config('request.jwt.claim.sub',members[i]::text,true);
  one_line:=jsonb_build_array(
   jsonb_build_object('product_id',products[1],'quantity',1),
   jsonb_build_object('product_id',products[2],'quantity',1));
  perform public.join_simple_sale_pool_quantified(pool_offer,one_line,a);
 end loop;
 select id,next_cycle_id into cycle_a,cycle_next
  from public.simple_sale_cycles
  where offer_id=pool_offer and community_id=a and status='closed' and cycle_number=1;
 if cycle_a is null or cycle_next is null then raise exception 'Five-member Pool failed to close/reopen';end if;
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_a)<>5
 then raise exception 'One buyer was counted multiple times';end if;
 if (select locked_threshold from public.simple_sale_cycles where id=cycle_a)<>5
 then raise exception 'Pool did not lock tier five';end if;
 select id into first_quote from public.simple_sale_cycle_quotes
 where cycle_id=cycle_a and customer_id=members[1];
 if first_quote is null
  or (select product_total from public.simple_sale_cycle_quotes where id=first_quote)<>1680
  or (select count(*) from public.simple_sale_cycle_quote_items where quote_id=first_quote)<>20
  or exists(select 1 from public.simple_sale_cycle_quote_items
   where quote_id=first_quote and unit_price<>80)
 then raise exception 'Multi-item frozen total/quantity/tier prices incorrect';end if;
 if (select count(*) from public.launch_orders where customer_id=any(members))<>0
 then raise exception 'Pool created order before payment';end if;
 -- Previous-cycle rejoin requires explicit next cycle ID; leave wipes full new basket only.
 perform set_config('request.jwt.claim.sub',members[1]::text,true);
 blocked:=false;
 begin perform public.join_simple_sale_pool_quantified(pool_offer,
  jsonb_build_array(jsonb_build_object('product_id',products[1],'quantity',1)),a);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Stale Pool link rejoined without cycle confirmation';end if;
 perform public.join_simple_sale_pool_quantified(pool_offer,
  jsonb_build_array(jsonb_build_object('product_id',products[1],'quantity',1)),a,cycle_next);
 if not public.leave_simple_sale_pool(pool_offer) then
  raise exception 'Cannot leave open Pool';end if;
 if public.leave_simple_sale_pool(pool_offer) then
  raise exception 'Repeated Pool withdrawal was not idempotent';end if;
 if exists(select 1 from public.simple_sale_cycle_items where cycle_id=cycle_next
  and customer_id=members[1])
  or exists(select 1 from public.simple_sale_cycle_members where cycle_id=cycle_next
  and customer_id=members[1])
 then raise exception 'Pool withdrawal retained phantom membership';end if;
 if (select product_total from public.simple_sale_cycle_quotes where id=first_quote)<>1680
 then raise exception 'Open-round withdrawal rewrote older immutable quote';end if;
 -- Community B deadline with one buyer closes at opening price, no unlocked tier.
 perform set_config('request.jwt.claim.sub',members[6]::text,true);
 perform public.join_simple_sale_pool_quantified(pool_offer,
  jsonb_build_array(jsonb_build_object('product_id',products[1],'quantity',1),
    jsonb_build_object('product_id',products[2],'quantity',2)),b);
 select id into cycle_b from public.simple_sale_cycles
  where offer_id=pool_offer and community_id=b and status='open';
 update public.simple_sale_cycles set closes_at=now()-interval '1 second'
 where id=cycle_b;
 perform private.close_simple_sale_cycle_impl(cycle_b,false);
 if (select locked_threshold from public.simple_sale_cycles where id=cycle_b)<>0
 then raise exception 'Unmet Pool tier failed to fall back to opening price';end if;
 select id into b_quote from public.simple_sale_cycle_quotes
 where cycle_id=cycle_b and customer_id=members[6];
 if (select product_total from public.simple_sale_cycle_quotes where id=b_quote)<>300
 then raise exception 'No-tier Pool customer quote wrong';end if;
 -- The original 20-product quote can be settled without an early order.
 perform set_config('request.jwt.claim.sub',members[1]::text,true);
 perform public.customer_set_simple_sale_quote_delivery(first_quote,'pickup',point,null);
 perform set_config('request.jwt.claim.sub',maker::text,true);
 perform public.admin_quote_simple_sale_delivery(first_quote,20);
 perform set_config('request.jwt.claim.sub',members[1]::text,true);
 perform public.customer_decide_simple_sale_quote(first_quote,'accept',
  'Fictional Pool Buyer','01700500001',true);
 perform public.customer_submit_simple_sale_payment(first_quote,recipient,'FICT-POOL20-0001');
 perform set_config('request.jwt.claim.sub',checker::text,true);
 old_stock:=(select available_quantity from public.launch_product_stock where product_id=products[1]);
 created_order:=public.admin_verify_simple_sale_payment(first_quote,1700,true);
 if created_order is null then raise exception 'Pool quote did not create a verified order';end if;
 if public.admin_verify_simple_sale_payment(first_quote,1700,true)<>created_order
 then raise exception 'Repeated checker verification created different order';end if;
 if (select count(*) from public.launch_order_items where order_id=created_order)<>20
  or (select total_amount from public.launch_orders where id=created_order)<>1700
 then raise exception '20-product order line count or accepted grand total wrong';end if;
 if (select available_quantity from public.launch_product_stock where product_id=products[1])<>old_stock-2
 then raise exception 'Pool stock was not deducted exactly once by quantity';end if;
 if (select count(*) from public.launch_orders where customer_id=members[1])<>1
 then raise exception 'Duplicate final Pool order';end if;
 raise notice 'PASS hypothetical 20-product Pool: tier prices, exact quantities, two areas, rollover, open leave, no-tier expiry, verified order, stock-once';
end $scenario$;
select ok(true,'20-product multi-area Pool lifecycle, no-tier expiry, open withdrawal and maker-checker order');
select * from finish();
rollback;
