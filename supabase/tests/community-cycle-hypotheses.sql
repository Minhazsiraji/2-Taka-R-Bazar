-- Fictional, disposable-DB only. Fail-fast rollback harness.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
do $tests$
declare
 maker uuid:=gen_random_uuid();checker uuid:=gen_random_uuid();
 people uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
 gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 area_a uuid:=gen_random_uuid();area_b uuid:=gen_random_uuid();p uuid:=gen_random_uuid();
 offer uuid;cycle_a uuid;cycle_a2 uuid;cycle_b uuid;quote_a uuid;quote_b uuid;
 recipient uuid:=gen_random_uuid();point uuid:=gen_random_uuid();order_id uuid;
 idx int;blocked boolean;nm text;v numeric;
begin
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
 select x,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'hypothetical-'||x::text||'@example.invalid',now(),now()
 from unnest(array[maker,checker]||people) x;
 insert into public.user_roles(user_id,role) values(maker,'admin'),(checker,'admin');
 insert into public.communities(id,name,slug,active) values
 (area_a,'Scenario Area A','scenario-a-'||area_a,true),
 (area_b,'Scenario Area B','scenario-b-'||area_b,true);
 for idx in 1..6 loop
  update public.profiles set community_id=case when idx=6 then area_b else area_a end,
    full_name='Scenario Customer '||idx,household_name='Hypothetical Household '||idx,
    phone='0170000000'||idx,onboarding_completed_at=now() where id=people[idx];
  if not found then raise exception 'TEST PROFILE FIXTURE MISSING customer %',idx;end if;
 end loop;
 insert into public.products(id,name,category,package_size,unit,sku,source_type,active,is_demo)
 values(p,'Scenario Butter','Dairy','1 kg','kg','CYCLE-'||p,'SUPPLIER_POOL',true,false);
 insert into public.pickup_points(id,community_id,name,address,active)
 values(point,area_a,'Scenario Gate','Hypothetical Avenue, Test Area A',true);
 insert into public.pilot_payment_recipients(id,method,account_name,account_number,active,configured_by)
 values(recipient,'bkash','Fictional Recipient','01700000000',true,maker);
 perform set_config('request.jwt.claim.sub',maker::text,true);
 offer:=public.admin_save_simple_offer_with_tiers(null,'GROUP_DEAL',array[area_a,area_b],
 'Scenario Multi-Area Deal',
 jsonb_build_array(jsonb_build_object('product_id',p,'price',160,'old_price',200,'available_quantity',100)),
 true,now()+interval '7 days',
 jsonb_build_array(
 jsonb_build_object('threshold',3,'prices',jsonb_build_array(jsonb_build_object('product_id',p,'price',150))),
 jsonb_build_object('threshold',5,'prices',jsonb_build_array(jsonb_build_object('product_id',p,'price',140)))));
 if offer is null then raise exception 'Offer creation failed';end if;
 -- Account can only join its nominated community.
 perform set_config('request.jwt.claim.sub',people[1]::text,true);
 blocked=false;
 begin perform public.join_simple_sale_group_deal_quantified(offer,p,area_b,1);
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Wrong community join accepted';end if;
 blocked=false;
 begin perform public.join_simple_sale_group_deal_quantified(offer,p,area_a,0);
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Invalid quantity accepted';end if;
 for idx in 1..2 loop
  perform set_config('request.jwt.claim.sub',people[idx]::text,true);
  perform public.join_simple_sale_group_deal_quantified(offer,p,area_a,idx);
 end loop;
 select id into cycle_a from public.simple_sale_cycles
 where offer_id=offer and community_id=area_a and status='open';
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_a)<>2 then
  raise exception 'A initial count not 2';end if;
 -- Duplicate join must not increase household count.
 perform set_config('request.jwt.claim.sub',people[2]::text,true);
 if public.join_simple_sale_group_deal_quantified(offer,p,area_a,2) then
  raise exception 'Duplicate join counted as a new household';end if;
 perform set_config('request.jwt.claim.sub',people[6]::text,true);
 perform public.join_simple_sale_group_deal_quantified(offer,p,area_b,1);
 select id into cycle_b from public.simple_sale_cycles
 where offer_id=offer and community_id=area_b and status='open';
 if cycle_b is null or cycle_b=cycle_a then raise exception 'Areas share cycle IDs';end if;
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_b)<>1 then
  raise exception 'Area B progress polluted by A';end if;
 -- A unlocks tier 1 at 3 and tier 2 at 5; only top tier closes.
 perform set_config('request.jwt.claim.sub',people[3]::text,true);
 perform public.join_simple_sale_group_deal_quantified(offer,p,area_a,1);
 if (select status from public.simple_sale_cycles where id=cycle_a)<>'open' then
  raise exception 'Closed too early at tier 1';end if;
 for idx in 4..5 loop
  perform set_config('request.jwt.claim.sub',people[idx]::text,true);
  perform public.join_simple_sale_group_deal_quantified(offer,p,area_a,1);
 end loop;
 select * into nm from (select status from public.simple_sale_cycles where id=cycle_a) x;
 if nm<>'closed' then raise exception 'Top tier did not close A';end if;
 if (select locked_threshold from public.simple_sale_cycles where id=cycle_a)<>5 then
  raise exception 'Wrong locked target';end if;
 select next_cycle_id into cycle_a2 from public.simple_sale_cycles where id=cycle_a;
 if cycle_a2 is null or cycle_a2=cycle_a then raise exception 'No new ID after A closes';end if;
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_a2)<>0 then
  raise exception 'New cycle did not restart from zero';end if;
 if (select status from public.simple_sale_cycles where id=cycle_b)<>'open'
  or (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_b)<>1
 then raise exception 'Closing A changed B';end if;
 if (select count(*) from public.simple_sale_cycle_quotes where cycle_id=cycle_a)<>5 then
  raise exception 'Expected exactly five final customer quotes';end if;
 select id into quote_a from public.simple_sale_cycle_quotes
 where cycle_id=cycle_a and customer_id=people[1];
 if (select product_total from public.simple_sale_cycle_quotes where id=quote_a)<>140 then
  raise exception 'Price not locked to five-buyer tier';end if;
 if (select quantity from public.simple_sale_cycle_quote_items where quote_id=quote_a)<>1 then
  raise exception 'Quote quantity changed';end if;
 if (select product_total from public.simple_sale_cycle_quotes
     where cycle_id=cycle_a and customer_id=people[2])<>280 then
  raise exception 'Two-unit quote incorrect';end if;
 -- A delayed retry of the previous 4-argument join must NOT silently join the new cycle.
 perform set_config('request.jwt.claim.sub',people[5]::text,true);
 blocked=false;
 begin perform public.join_simple_sale_group_deal_quantified(offer,p,area_a,1);
 exception when others then blocked=true;end;
 if not blocked or (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_a2)<>0
 then raise exception 'Stale retry polluted a new cycle';end if;
 -- A deliberate rejoin must explicitly select the fresh community cycle UUID.
 perform set_config('request.jwt.claim.sub',people[1]::text,true);
 perform public.join_simple_sale_group_deal_quantified(offer,p,area_a,1,cycle_a2);
 if (select count(*) from public.simple_sale_cycle_members where cycle_id=cycle_a2)<>1 then
  raise exception 'New community cycle missing new commitment';end if;
 if (select product_total from public.simple_sale_cycle_quotes where id=quote_a)<>140 then
  raise exception 'Old price changed on rejoin';end if;
 -- Quote after closure: home address / pickup choice, staff fee, explicit consent.
 blocked=false;
 begin perform public.customer_decide_simple_sale_quote(quote_a,'accept','Scenario Buyer',
   '01700000000',true);exception when others then blocked=true;end;
 if not blocked then raise exception 'Customer accepted without delivery fee';end if;
 perform public.customer_set_simple_sale_quote_delivery(quote_a,'pickup',point,null);
 perform set_config('request.jwt.claim.sub',maker::text,true);
 perform public.admin_quote_simple_sale_delivery(quote_a,20);
 perform set_config('request.jwt.claim.sub',people[1]::text,true);
 blocked=false;
 begin perform public.customer_decide_simple_sale_quote(quote_a,'accept',
  'Scenario Buyer','01700000000',false);exception when others then blocked=true;end;
 if not blocked then raise exception 'Consent terms bypassed';end if;
 perform public.customer_decide_simple_sale_quote(quote_a,'accept',
  'Scenario Buyer','01700000000',true);
 blocked=false;
 begin perform public.customer_decide_simple_sale_quote(quote_a,'accept',
  'Scenario Buyer','01700000000',true);exception when others then blocked=true;end;
 if not blocked then raise exception 'Duplicate price acceptance accepted';end if;
 blocked=false;
 begin perform public.customer_submit_simple_sale_payment(quote_a,recipient,'bad');
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Invalid transfer reference accepted';end if;
 perform public.customer_submit_simple_sale_payment(quote_a,recipient,'SCENARIO-001');
 perform set_config('request.jwt.claim.sub',maker::text,true);
 blocked=false;
 begin perform public.admin_verify_simple_sale_payment(quote_a);
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Quote maker verified own transfer';end if;
 perform set_config('request.jwt.claim.sub',checker::text,true);
 order_id:=public.admin_verify_simple_sale_payment(quote_a);
 if order_id is null then raise exception 'No confirmed order after independent verification';end if;
 if public.admin_verify_simple_sale_payment(quote_a)<>order_id then
  raise exception 'Repeated verification duplicated order';end if;
 if (select count(*) from public.launch_orders where id=order_id)<>1 then
  raise exception 'Order not unique';end if;
 if (select total_amount from public.launch_orders where id=order_id)<>160 then
  raise exception 'Incorrect product + delivery total';end if;
 if (select available_quantity from public.launch_product_stock where product_id=p)<>99 then
  raise exception 'Shared-stock decrement not exactly once';end if;
 -- A different customer cannot reuse an already verified payment reference.
 perform set_config('request.jwt.claim.sub',people[2]::text,true);
 select id into quote_b from public.simple_sale_cycle_quotes
  where cycle_id=cycle_a and customer_id=people[2];
 blocked=false;
 begin perform public.admin_quote_simple_sale_delivery(quote_b,-1);
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Ordinary customer issued own delivery quote';end if;
 perform public.customer_set_simple_sale_quote_delivery(quote_b,'home_delivery',null,
   'Synthetic Home, Road Four, Area A');
 perform set_config('request.jwt.claim.sub',maker::text,true);
 blocked=false;
 begin perform public.admin_quote_simple_sale_delivery(quote_b,-1);
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Negative delivery charge accepted';end if;
 perform public.admin_quote_simple_sale_delivery(quote_b,35);
 perform set_config('request.jwt.claim.sub',people[2]::text,true);
 perform public.customer_decide_simple_sale_quote(quote_b,'accept','Scenario Buyer Two',
  '01700000002',true);
 blocked=false;
 begin perform public.customer_set_simple_sale_quote_delivery(quote_b,'pickup',point,null);
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Post-acceptance delivery tampered';end if;
 blocked=false;
 begin perform public.customer_submit_simple_sale_payment(quote_b,recipient,'SCENARIO-001');
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Verified transfer reference reused by another customer';end if;
 perform public.customer_submit_simple_sale_payment(quote_b,recipient,'SCENARIO-002');
 blocked=false;
 begin perform public.customer_decide_simple_sale_quote(quote_b,'cancel');
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Paid-looking transfer canceled without review';end if;
 -- Simulate a supplier stock failure between payment submission and verification.
 update public.launch_product_stock set available_quantity=0 where product_id=p;
 perform set_config('request.jwt.claim.sub',checker::text,true);
 blocked=false;
 begin perform public.admin_verify_simple_sale_payment(quote_b);
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Created unfulfillable order despite stock shortage';end if;
 if (select status from public.simple_sale_cycle_quotes where id=quote_b)<>'payment_submitted'
  or (select order_id from public.simple_sale_cycle_quotes where id=quote_b) is not null
 then raise exception 'Stock shortage corrupted pending payment';end if;
 update public.launch_product_stock set available_quantity=99 where product_id=p;
 if public.admin_verify_simple_sale_payment(quote_b) is null then
  raise exception 'Valid verification failed after stock restored';end if;
 if (select available_quantity from public.launch_product_stock where product_id=p)<>97 then
  raise exception 'Two unit stock decrement incorrect';end if;
 -- Expired B cannot affect A. B below first target gets base-price quote.
 perform private.close_simple_sale_cycle_impl(cycle_b,true);
 if (select locked_threshold from public.simple_sale_cycles where id=cycle_b)<>0 then
  raise exception 'B did not stay below first tier';end if;
 select id into quote_b from public.simple_sale_cycle_quotes
  where cycle_id=cycle_b and customer_id=people[6];
 if (select product_total from public.simple_sale_cycle_quotes where id=quote_b)<>160 then
  raise exception 'Unmet tier must present starting price, not unlocked price';end if;
 perform set_config('request.jwt.claim.sub',people[6]::text,true);
 perform public.customer_decide_simple_sale_quote(quote_b,'cancel',null,null,false);
 if (select status from public.simple_sale_cycle_quotes where id=quote_b)<>'cancelled' then
  raise exception 'Missed-target customer cancellation failed';end if;
 if (select count(*) from public.launch_orders where customer_id=people[6])<>0 then
  raise exception 'Missed-target cancellation created an order';end if;
 -- Nobody else may accept someone else's quote.
 perform set_config('request.jwt.claim.sub',people[2]::text,true);
 blocked=false;
 begin perform public.customer_decide_simple_sale_quote(quote_a,'cancel');
 exception when others then blocked=true;end;
 if not blocked then raise exception 'Cross-account quote modified';end if;
 -- Even real customer must not have direct table-write permission.
 if has_table_privilege('authenticated','public.simple_sale_cycle_quotes','UPDATE')
 then raise exception 'Direct quote writes exposed';end if;
 raise notice 'PASS: six fictional customers, two community cycles, target 3/5, new ID, immutable price, delivery, consent, payment, idempotency, expired B cancellation, no cross-account actions';
end $tests$;
select ok(true,'All fictional community cycle and payment exceptions passed');
select * from finish();
rollback;
