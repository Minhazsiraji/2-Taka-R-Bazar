-- Synthetic category and cross-layer accounting reconciliation, isolated and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.must_fail(p_sql text,p_needle text)
returns boolean language plpgsql as $$
begin execute p_sql; return false;
exception when others then return position(p_needle in sqlerrm)>0; end $$;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000921','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cost-tester@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000922','00000000-0000-0000-0000-000000000000','authenticated','authenticated','audit-checker@example.invalid',now(),now());
insert into public.user_roles(user_id,role)
values ('00000000-0000-4000-8000-000000000921','admin'),
 ('00000000-0000-4000-8000-000000000922','super_admin');

create temp table qa_cases (
 category text primary key,
 amount numeric,
 code text,
 proof text,
 expense_id uuid
);
insert into qa_cases(category,amount,code,proof)
values ('logistics',111,'6100','001'),
 ('marketing_offline',222,'6200','002'),
 ('marketing_online',333,'6210','003'),
 ('office',444,'6300','004'),
 ('infrastructure',555,'6400','005'),
 ('commissions',666,'6500','006'),
 ('miscellaneous',777,'6900','007');

insert into storage.objects(bucket_id,name)
select 'finance-evidence','00000000-0000-4000-8000-000000000921/'||c.proof||'.png'
from qa_cases c;
insert into storage.objects(bucket_id,name)
values('finance-evidence','00000000-0000-4000-8000-000000000921/receipt-pending.png'),
 ('finance-evidence','00000000-0000-4000-8000-000000000921/transfer-done.pdf');

select plan(20);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000921',true);
update qa_cases c
set expense_id=public.finance_submit_expense(
 c.category,'Synthetic expense for category '||c.category,
 'Synthetic operating vendor '||c.code,'CATEGORY-'||c.code,
 c.amount,current_date,
 '00000000-0000-4000-8000-000000000921/'||c.proof||'.png',
 repeat(c.proof,21)||left(c.proof,1),null,'AMT-01'
);
select is((select count(*)::integer from qa_cases where expense_id is not null),7,'All seven expense categories created');
select is((select count(*)::integer from public.finance_journals),0,'Submitting expenses never prematurely recognizes costs');

-- A pending expense is intentionally left unposted before period lock.
create temp table qa_pending(id uuid);
insert into qa_pending
select public.finance_submit_expense('logistics',
 'Unreviewed old expense test','Pending QA vendor','PENDING-CLOSE',
 50,current_date,'00000000-0000-4000-8000-000000000921/receipt-pending.png',repeat('d',64),null,null);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000922',true);
select is((select count(*)::integer from (
 select public.finance_review_expense(c.expense_id,true,'Receipt inspected') from qa_cases c) z),7,
 'Independent owner reviewer approves all seven categories');

select is((select count(*)::integer from public.finance_journals where source_type='expense_accrual'),7,
 'Seven expense accrual journals posted once');
select is((select count(*)::integer from public.finance_journal_lines),14,
 'Each journal has two balancing lines');
select is((select count(distinct l.account_code)::integer from public.finance_journal_lines l
  join public.finance_journals j on j.id=l.journal_id
  where j.source_type='expense_accrual' and l.debit>0),7,
 'Each expense category maps to its own chart-of-accounts code');
select is((select count(*)::integer from qa_cases c join public.finance_journals j on j.source_id=c.expense_id
  join public.finance_journal_lines l on l.journal_id=j.id and l.debit=c.amount and l.account_code=c.code),7,
 'All seven cost account classifications match posted journals');
select is((select sum(debit-credit) from public.finance_journal_lines),0::numeric,'All seven expenses have zero journal imbalance');
select is((select (public.finance_report(current_date)->>'posted_expenses')::numeric),3108::numeric,
 'The approved expense total is BDT 3108, excluding the pending draft');
select is((select jsonb_array_length(public.finance_report(current_date)->'by_category')),7,
 'Report breaks down all seven expense categories');
select is((select (public.finance_report(current_date)->>'pending_count')::integer),1,
 'Dashboard correctly identifies the unapproved expense');

-- Cash payment cannot be pre-recorded from a draft; settlement must be separately authorized.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000921',true);
select ok(pg_temp.must_fail(
 $$select public.finance_request_settlement((select id from qa_pending),'cash',
 'PENDING-NOT-PAID',current_date,'00000000-0000-4000-8000-000000000921/transfer-done.pdf',repeat('c',64))$$,
 'Expense not approved for payment'),'Unapproved invoices cannot produce cash transactions');

create temp table qa_paid(id uuid);
insert into qa_paid select public.finance_request_settlement(
 (select expense_id from qa_cases where category='logistics'),'cash','CASH-RECEIPT-PAID',current_date,
 '00000000-0000-4000-8000-000000000921/transfer-done.pdf',repeat('e',64));

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000922',true);
select is(public.finance_review_settlement((select id from qa_paid),true,'Cash accepted independently'),'verified',
 'Independent verifier records the cash settlement');
select is((select (public.finance_report(current_date)->>'settled_cash_out')::numeric),111::numeric,
 'Verified cash outflow is BDT 111, not all BDT 3108 expenses');
select is((select sum(debit-credit) from public.finance_journal_lines),0::numeric,
 'Cash settlement continues to satisfy double-entry balance');
select is((select sum(settled_cash_out) from public.finance_expense_trend(current_date)
  where month_start=date_trunc('month',current_date)::date),111::numeric,
 'Monthly trend reconciles to settlement journal');
select is((select sum(posted_expenses) from public.finance_expense_trend(current_date)
  where month_start=date_trunc('month',current_date)::date),3108::numeric,
 'Expense trend reconciles with accounting P&L');
select is((select count(*)::integer from public.finance_expense_trend(current_date)),6,
 'Six months of trend data returned including zero-spend months');

-- Lock after posting; prevent backdated cost adjustments to certified period.
insert into public.finance_periods(month_start,state,locked_by,locked_at,lock_notes)
values(date_trunc('month',current_date)::date,'locked',
 '00000000-0000-4000-8000-000000000922',now(),'QA period-lock case');
select ok(pg_temp.must_fail(
 format('select public.finance_review_expense(%L::uuid,true,%L)',(select id from qa_pending),'Attempt after close'),
 'Finance period is locked'),
 'Approval cannot backdate a journal into a locked accounting month');

select is((select (public.finance_report(current_date)->>'posted_expenses')::numeric),3108::numeric,
 'Read-only reports remain available after the close');

select * from finish();
rollback;
