-- Transactional launch qualification. Uses existing public listings, fictional
-- customer identities, and ROLLBACK. No order, user, payment or stock persists.
begin;
do $$
declare u uuid:=gen_random_uuid();other_u uuid:=gen_random_uuid();admin_u uuid;pid uuid;stock integer;price numeric;oid uuid;oid2 uuid;k uuid:=gen_random_uuid();blocked boolean;recipient uuid;
begin
 select product_id,available_quantity,approved_unit_price into pid,stock,price from jsonb_to_recordset(public.get_public_launch_catalog(null)) as x(product_id uuid,available_quantity integer,approved_unit_price numeric) where available_quantity>=4 limit 1;
 if pid is null then raise exception 'This rollback test requires a published launch listing';end if;
 select approved_by into admin_u from public.pilot_vendor_product_listings where product_id=pid;
 insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 (u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rollback-'||u||'@example.invalid',now(),now()),
 (other_u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rollback-'||other_u||'@example.invalid',now(),now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 oid=public.launch_submit_order(jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',2,'unit_price',0.01)),k,'Fictional test customer','01700000000','Fictional rollback address','pickup',true);
 if (select subtotal from public.launch_orders where id=oid)<>price*2 then raise exception 'Client price tampering accepted';end if;
 if (select available_quantity from public.pilot_vendor_product_listings where product_id=pid)<>stock-2 then raise exception 'Reservation failed';end if;
 oid2=public.launch_submit_order(jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',2,'unit_price',0.01)),k,'Fictional test customer','01700000000','Fictional rollback address','pickup',true);
 if oid<>oid2 or (select available_quantity from public.pilot_vendor_product_listings where product_id=pid)<>stock-2 then raise exception 'Duplicate checkout consumed inventory';end if;
 blocked=false;
 begin perform public.launch_submit_order(jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',101)),gen_random_uuid(),'Fictional test customer','01700000000','Fictional rollback address','pickup',true);exception when others then blocked=true;end;
 if not blocked then raise exception 'Over-capacity order accepted';end if;
 if public.launch_payment_options(oid)<>'[]'::jsonb then raise exception 'Payment instructions leaked before order approval';end if;
 execute 'set local role authenticated';
 if (select count(*) from public.launch_orders where id=oid)<>1 then raise exception 'Owner cannot read order';end if;
 perform set_config('request.jwt.claim.sub',other_u::text,true);
 if (select count(*) from public.launch_orders where id=oid)<>0 or (select count(*) from public.launch_order_items where order_id=oid)<>0 then raise exception 'Another customer can read order';end if;
 blocked=false;begin perform public.launch_review_order(oid,'confirm',0,'');exception when others then blocked=true;end;
 if not blocked then raise exception 'Customer can approve order';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',admin_u::text,true);
 perform public.launch_review_order(oid,'confirm',30,'Rollback test');
 perform set_config('request.jwt.claim.sub',u::text,true);
 if (select total_amount from public.launch_orders where id=oid)<>price*2+30 then raise exception 'Incorrect server total';end if;
 select id into recipient from public.pilot_payment_recipients where active limit 1;
 if recipient is not null then
  perform public.launch_submit_payment(oid,recipient,'ROLLBACK-'||substr(u::text,1,8));
  if (select payment_status from public.launch_orders where id=oid)<>'submitted' then raise exception 'Claim was auto-verified';end if;
 end if;
 oid2=public.launch_submit_order(jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',1)),gen_random_uuid(),'Fictional test customer','01700000000','Fictional rollback address','pickup',true);
 perform set_config('request.jwt.claim.sub',admin_u::text,true);
 perform public.launch_review_order(oid2,'cancel',0,'Rollback cancellation');
 if (select available_quantity from public.pilot_vendor_product_listings where product_id=pid)<>stock-2 then raise exception 'Cancellation did not restore exactly one reservation';end if;
 if has_table_privilege('authenticated','public.launch_orders','insert') or has_function_privilege('anon','public.launch_submit_order(jsonb,uuid,text,text,text,text,boolean)','execute') then raise exception 'Unexpected public write grant';end if;
end $$;
select 'PASS: authoritative prices, stock reservation, idempotency, capacity, RLS ownership, staff approval, manual payment claim, cancellation and grants' as launch_qualification;
rollback;
