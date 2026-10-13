-- Included only by commerce-finance-uat.mjs inside the rolled-back supply fixture.
update private.commerce_configuration set preview_secret_hash=encode(extensions.digest('synthetic-disposable-commerce-proof-64','sha256'),'hex');
update public.profiles set community_id='11111111-1111-1111-1111-111111111111',onboarding_completed_at=now() where id='f0000000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name) values
('commerce-evidence','a0000000-0000-0000-0000-000000000001/commerce-handover.pdf'),
('finance-evidence','a0000000-0000-0000-0000-000000000001/commerce-sale.pdf'),
('finance-evidence','a0000000-0000-0000-0000-000000000001/commerce-receipt.pdf'),
('finance-evidence','a0000000-0000-0000-0000-000000000001/commerce-credit.pdf'),
('finance-evidence','a0000000-0000-0000-0000-000000000001/commerce-refund.pdf');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('commerce_offer',public.commerce_request_offer((select id from public.commerce_skus where product_id='22222222-2222-2222-2222-222222222222'),'11111111-1111-1111-1111-111111111111','SOLO',null,null,null,900,now()+interval '1 day',true,true,60,'synthetic-disposable-commerce-proof-64')::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.commerce_review_offer((select v::uuid from e2e_state where k='commerce_offer'),true,'Independent actual synthetic stocked offer review','synthetic-disposable-commerce-proof-64');
select set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000001',true);
select public.commerce_set_cart_item(null,(select v::uuid from e2e_state where k='commerce_offer'),1,'synthetic-disposable-commerce-proof-64');
insert into e2e_state values('commerce_quote',public.commerce_create_quote(null,'home_delivery',null,'Synthetic full verified community address','synthetic-disposable-commerce-proof-64')->>'id');
insert into e2e_state values('commerce_order',public.commerce_confirm_checkout((select v::uuid from e2e_state where k='commerce_quote'),'c0640000-0000-4000-8000-000000000001','2026-10-05','synthetic-disposable-commerce-proof-64')->>0);
select pg_temp.assert_true((select total_amount=920 and payment_status='unpaid' from public.commerce_orders where id=(select v::uuid from e2e_state where k='commerce_order')),'Canonical checkout created false payment or wrong delivery fee');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.commerce_fulfill((select v::uuid from e2e_state where k='commerce_order'),'prepare','Synthetic warehouse preparation checked',null,null,null,null,'synthetic-disposable-commerce-proof-64');
select public.commerce_fulfill((select v::uuid from e2e_state where k='commerce_order'),'dispatch','Synthetic home delivery dispatched',null,null,null,null,'synthetic-disposable-commerce-proof-64');
select public.commerce_fulfill((select v::uuid from e2e_state where k='commerce_order'),'complete','Synthetic customer physical handover checked','QA-COMMERCE-HANDOVER','a0000000-0000-0000-0000-000000000001/commerce-handover.pdf',encode(extensions.digest('commerce-handover','sha256'),'hex'),12,'synthetic-disposable-commerce-proof-64');
select public.commerce_record_cod((select v::uuid from e2e_state where k='commerce_order'),900,20,'QA-COMMERCE-COD','a0000000-0000-0000-0000-000000000001/commerce-handover.pdf',encode(extensions.digest('commerce-handover','sha256'),'hex'),'synthetic-disposable-commerce-proof-64');
select pg_temp.assert_true((select payment_status='custody_recorded' from public.commerce_orders where id=(select v::uuid from e2e_state where k='commerce_order')),'COD custody incorrectly marked verified');
select pg_temp.assert_true(not exists(select 1 from public.finance_customer_events where source_kind='commerce_order'),'Operational fulfillment must not post Finance');
select set_config('request.jwt.claim.sub','',true);
insert into private.finance_uat_entities(entity_type,entity_id,reason) values('commerce_order',(select v::uuid from e2e_state where k='commerce_order'),'Disposable canonical commerce source allowlist');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('commerce_sale',public.finance_request_customer_sale('commerce_order',(select v::uuid from e2e_state where k='commerce_order'),jsonb_build_array(jsonb_build_object('line_id',(select id from public.commerce_order_items where order_id=(select v::uuid from e2e_state where k='commerce_order')),'bill_id',(select v from e2e_state where k='direct_bill'),'quantity',1)),'Canonical fulfilled source matched to actual received invoice lot','a0000000-0000-0000-0000-000000000001/commerce-sale.pdf',encode(extensions.digest('commerce-sale','sha256'),'hex'))::text);
select pg_temp.expect_error(format('select public.finance_review_customer_sale(%L::uuid,true,%L)',(select v from e2e_state where k='commerce_sale'),'Self approval must fail'),'Independent');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.finance_review_customer_sale((select v::uuid from e2e_state where k='commerce_sale'),true,'Actual canonical fulfillment and cost lot independently reviewed');
select pg_temp.assert_true(private.finance_customer_balance((select v::uuid from e2e_state where k='commerce_sale'),'1100')=920,'Canonical customer receivable incorrect');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('commerce_cash',public.finance_request_customer_cash((select v::uuid from e2e_state where k='commerce_sale'),'customer_receipt',(select v::uuid from e2e_state where k='bank_acct'),920,current_date,'QA-COMMERCE-COD-DEPOSIT','a0000000-0000-0000-0000-000000000001/commerce-receipt.pdf',encode(extensions.digest('commerce-receipt','sha256'),'hex'))::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.treasury_review_transaction((select v::uuid from e2e_state where k='commerce_cash'),true,'Actual canonical COD deposit original independently verified');
select pg_temp.assert_true((select payment_status='verified' from public.commerce_orders where id=(select v::uuid from e2e_state where k='commerce_order')),'Independent Treasury posting did not verify order payment');
select set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('commerce_return',public.commerce_request((select v::uuid from e2e_state where k='commerce_order'),'return','Synthetic canonical customer return request','synthetic-disposable-commerce-proof-64')::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.commerce_review_request((select v::uuid from e2e_state where k='commerce_return'),true,'Independent physical return entitlement checked','synthetic-disposable-commerce-proof-64');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.commerce_receive_return((select v::uuid from e2e_state where k='commerce_return'),jsonb_build_array(jsonb_build_object('line_id',(select id from public.commerce_order_items where order_id=(select v::uuid from e2e_state where k='commerce_order')),'quantity',1)),true,'a0000000-0000-0000-0000-000000000001/commerce-handover.pdf',encode(extensions.digest('commerce-handover','sha256'),'hex'),'synthetic-disposable-commerce-proof-64');
insert into e2e_state values('commerce_credit',public.finance_request_customer_credit((select v::uuid from e2e_state where k='commerce_sale'),'[{"line_index":1,"quantity":1}]',20,true,current_date,'Received canonical customer return and original credit proof','a0000000-0000-0000-0000-000000000001/commerce-credit.pdf',encode(extensions.digest('commerce-credit','sha256'),'hex'))::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.finance_review_customer_credit((select v::uuid from e2e_state where k='commerce_credit'),true,'Physical received canonical return independently verified');
select pg_temp.assert_true((select returned_quantity=1 from public.commerce_order_items where order_id=(select v::uuid from e2e_state where k='commerce_order')),'Canonical physical return was not restocked exactly once');
select pg_temp.assert_true(private.finance_customer_balance((select v::uuid from e2e_state where k='commerce_sale'),'2300')=920,'Paid canonical return must create exact refund payable');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state values('commerce_refund',public.finance_request_customer_cash((select v::uuid from e2e_state where k='commerce_sale'),'customer_refund',(select v::uuid from e2e_state where k='bank_acct'),920,current_date,'QA-COMMERCE-REFUND','a0000000-0000-0000-0000-000000000001/commerce-refund.pdf',encode(extensions.digest('commerce-refund','sha256'),'hex'))::text);
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.treasury_review_transaction((select v::uuid from e2e_state where k='commerce_refund'),true,'Independent canonical refund original verified');
select pg_temp.assert_true((select payment_status='refunded' from public.commerce_orders where id=(select v::uuid from e2e_state where k='commerce_order')),'Canonical refund state must follow actual Treasury payment');
select pg_temp.assert_true(private.finance_customer_balance((select v::uuid from e2e_state where k='commerce_sale'),'2300')=0,'Canonical refund payable did not settle');
select pg_temp.assert_true(not exists(select 1 from public.finance_journal_lines group by journal_id having sum(debit)<>sum(credit)),'Canonical Finance bridge produced unbalanced journals');
select set_config('request.jwt.claim.sub','',true);
delete from private.finance_uat_leases where actor_id='a0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select pg_temp.expect_error(format('select public.finance_request_customer_cash(%L::uuid,%L,%L::uuid,1,current_date,%L,%L,%L)',(select v from e2e_state where k='commerce_sale'),'customer_refund',(select v from e2e_state where k='bank_acct'),'QA-NO-LEASE','a0000000-0000-0000-0000-000000000001/commerce-refund.pdf',repeat('e',64)),'operator-issued UAT lease');
\echo 'UNIFIED_COMMERCE_FINANCE_COD_RETURN_REFUND_E2E_PASS'
