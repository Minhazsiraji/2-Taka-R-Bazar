-- Savings qualification: all fixtures live only inside disposable GitHub CI PostgreSQL.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011002',false);
do $$
declare v jsonb:=public.store_home_savings();
begin
 if (v->>'lifetime')::numeric<>0 then
  raise exception 'Unpaid Group Deal or undiscounted completed order counted as savings: %',v;
 end if;
 if v->>'community'<>'null' and v->'community'<>'null'::jsonb then
  raise exception 'Unverified community attribution exposed savings';
 end if;
end $$;
reset role;

insert into auth.users(id) values('00000000-0000-4000-8000-000000011004');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011004',false);
do $$
declare v uuid;
begin
 select public.store_place_order(
  '[{"product_id":"00000000-0000-4000-8000-000000011011","quantity":1}]'::jsonb,
  '00000000-0000-4000-8000-000000011013','pickup',null,
  'Second Household','01700000004',
  '00000000-0000-4000-8000-000000011204') into v;
 perform set_config('v2.savings_second',v::text,false);
 if (public.store_home_savings()->>'lifetime')::numeric<>0 then
  raise exception 'Placed order incorrectly counted';
 end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011001',false);
do $$
declare v uuid;
begin
 foreach v in array array[current_setting('v2.test_group')::uuid,current_setting('v2.savings_second')::uuid] loop
  perform public.store_staff_order_status(v,'confirmed');
  perform public.store_staff_order_status(v,'preparing');
  perform public.store_staff_order_status(v,'ready_for_pickup');
  perform public.store_mark_payment_collected(v,'cash','SAVINGS-SMOKE');
  perform public.store_staff_order_status(v,'handed_over');
  perform public.store_verify_payment(v);
  perform public.store_staff_order_status(v,'completed');
 end loop;
end $$;
reset role;

-- Stock's current reference price must never affect a completed line's snapshot.
update public.store_products set regular_price=2000 where sku='V2-GHEE-1KG';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011002',false);
do $$
declare v jsonb:=public.store_home_savings();
begin
 if (v->>'lifetime')::numeric<>150 or (v->>'this_month')::numeric<>150 then
  raise exception 'Original 150-taka snapshot not preserved: %',v;
 end if;
 if (v->>'previous_month')::numeric<>0 then raise exception 'Wrong previous month';end if;
 if v->'community'<>'null'::jsonb then raise exception 'Unverified community saving leaked';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011004',false);
do $$
begin
 if (public.store_home_savings()->>'lifetime')::numeric<>150
 then raise exception 'Second customer calculation incorrect';end if;
end $$;
reset role;

-- Simulates a fully returned line recorded by future audited refund workflow.
update public.store_order_items set refunded_quantity=1
 where order_id=current_setting('v2.test_group')::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000011002',false);
do $$
begin
 if (public.store_home_savings()->>'lifetime')::numeric<>0
 then raise exception 'Refunded quantity double-counted in lifetime savings';end if;
end $$;
reset role;
set role anon;
do $$
begin
 if has_function_privilege('anon','public.store_home_savings()','EXECUTE')
 then raise exception 'Anonymous customer savings RPC exposed';end if;
end $$;
reset role;
select 'PASS: verified completion, historical reference, unpaid and refunded exclusion, scoped monthly and lifetime totals' as result;
