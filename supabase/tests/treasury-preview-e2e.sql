-- 2TBR Treasury controlled end-to-end synthetic QA, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.expect_failure(p_stmt text,p_pattern text)
returns boolean language plpgsql as $$
begin execute p_stmt; return false;
exception when others then return position(p_pattern in sqlerrm)>0; end $$;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000951','00000000-0000-0000-0000-000000000000','authenticated','authenticated','treasury-owner-qa@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000952','00000000-0000-0000-0000-000000000000','authenticated','authenticated','treasury-maker-qa@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000953','00000000-0000-0000-0000-000000000000','authenticated','authenticated','treasury-customer-qa@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000000951','super_admin'),
 ('00000000-0000-4000-8000-000000000952','admin');

create temp table qa_accounts(label text primary key,id uuid not null);
create temp table qa_debts(label text primary key,id uuid not null);
create temp table qa_tx(label text primary key,id uuid not null);
create temp table qa_expenses(label text primary key,id uuid not null);
create temp table qa_statements(label text primary key,id uuid not null);

select plan(53);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000953',true);
select ok(pg_temp.expect_failure(
 $$select public.treasury_create_account('Illegal','bank','Fake','1234',current_date,100,'FAKE-0001',0,null)$$,
 'Super Admin required'),'Customer cannot create physical company cash accounts');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
insert into qa_accounts(label,id) values
 ('A',public.treasury_create_account('Operating Bank A','bank','Bank A','1234',current_date,100000,'OPEN-A-0001',0,null)),
 ('B',public.treasury_create_account('Procurement Bank B','bank','Bank B','5678',current_date,50000,'OPEN-B-0001',0,null)),
 ('C',public.treasury_create_account('Reserve Bank C','bank','Bank C','9876',current_date,0,'OPEN-C-0001',0,null)),
 ('cash',public.treasury_create_account('Office petty cash','cash','Office','',current_date,20000,'OPEN-CASH-0001',0,null)),
 ('wallet',public.treasury_create_account('bKash wallet','wallet','bKash','1478',current_date,10000,'OPEN-WALLET-001',0,null)),
 ('card',public.treasury_create_account('Corporate credit card','credit_card','Test bank','4455',current_date,5000,'OPEN-CARD-0001',0,30000));
insert into qa_debts(label,id) values
 ('loan',public.treasury_create_facility('Test Business Bank','bank_loan',100000,30000,11.50,15,current_date+365,current_date,'BUSINESS-LOAN-01')),
 ('private',public.treasury_create_facility('Business acquaintance','private_borrowing',15000,8000,0,null,current_date+90,current_date,'SIGNED-BORROW-01'));

select is((select count(*)::integer from qa_accounts),6,'6 distinct company accounts created');
select is((select count(*)::integer from qa_debts),2,'Bank loan and private borrowing tracked separately');
select is((select (public.treasury_dashboard(current_date)->>'cash_total')::numeric),180000::numeric,'Opening cash totals BDT 180000');
select is((select (public.treasury_dashboard(current_date)->>'card_outstanding')::numeric),5000::numeric,'Credit card liability is NOT treated as cash');
select is((select (public.treasury_dashboard(current_date)->>'loan_and_private_borrowing_outstanding')::numeric),38000::numeric,
 'Old loan plus private borrowing is debt, not revenue');
select is((select sum(l.debit-l.credit) from public.finance_journal_lines l),0::numeric,'Every opening journal balances');
select is((select count(*)::integer from public.finance_journals where source_type='treasury_opening'),7,
 'Seven nonzero opening journals are separately classified');
select ok(pg_temp.expect_failure(
 $$select public.treasury_create_account('Invalid card','credit_card','Example','3333',current_date,10000,'OPEN-INVALID',0,5000)$$,
 'violates check constraint'),'Card opening outstanding cannot exceed credit limit');

insert into storage.objects(bucket_id,name) values
 ('finance-evidence','00000000-0000-4000-8000-000000000952/office-expense.pdf'),
 ('finance-evidence','00000000-0000-4000-8000-000000000952/qr-expense.pdf');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000952',true);
insert into qa_expenses(label,id)
values ('card',public.finance_submit_expense('office','Synthetic office supplies for card',
 'QA stationers','QA-CARD-EXP-01',3000,current_date,
 '00000000-0000-4000-8000-000000000952/office-expense.pdf',repeat('b',64),null,null)),
 ('cash',public.finance_submit_expense('marketing_offline','QR print expense paid by bank',
 'QA printer','QA-QR-EXP-01',1200,current_date,
 '00000000-0000-4000-8000-000000000952/qr-expense.pdf',repeat('c',64),null,'AMT-01'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
select is(public.finance_review_expense((select id from qa_expenses where label='card'),true,'Source PDF validated'),'posted','Card purchase expense independently approved before charge');
select is(public.finance_review_expense((select id from qa_expenses where label='cash'),true,'Vendor evidence inspected'),'posted','Cash-settled marketing expense first accrued');
select is((select (public.finance_report(current_date)->>'posted_expenses')::numeric),4200::numeric,
 'Posted operating expenses equal BDT 4200 before any settlement');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000952',true);
insert into qa_tx(label,id) values
 ('transfer',public.treasury_request_transaction('transfer',
    (select id from qa_accounts where label='A'),(select id from qa_accounts where label='B'),null,null,
    10000,0,0,current_date,'BANK-TRANSFER-T01','Transfer procurement float')),
 ('draw',public.treasury_request_transaction('loan_draw',
    null,(select id from qa_accounts where label='A'),(select id from qa_debts where label='loan'),null,
    25000,0,0,current_date,'LOAN-DRAW-25000','Received additional business loan tranche')),
 ('repay',public.treasury_request_transaction('loan_repay',
    (select id from qa_accounts where label='A'),null,(select id from qa_debts where label='loan'),null,
    10000,500,100,current_date,'LOAN-REPAY-10000','Repaid loan principal interest and bank fees')),
 ('card_bill',public.treasury_request_transaction('card_bill',
    (select id from qa_accounts where label='A'),(select id from qa_accounts where label='card'),null,null,
    2000,0,0,current_date,'CARD-BILL-2000','Corporate card statement payment')),
 ('card_expense',public.treasury_request_transaction('expense_card',
    null,(select id from qa_accounts where label='card'),null,(select id from qa_expenses where label='card'),
    3000,0,0,current_date,'CARD-CHARGE-3000','Office supplier credit card purchase')),
 ('cash_expense',public.treasury_request_transaction('expense_cash',
    (select id from qa_accounts where label='A'),null,null,(select id from qa_expenses where label='cash'),
    1200,0,0,current_date,'BANK-QR-EXP-1200','Printer payment by bank transfer')),
 ('draw_owner',public.treasury_request_transaction('owner_draw',
    (select id from qa_accounts where label='B'),null,null,null,
    3000,0,0,current_date,'OWNER-DRAW-3000','Owner withdrawal against cash reserves')),
 ('cap_owner',public.treasury_request_transaction('owner_capital',
    null,(select id from qa_accounts where label='C'),null,null,
    5000,0,0,current_date,'OWNER-CAP-5000','Owner increased working capital fund'));
select is((select count(*)::integer from qa_tx),8,'All eight distinct treasury transaction types submitted');
select is((select (public.treasury_dashboard(current_date)->>'cash_total')::numeric),180000::numeric,
 'Pending transfers and repayments NEVER affect available posted cash');
select ok(pg_temp.expect_failure(
 format('select public.treasury_review_transaction(%L::uuid,true,%L)',(select id from qa_tx where label='transfer'),'Approve own request'),
 'Treasury reviewer requires Super Admin'),'Ordinary maker cannot approve even their own transaction');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
select is(public.treasury_review_transaction((select id from qa_tx where label='transfer'),true,'Approved transfer'),'posted','Transfer approved and posted');
select is((select (public.treasury_dashboard(current_date)->>'cash_total')::numeric),180000::numeric,'Internal bank transfer causes zero company-wide cash flow');
select is(public.treasury_review_transaction((select id from qa_tx where label='draw'),true,'Loan document checked'),'posted','Loan disbursement posts cash and loan liability');
select is(public.treasury_review_transaction((select id from qa_tx where label='repay'),true,'Loan schedule checked'),'posted','Loan installment splits principal interest and fees');
select is(public.treasury_review_transaction((select id from qa_tx where label='card_bill'),true,'Statement due verified'),'posted','Card bill lowers card payable, not expense');
select is(public.treasury_review_transaction((select id from qa_tx where label='card_expense'),true,'Reviewed card purchase'),'posted','Card purchase closes approved operating payable without cash movement');
select is(public.treasury_review_transaction((select id from qa_tx where label='cash_expense'),true,'Paid approved printing invoice'),'posted','Bank-funded marketing expense reduces cash and clears payable');
select is(public.treasury_review_transaction((select id from qa_tx where label='draw_owner'),true,'Approved owner drawing'),'posted','Owner withdrawal never creates operating cost');
select is(public.treasury_review_transaction((select id from qa_tx where label='cap_owner'),true,'Capital agreement approved'),'posted','Owner contribution is financing, not revenue');

select is((select (public.treasury_dashboard(current_date)->>'cash_total')::numeric),193200::numeric,
 'Cash across 3 banks, wallet and petty cash reconciles to BDT 193200');
select is((select (public.treasury_dashboard(current_date)->>'card_outstanding')::numeric),6000::numeric,
 'Card liability moves 5000 - 2000 + 3000 = 6000');
select is((select (public.treasury_dashboard(current_date)->>'loan_and_private_borrowing_outstanding')::numeric),53000::numeric,
 'Bank debt 45000 plus private borrowing 8000 = 53000');
select is((select (public.treasury_dashboard(current_date)->>'total_financing_liabilities')::numeric),59000::numeric,
 'Total card + business borrowing liabilities = BDT 59000');
select is((select (public.finance_report(current_date)->>'posted_expenses')::numeric),4200::numeric,
 'Paying card and bank does not duplicate expense on accrual P&L');
select is((select (public.finance_report(current_date)->>'settled_cash_out')::numeric),1200::numeric,
 'Account-linked bank settlement included in central Finance expense cash-out report');
select is((select (public.treasury_dashboard(current_date)->>'card_unused_limit')::numeric),24000::numeric,
 'Unused card credit remains separate from company cash');
select is((select sum(l.debit-l.credit) from public.finance_journal_lines l),0::numeric,
 'Full accounting ledger remains balanced across cash, loans, card and expenses');
select is((select coalesce(sum(amount),0) from public.treasury_transactions where status='posted' and kind='owner_capital'),
 5000::numeric,'Owner funding is present only in financing records');

select is((select sum(net_cash_movement) from public.treasury_cashflow_trend(current_date)
  where month_start=date_trunc('month',current_date)::date),13200::numeric,
 'Cash-flow net movement equals ending cash less opening cash');
select is((select sum(operating_outflow) from public.treasury_cashflow_trend(current_date)
  where month_start=date_trunc('month',current_date)::date),1200::numeric,'Cash-paid operating expense separate from credit card charge');
select is((select sum(unallocated_card_bill) from public.treasury_cashflow_trend(current_date)
  where month_start=date_trunc('month',current_date)::date),2000::numeric,
 'Card bill intentionally marked unallocated pending accounting policy');
select is((select sum(other_unallocated_interest) from public.treasury_cashflow_trend(current_date)
  where month_start=date_trunc('month',current_date)::date),600::numeric,
 'Interest and fees flagged separately from loan principal');
select ok(pg_temp.expect_failure(
 format('select public.treasury_review_transaction(%L::uuid,true,%L)',(select id from qa_tx where label='transfer'),'replay'),
 'Treasury request not pending'),'Replayed approval cannot post duplicated journal');
select ok(pg_temp.expect_failure(
 $$select public.treasury_request_transaction('expense_cash',
    (select id from qa_accounts where label='A'),null,null,(select id from qa_expenses where label='cash'),
    1200,0,0,current_date,'DOUBLE-EXP-1200','Attempt to pay already paid expense')$$,
 'Only fully approved, unpaid expense'),'Duplicate payment of an approved expense is blocked');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000952',true);
select ok(pg_temp.expect_failure(
 $$select public.treasury_request_transaction('transfer',
    (select id from qa_accounts where label='A'),(select id from qa_accounts where label='B'),null,null,
    10000,0,0,current_date,' BANK-TRANSFER-T01 ','Same duplicate transfer reference again')$$,
 'treasury_reference_active'),'Duplicate bank transfer reference blocked before approval');
select ok(pg_temp.expect_failure(
 $$select public.treasury_request_transaction('transfer',
    (select id from qa_accounts where label='A'),(select id from qa_accounts where label='A'),null,null,
    10000,0,0,current_date,'SAME-ACCOUNT-TRANSFER','Invalid self transfer detection')$$,
 'source_account_id'),'Self-transfer cannot create false cash flow');
insert into qa_tx(label,id)
select 'overdraft',public.treasury_request_transaction('transfer',
    (select id from qa_accounts where label='A'),(select id from qa_accounts where label='B'),null,null,
    9999999,0,0,current_date,'OVERDRAFT-TEST-01','Cannot overdraw bank beyond balance');
insert into qa_tx(label,id)
select 'excess_debt',public.treasury_request_transaction('loan_repay',
    (select id from qa_accounts where label='A'),null,(select id from qa_debts where label='private'),null,
    9000,0,0,current_date,'LOAN-OVERPAY-001','Cannot pay more principal than remaining');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
select ok(pg_temp.expect_failure(
 format('select public.treasury_review_transaction(%L::uuid,true,%L)',(select id from qa_tx where label='overdraft'),'overdraw'),
 'Insufficient unrestricted cash'),'Negative balance prevented at approval time');
select ok(pg_temp.expect_failure(
 format('select public.treasury_review_transaction(%L::uuid,true,%L)',(select id from qa_tx where label='excess_debt'),'overpay'),
 'Loan principal payment exceeds'),'Loan overpayment blocked against posted outstanding debt');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000952',true);
insert into qa_statements(label,id) values
 ('transfer_out',public.treasury_import_statement_line((select id from qa_accounts where label='A'),
 'STATEMENT-A-REF-01',current_date,-10000,'BANK-TRANSFER-T01')),
 ('transfer_in',public.treasury_import_statement_line((select id from qa_accounts where label='B'),
 'STATEMENT-B-REF-01',current_date,10000,'BANK-TRANSFER-T01')),
 ('incorrect',public.treasury_import_statement_line((select id from qa_accounts where label='A'),
 'STATEMENT-A-REF-02',current_date,-9999,'BANK-TRANSFER-T01'));
select ok(pg_temp.expect_failure(
 $$select public.treasury_import_statement_line((select id from qa_accounts where label='A'),
 'STATEMENT-A-REF-01',current_date,-10000,'BANK-TRANSFER-T01')$$,
 'treasury_statement_lines_account_id_external_line_id_key'),'Duplicate bank statement import rejected');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
select ok(pg_temp.expect_failure(
 format('select public.treasury_match_statement(%L::uuid,%L::uuid)',
  (select id from qa_statements where label='incorrect'),(select id from qa_tx where label='transfer')),
 'Statement amount does not match'),'Wrong bank amount cannot silently reconcile');
select is(public.treasury_match_statement(
 (select id from qa_statements where label='transfer_out'),(select id from qa_tx where label='transfer'),null),
 'matched','Independent bank reviewer matched outbound transfer');
select is(public.treasury_match_statement(
 (select id from qa_statements where label='transfer_in'),(select id from qa_tx where label='transfer'),null),
 'matched','Inbound transfer reconciled separately on destination bank');
select is((select count(*)::integer from public.treasury_statement_lines where matched_transaction_id is not null),
 2,'Both transfer account legs matched, incorrect extra line remains unresolved');
select is((select (public.treasury_dashboard(current_date)->>'unmatched_statement_lines')::integer),1,
 'Dashboard flags suspicious unmatched bank statement line');

select public.treasury_set_minimum_reserve(100000);
select is((select (public.treasury_dashboard(current_date)->>'minimum_reserve')::numeric),100000::numeric,
 'Treasury operating liquidity reserve policy updated by owner');
select public.treasury_create_forecast(current_date+7,-20000,'supplier_payment','Supplier purchase order due','SUPPLIER-FORECAST-20K','contractual');
select is((select (public.treasury_dashboard(current_date)->>'deployable_cash')::numeric),73200::numeric,
 'Deployable cash excludes minimum reserve plus contractual supplier obligation');

insert into public.finance_periods(month_start,state,locked_by,locked_at,lock_notes)
values(date_trunc('month',current_date)::date,'locked',
 '00000000-0000-4000-8000-000000000951',now(),'Treasury synthetic month-end lock');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000952',true);
select ok(pg_temp.expect_failure(
 $$select public.treasury_request_transaction('transfer',
    (select id from qa_accounts where label='A'),(select id from qa_accounts where label='C'),null,null,
    500,0,0,current_date,'LOCKED-MONTH-001','Attempt backdated account transfer')$$,
 'Finance period is locked'),'No financial cash movements posted into closed period');
select is((select sum(l.debit-l.credit) from public.finance_journal_lines l),0::numeric,
 'Month-end final treasury and business journals remain exactly balanced');
select * from finish();
rollback;
