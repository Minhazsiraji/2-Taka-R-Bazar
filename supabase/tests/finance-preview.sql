-- Finance Lane isolated database workflow UAT.
-- Executed by supabase test db in the disposable GitHub Actions Supabase stack.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

do $$ begin perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000901',true); end $$;
insert into finance_test_settlement(id)
select public.finance_request_settlement(
 (select id from finance_test_expense),
 'bank',
 'E2E-TRANSFER-2TBR-01',
 (now() at time zone 'Asia/Dhaka')::date,
 '00000000-0000-4000-8000-000000000901/payment-fixture.jpg',
 repeat('b',64)
);
select is((select count(*)::integer from public.finance_settlement_requests where id in (select id from finance_test_settlement)),1,'Bank settlement request stored once');
select throws_ok(
 'select public.finance_review_settlement('''||(select id::text from finance_test_settlement)||'''::uuid,true,'''')',
 'P0001','Payment requester may not verify payment','Payment self verification rejected'
);

do $$ begin perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000902',true); end $$;
select is(public.finance_review_settlement((select id from finance_test_settlement),true,'Bank proof verified'), 'verified','Independent settlement verification succeeds');
select is((select coalesce(sum(l.debit-l.credit),0) from public.finance_journal_lines l
 join public.finance_journals j on j.id=l.journal_id),0::numeric,'All journal lines balance after settlement');

select * from finish();
rollback;
