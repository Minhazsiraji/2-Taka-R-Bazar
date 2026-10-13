-- Finance Lane isolated database workflow UAT.
-- Executed by supabase test db in the disposable GitHub Actions Supabase stack.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public','finance_expenses','Expense source table exists');
select has_table('public','finance_journals','Posted financial journals exist');
select has_table('public','finance_journal_lines','Posted financial journal lines exist');
select has_table('public','finance_settlement_requests','Independent settlement requests exist');
select ok((select relrowsecurity from pg_class where oid='public.finance_expenses'::regclass),'Expense source RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.finance_journals'::regclass),'Journal RLS enabled');

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000901','00000000-0000-0000-0000-000000000000','authenticated','authenticated','2tbr-fixture-maker@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000902','00000000-0000-0000-0000-000000000000','authenticated','authenticated','2tbr-fixture-checker@example.invalid',now(),now());

insert into public.user_roles(user_id,role)
values
 ('00000000-0000-4000-8000-000000000901','admin'),
 ('00000000-0000-4000-8000-000000000902','super_admin');

insert into storage.objects(bucket_id,name)
values
 ('finance-evidence','00000000-0000-4000-8000-000000000901/receipt-fixture.jpg'),
 ('finance-evidence','00000000-0000-4000-8000-000000000901/payment-fixture.jpg');

create temporary table finance_test_expense(id uuid);
create temporary table finance_test_settlement(id uuid);

-- Operator-issued leases are transaction-local synthetic fixture authorization.
insert into private.finance_uat_leases(actor_id,expires_at,reason)
 select id,clock_timestamp()+interval '1 hour','Issue 57 disposable synthetic qualification'
 from auth.users where email like '%@example.invalid' on conflict(actor_id) do nothing;
do $$ begin perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000901',true); end $$;

insert into finance_test_expense(id)
select public.finance_submit_expense(
 'marketing_offline',
 'Community QR poster print',
 'Finance fixture printer',
 'E2E-2TBR-20261009',
 1250.00,
 (now() at time zone 'Asia/Dhaka')::date,
 '00000000-0000-4000-8000-000000000901/receipt-fixture.jpg',
 repeat('a',64),
 null,
 'AMT-01'
);
select is((select count(*)::integer from public.finance_expenses where id in(select id from finance_test_expense)),1,'Expense stored once');
select throws_ok(
 'select public.finance_review_expense('''||(select id::text from finance_test_expense)||'''::uuid,true,'''')',
 'P0001','Maker may not approve their own expense','Self approval rejected'
);

do $$ begin perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000902',true); end $$;
select is(public.finance_review_expense((select id from finance_test_expense),true,'Receipt checked'), 'posted','Independent reviewer posts approved expense');
select is((select coalesce(sum(l.debit-l.credit),0) from public.finance_journal_lines l
 join public.finance_journals j on j.id=l.journal_id
 where j.source_type='expense_accrual'),0::numeric,'Expense journal debits and credits balance');
select is((select (public.finance_report((now() at time zone 'Asia/Dhaka')::date)->>'profit_status')::text),
 'UNAVAILABLE_UNTIL_REVENUE_COGS_RECONCILED','Unreconciled revenue cannot show certified net profit');

-- Once physical Treasury exists, the generic payment route must stay blocked.
create temporary table finance_test_bank(id uuid);
insert into finance_test_bank select public.treasury_create_account(
 'Issue 57 synthetic bank','bank','Synthetic bank','0057',current_date,2000,'ISSUE57-OPEN-901',0,null);
do $$ begin perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000901',true); end $$;
select throws_ok(
 'select public.finance_request_settlement('''||(select id::text from finance_test_expense)||'''::uuid,''bank'',''E2E-LEGACY-BLOCK'',current_date,''00000000-0000-4000-8000-000000000901/payment-fixture.jpg'',repeat(''b'',64))',
 'P0001','Use Treasury settlement with a specific cash account; generic finance payments are disabled',
 'Generic settlement cannot bypass physical bank accounting');
insert into finance_test_settlement select public.treasury_request_transaction(
 'expense_cash',(select id from finance_test_bank),null,null,(select id from finance_test_expense),
 1250,0,0,current_date,'E2E-TRANSFER-2TBR-01','Synthetic physical bank expense settlement');
select is((select count(*)::integer from public.treasury_transactions where id in(select id from finance_test_settlement)),1,'Treasury settlement request stored once');
select throws_ok(
 'select public.treasury_review_transaction('''||(select id::text from finance_test_settlement)||'''::uuid,true,'''')',
 'P0001','Treasury reviewer requires Super Admin','Maker cannot verify payment');
do $$ begin perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000902',true); end $$;
select is(public.treasury_review_transaction((select id from finance_test_settlement),true,'Synthetic internally reviewed payment'), 'posted','Independent settlement approval posts book movement');
select is((select coalesce(sum(l.debit-l.credit),0) from public.finance_journal_lines l
 join public.finance_journals j on j.id=l.journal_id),0::numeric,'All journal lines balance after settlement');
-- Execute deferred per-journal constraints before rolling fixtures back.
-- ROLLBACK alone would never execute deferred balance checks.
set constraints all immediate;
select * from finish();
rollback;
