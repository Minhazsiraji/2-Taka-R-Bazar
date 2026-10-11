begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users(id,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000971','write-lock-owner@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values('00000000-0000-4000-8000-000000000971','super_admin');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000971',true);
select throws_ok($test$select public.treasury_create_account('Denied synthetic bank','bank','Synthetic','0057',current_date,100,'LOCK-TEST-01',0,null)$test$,
 '42501','Financial writes locked: operator-issued UAT lease required','Direct owner RPC denied without operator lease');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000971","finance_writes_enabled":true,"vercel_env":"preview","role":"authenticated"}',true);
select throws_ok($test$select public.treasury_create_account('Denied synthetic bank','bank','Synthetic','0057',current_date,100,'LOCK-TEST-02',0,null)$test$,
 '42501','Financial writes locked: operator-issued UAT lease required','Caller claims cannot unlock the database');
select throws_ok($test$insert into public.finance_periods(month_start,state) values(date '2020-01-01','open')$test$,
 '42501','Financial writes locked: operator-issued UAT lease required','Row trigger protects direct writes too');
select set_config('request.jwt.claim.sub','',true);
insert into private.finance_uat_leases(actor_id,expires_at,reason)
 values('00000000-0000-4000-8000-000000000971',clock_timestamp()+interval '1 hour','Synthetic leased financial write qualification');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000971',true);
select lives_ok($test$select public.treasury_create_account('Leased synthetic bank','bank','Synthetic','0057',current_date,100,'LOCK-TEST-03',0,null)$test$,'Operator lease permits otherwise authorized UAT RPC');
select is((select count(*)::integer from public.treasury_accounts where name='Leased synthetic bank'),1,'Exactly one leased account was recorded');
select set_config('request.jwt.claim.sub','',true);
update private.finance_uat_leases set issued_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000971',true);
select throws_ok($test$select public.treasury_create_account('Expired synthetic bank','bank','Synthetic','0057',current_date,100,'LOCK-TEST-04',0,null)$test$,
 '42501','Financial writes locked: operator-issued UAT lease required','Expired lease fails closed');
select ok(not has_table_privilege('authenticated','private.finance_uat_leases','INSERT'),'Authenticated cannot issue leases');
select ok(not has_table_privilege('service_role','private.finance_uat_leases','INSERT'),'API service role cannot issue leases');
select ok(not has_function_privilege('authenticated','private.finance_assert_write_allowed()','EXECUTE'),'Private gate cannot be called through public API');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and (c.relname like 'finance\_%' escape '\' or c.relname like 'treasury\_%' escape '\'
 or c.relname in ('procurement_purchase_orders','procurement_dispatch_links','procurement_supplier_bills'))
 and not exists(select 1 from pg_trigger t where t.tgrelid=c.oid and t.tgname='finance_database_write_lock')),0,'Every financial source table has a write gate');
select ok(not exists(select 1 from public.treasury_accounts where name in ('Denied synthetic bank','Expired synthetic bank')),'Denied RPCs leave no source records');
select is((select coalesce(sum(l.debit-l.credit),0) from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id where j.posted_by='00000000-0000-4000-8000-000000000971'),0::numeric,'Permitted opening remains balanced');
set constraints all immediate;
select * from finish();
rollback;
