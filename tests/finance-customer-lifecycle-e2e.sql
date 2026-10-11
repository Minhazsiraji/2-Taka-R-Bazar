insert into private.finance_uat_entities(entity_type,entity_id,reason) values
 ('order','f5000000-0000-4000-8000-000000000001','Disposable synthetic Pool customer source'),
 ('order','f5000000-0000-4000-8000-000000000002','Disposable synthetic Direct Product customer source'),
 ('group_commitment','f7200000-0000-4000-8000-000000000001','Disposable synthetic Group Deal customer source');
-- Included inside the supply transaction after inventory, AP, COD custody tests.
-- Every customer source is synthetic; all journal constraints execute before rollback.
insert into public.orders(id,customer_id,pool_id,status,payment_status,product_subtotal,delivery_fee,total_amount,fulfillment_method,delivery_address,delivery_actual_cost,completed_at)
values('f5000000-0000-4000-8000-000000000001','f0000000-0000-0000-0000-000000000001','f1000000-0000-4000-8000-000000000001','completed','cash_on_pickup',1960,30,1990,'home_delivery','Synthetic delivery address',15,now());
insert into public.order_items(id,order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price)
values('f6000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','22222222-2222-2222-2222-222222222221',2,1000,980);
insert into public.community_ops_day_orders(day_id,order_id,payment_mode,state,outcome,expected_product_cash,expected_delivery_cash,product_cash_received,delivery_cash_received,actual_delivery_cost)
values('f4000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','cod','completed','home_delivered',1960,30,1960,30,15);
insert into storage.objects(bucket_id,name) values
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-pool-sale.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-pool-return.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-pool-refund.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-group-sale.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-group-receipt.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/direct-supplier-invoice.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-direct-sale.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-direct-receipt.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-direct-return.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/customer-direct-refund.pdf');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'pool_sale',public.finance_request_customer_sale('order','f5000000-0000-4000-8000-000000000001',
 jsonb_build_array(jsonb_build_object('line_id','f6000000-0000-4000-8000-000000000001','bill_id',(select v from e2e_state where k='supplier_bill'),'quantity',2)),
 'Completed synthetic Pool customer delivery with actual courier cost',
 'a0000000-0000-0000-0000-000000000001/customer-pool-sale.pdf',repeat('3',64))::text;
select pg_temp.expect_error(format('select public.finance_request_customer_sale(%L,%L::uuid,%L::jsonb,%L,%L,%L)',
 'order','f5000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('line_id','f6000000-0000-4000-8000-000000000001','bill_id',(select v from e2e_state where k='supplier_bill'),'quantity',1)),
 'Attempt to under allocate actual completed customer source','a0000000-0000-0000-0000-000000000001/customer-pool-refund.pdf',repeat('4',64)),'allocated exactly');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.finance_review_customer_sale((select v::uuid from e2e_state where k='pool_sale'),true,'Completed delivery, invoice lot and actual courier cost checked')='posted','Pool sale failed');
select pg_temp.assert_true(private.finance_customer_balance((select v::uuid from e2e_state where k='pool_sale'),'1100')=1990,'Pool AR must include separate 30 delivery charge');
select pg_temp.assert_true((select sum(credit-debit) from public.finance_journal_lines where account_code='4000')=1960,'Pool actual earned product revenue incorrect');
select pg_temp.assert_true((select sum(debit-credit) from public.finance_journal_lines where account_code='5000')=1900,'Pool COGS must use exactly two invoice cost units');
select pg_temp.assert_true((select sum(debit-credit) from public.finance_journal_lines where account_code='6100')=15,'Actual courier expense missing or duplicated');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'pool_cod',public.finance_request_cod_allocation((select v::uuid from e2e_state where k='pool_sale'),'f4000000-0000-4000-8000-000000000001')::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.finance_review_cod_allocation((select v::uuid from e2e_state where k='pool_cod'),true,'Order COD linked to accepted physical custody')='posted','Pool COD allocation failed');
select pg_temp.assert_true(private.finance_customer_balance((select v::uuid from e2e_state where k='pool_sale'),'1100')=0,'COD did not settle customer AR');
select pg_temp.assert_true((select sum(credit-debit) from public.finance_journal_lines where account_code='2210')=40,'Unallocated product custody must retain its 40 suspense balance');
select pg_temp.assert_true(private.treasury_account_balance((select v::uuid from e2e_state where k='cash_acct'))=2030,'COD allocation incorrectly debited cash again');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'pool_credit',public.finance_request_customer_credit((select v::uuid from e2e_state where k='pool_sale'),
 '[{"line_index":1,"quantity":1}]',0,true,current_date,'One returned customer unit with original credit proof',
 'a0000000-0000-0000-0000-000000000001/customer-pool-return.pdf',repeat('4',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.finance_review_customer_credit((select v::uuid from e2e_state where k='pool_credit'),true,'Physical returned unit and credit entitlement checked')='posted','Pool credit failed');
select pg_temp.assert_true(private.finance_customer_balance((select v::uuid from e2e_state where k='pool_sale'),'2300')=980,'Paid customer credit should create exact refund payable');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'pool_refund',public.finance_request_customer_cash((select v::uuid from e2e_state where k='pool_sale'),'customer_refund',
 (select v::uuid from e2e_state where k='bank_acct'),980,current_date,'CUSTOMER-POOL-REFUND-980','a0000000-0000-0000-0000-000000000001/customer-pool-refund.pdf',repeat('5',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.treasury_review_transaction((select v::uuid from e2e_state where k='pool_refund'),true,'Independent customer bank refund checked')='posted','Pool cash refund failed');
select pg_temp.assert_true(private.finance_customer_balance((select v::uuid from e2e_state where k='pool_sale'),'2300')=0,'Refund payable must settle without expense duplication');

-- Group Deal: fulfilment captures locked sale terms independently of later price changes.
insert into public.group_deals(id,product_id,title,status,market_price_snapshot,opens_at,closes_at,pickup_at,locked_unit_price)
values('f7000000-0000-4000-8000-000000000001','22222222-2222-2222-2222-222222222221','Synthetic fulfilled group','completed',1000,now()-interval '3 days',now()-interval '2 days',now()-interval '1 day',990);
insert into public.group_circles(id,group_deal_id,community_id) values('f7100000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111');
insert into public.group_deal_commitments(id,group_deal_id,circle_id,customer_id,quantity,status)
values('f7200000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','f0000000-0000-0000-0000-000000000001',1,'fulfilled');
update public.group_deals set locked_unit_price=995 where id='f7000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select fulfilled_unit_price=990 from public.group_deal_commitments where id='f7200000-0000-4000-8000-000000000001'),'Group fulfilment price was not snapshotted');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'group_sale',public.finance_request_customer_sale('group_commitment','f7200000-0000-4000-8000-000000000001',
 jsonb_build_array(jsonb_build_object('line_id','f7200000-0000-4000-8000-000000000001','bill_id',(select v from e2e_state where k='supplier_bill'),'quantity',1)),
 'Synthetic completed Group Deal with original fulfilment proof','a0000000-0000-0000-0000-000000000001/customer-group-sale.pdf',repeat('6',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.finance_review_customer_sale((select v::uuid from e2e_state where k='group_sale'),true,'Locked original group price and delivered unit checked')='posted','Group sale failed');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'group_receipt',public.finance_request_customer_cash((select v::uuid from e2e_state where k='group_sale'),'customer_receipt',
 (select v::uuid from e2e_state where k='bank_acct'),990,current_date,'CUSTOMER-GROUP-RECEIPT-990','a0000000-0000-0000-0000-000000000001/customer-group-receipt.pdf',repeat('7',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.treasury_review_transaction((select v::uuid from e2e_state where k='group_receipt'),true,'Independent actual group bank receipt checked')='posted','Group receipt failed');

-- Direct Product: matched received stock and existing physical fulfilment controls.
update public.products set source_type='DIRECT_PRODUCT' where id='22222222-2222-2222-2222-222222222222';
insert into public.own_product_costs(product_id,purchase_cost) values('22222222-2222-2222-2222-222222222222',800);
insert into public.own_product_inventory(product_id,stock_on_hand) values('22222222-2222-2222-2222-222222222222',5);
insert into public.pools(id,community_id,title,status,created_by) values('f1000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','Synthetic direct product pool','pricing','a0000000-0000-0000-0000-000000000001');
insert into public.pool_items(id,pool_id,product_id,benchmark_price_snapshot,pricing_mode,own_fixed_price,frozen_committed_quantity)
values('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','22222222-2222-2222-2222-222222222222',1000,'FIXED_POOL_PRICE',900,5);
insert into public.supplier_quotes(id,pool_item_id,supplier_id,quote_phase,quantity,quoted_unit_price,landed_unit_price,delivery_cost,delivery_included,selected,valid_until,customer_ceiling_price)
values('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','33333333-3333-3333-3333-333333333333','final',5,800,800,0,true,true,current_date+30,950);
update public.pool_items set selected_supplier_quote_id='f3000000-0000-4000-8000-000000000002' where id='f2000000-0000-4000-8000-000000000002';
update public.pools set status='ordered' where id='f1000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'direct_po',public.procurement_submit_po('f3000000-0000-4000-8000-000000000002','Synthetic direct stock PO from selected final supplier quote')::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.procurement_review_po((select v::uuid from e2e_state where k='direct_po'),true,'Independent direct stock supplier purchase approved');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select public.procurement_link_dispatch((select v::uuid from e2e_state where k='direct_po'),(select v::uuid from e2e_state where k='happy_dispatch'));
insert into e2e_state select 'direct_bill',public.procurement_submit_bill((select v::uuid from e2e_state where k='direct_po'),'DIRECT-SUPPLIER-INVOICE-4000',current_date,5,800,'a0000000-0000-0000-0000-000000000001/direct-supplier-invoice.pdf',repeat('8',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.procurement_review_bill((select v::uuid from e2e_state where k='direct_bill'),true,'Actual direct stock units and invoice cost matched');
insert into public.orders(id,customer_id,pool_id,status,payment_status,product_subtotal,delivery_fee,total_amount,fulfillment_method,delivery_address,delivery_actual_cost,completed_at)
values('f5000000-0000-4000-8000-000000000002','f0000000-0000-0000-0000-000000000001','f1000000-0000-4000-8000-000000000002','completed','paid_manually',900,20,920,'home_delivery','Synthetic direct customer delivery',12,now());
insert into public.order_items(id,order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price)
values('f6000000-0000-4000-8000-000000000002','f5000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','22222222-2222-2222-2222-222222222222',1,1000,900);
select private.reserve_own_inventory('f6000000-0000-4000-8000-000000000002');
select private.fulfil_own_inventory('f6000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'direct_sale',public.finance_request_customer_sale('order','f5000000-0000-4000-8000-000000000002',
 jsonb_build_array(jsonb_build_object('line_id','f6000000-0000-4000-8000-000000000002','bill_id',(select v from e2e_state where k='direct_bill'),'quantity',1)),
 'Completed Direct Product with original actual delivery and cost proof','a0000000-0000-0000-0000-000000000001/customer-direct-sale.pdf',repeat('9',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true(public.finance_review_customer_sale((select v::uuid from e2e_state where k='direct_sale'),true,'Direct physical fulfilment, received cost layer and delivery proof checked')='posted','Direct sale failed');
select pg_temp.assert_true((select allocations->0->>'model'='direct_product' from public.finance_customer_events where id=(select v::uuid from e2e_state where k='direct_sale')),'Direct Product model lost in accounting');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'direct_receipt',public.finance_request_customer_cash((select v::uuid from e2e_state where k='direct_sale'),'customer_receipt',
 (select v::uuid from e2e_state where k='bank_acct'),920,current_date,'CUSTOMER-DIRECT-RECEIPT-920','a0000000-0000-0000-0000-000000000001/customer-direct-receipt.pdf',repeat('a',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.treasury_review_transaction((select v::uuid from e2e_state where k='direct_receipt'),true,'Independent direct customer actual bank receipt');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'direct_credit',public.finance_request_customer_credit((select v::uuid from e2e_state where k='direct_sale'),
 '[{"line_index":1,"quantity":1}]',0,true,current_date,'Direct product returned while earned delivery fee remains retained',
 'a0000000-0000-0000-0000-000000000001/customer-direct-return.pdf',repeat('b',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.finance_review_customer_credit((select v::uuid from e2e_state where k='direct_credit'),true,'Direct returned stock and separate delivery entitlement checked');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'direct_refund',public.finance_request_customer_cash((select v::uuid from e2e_state where k='direct_sale'),'customer_refund',
 (select v::uuid from e2e_state where k='bank_acct'),900,current_date,'CUSTOMER-DIRECT-REFUND-900','a0000000-0000-0000-0000-000000000001/customer-direct-refund.pdf',repeat('c',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.treasury_review_transaction((select v::uuid from e2e_state where k='direct_refund'),true,'Independent bank direct product refund checked');

select pg_temp.assert_true((select stock_on_hand=5 and fulfilled_quantity=0 from public.own_product_inventory where product_id='22222222-2222-2222-2222-222222222222'),'Direct returned physical stock not restored');
-- Independent ledger arithmetic across all three buying models and their returns.
select pg_temp.assert_true((select sum(credit-debit) from public.finance_journal_lines where account_code='4000')=1970,'Net product revenue should be 980 Pool + 990 Group + 0 returned Direct');
select pg_temp.assert_true((select sum(credit-debit) from public.finance_journal_lines where account_code='4010')=50,'Delivery income must remain separate from product sales');
select pg_temp.assert_true((select sum(debit-credit) from public.finance_journal_lines where account_code='5000')=1900,'Returned inventory COGS reversal must retain only two sold oil units');
select pg_temp.assert_true((select sum(debit-credit) from public.finance_journal_lines where account_code='6100')=27,'Only 15 Pool and 12 Direct actual delivery costs should accrue');
select pg_temp.assert_true((select sum(debit-credit) from public.finance_journal_lines where account_code='1200')=8750,'Inventory must equal five Oil at 950 + five Direct Rice at 800');
select pg_temp.assert_true((select sum(debit-credit) from public.finance_journal_lines where account_code='1100')=0,'All three customer receivables must reconcile to zero');
select pg_temp.assert_true((select sum(credit-debit) from public.finance_journal_lines where account_code='2300')=0,'All authorized cash refunds must settle exact refund payable');
select pg_temp.assert_true(private.treasury_account_balance((select v::uuid from e2e_state where k='bank_acct'))=92430,'Customer receipts and refunds changed physical bank incorrectly');
select pg_temp.assert_true((select sum(l.credit-l.debit) from public.finance_journal_lines l join public.finance_accounts a on a.code=l.account_code where a.kind in ('revenue','cogs','expense'))=93,'Synthetic recognized profit must equal 1970 + 50 - 1900 - 27 = 93');
select pg_temp.assert_true(not exists(select 1 from public.finance_journal_lines group by journal_id having sum(debit)<>sum(credit)),'Customer lifecycle produced an unbalanced journal');
set constraints all immediate;
\echo 'ALL_BUYING_MODELS_REVENUE_COGS_COD_CREDITS_REFUNDS_E2E_PASS'
select pg_temp.assert_true((public.finance_integrated_report(date_trunc('month',current_date)::date)->>'profit_before_tax')::numeric=93,'Integrated report profit differs from actual ledger');
select pg_temp.assert_true((public.finance_integrated_report(date_trunc('month',current_date)::date)->>'inventory_source')::numeric=8750,'Integrated source inventory report mismatch');
select pg_temp.assert_true((public.finance_integrated_report(date_trunc('month',current_date)::date)->>'ap_source')::numeric=4027,'Integrated independent AP report mismatch');
\echo 'INTEGRATED_SOURCE_REPORT_RECONCILIATION_PASS'
set constraints all deferred;
-- Recover a paid supplier credit in two actual cash instalments, no revenue.
insert into storage.objects(bucket_id,name) values
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/supplier-recovery-400.pdf'),
 ('finance-evidence','a0000000-0000-0000-0000-000000000001/supplier-recovery-550.pdf');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'supplier_recovery1',public.finance_request_supplier_credit_recovery((select v::uuid from e2e_state where k='supplier_paid_return'),(select v::uuid from e2e_state where k='bank_acct'),400,current_date,'SUPPLIER-RECOVERY-400','a0000000-0000-0000-0000-000000000001/supplier-recovery-400.pdf',repeat('d',64))::text;
select pg_temp.expect_error(format('select public.finance_request_supplier_credit_recovery(%L::uuid,%L::uuid,551,current_date,%L,%L,%L)',(select v from e2e_state where k='supplier_paid_return'),(select v from e2e_state where k='bank_acct'),'OVER-RECOVERY-551','a0000000-0000-0000-0000-000000000001/supplier-recovery-550.pdf',repeat('e',64)),'unreserved credit receivable');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.treasury_review_transaction((select v::uuid from e2e_state where k='supplier_recovery1'),true,'Independent actual supplier credit recovery checked');
select pg_temp.assert_true(private.finance_supplier_credit_balance((select v::uuid from e2e_state where k='supplier_paid_return'))=550,'Partial supplier credit recovery balance wrong');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
insert into e2e_state select 'supplier_recovery2',public.finance_request_supplier_credit_recovery((select v::uuid from e2e_state where k='supplier_paid_return'),(select v::uuid from e2e_state where k='bank_acct'),550,current_date,'SUPPLIER-RECOVERY-550','a0000000-0000-0000-0000-000000000001/supplier-recovery-550.pdf',repeat('e',64))::text;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select public.treasury_review_transaction((select v::uuid from e2e_state where k='supplier_recovery2'),true,'Independent final actual supplier recovery checked');
select pg_temp.assert_true(private.finance_supplier_credit_balance((select v::uuid from e2e_state where k='supplier_paid_return'))=0,'Recovered supplier credit should settle exactly');
select pg_temp.assert_true(private.treasury_account_balance((select v::uuid from e2e_state where k='bank_acct'))=93380,'Actual supplier recovered cash missing');
select pg_temp.assert_true((public.finance_integrated_report(date_trunc('month',current_date)::date)->>'profit_before_tax')::numeric=93,'Supplier recovery must not invent revenue');
set constraints all immediate;
\echo 'SUPPLIER_PARTIAL_CREDIT_RECOVERY_E2E_PASS'
