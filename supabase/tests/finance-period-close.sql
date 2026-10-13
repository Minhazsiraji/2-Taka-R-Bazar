begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
insert into auth.users(id,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000991','close-maker@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000992','close-checker@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values ('00000000-0000-4000-8000-000000000991','super_admin'),('00000000-0000-4000-8000-000000000992','super_admin');
insert into private.finance_uat_leases(actor_id,expires_at,reason) values
 ('00000000-0000-4000-8000-000000000991',clock_timestamp()+interval '1 hour','Synthetic independent period close qualification'),
 ('00000000-0000-4000-8000-000000000992',clock_timestamp()+interval '1 hour','Synthetic independent period close qualification');
create temp table close_state(k text primary key,id uuid);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000991',true);
select is((public.finance_integrated_report('2001-01-01')->>'profit_before_tax')::numeric,0::numeric,'Empty ended month has no invented profit');
select ok(public.finance_integrated_report('2001-01-01')->'profit_after_tax'='null'::jsonb,'Unknown tax is not reported as zero');
select throws_ok(format('select public.finance_request_period_close(%L::date,%L,%L)',date_trunc('month',current_date)::date,'Synthetic current month close forbidden',''),'P0001','Only ended accounting months can close','Current month cannot close');
insert into close_state select 'close',public.finance_request_period_close('2001-01-01','Synthetic fully qualified ended month','');
select is((select status from public.finance_period_close_requests where id=(select id from close_state where k='close')),'pending','Close maker cannot lock immediately');
select throws_ok(format('select public.finance_review_period_close(%L::uuid,true,%L)',(select id from close_state where k='close'),'Synthetic self approval forbidden'),'P0001','Independent maker-checker required','Close self approval denied');
select throws_ok(format('update public.finance_period_close_requests set snapshot=%L::jsonb where id=%L::uuid','{}',(select id from close_state where k='close')),'P0001','Financial attribution source is immutable','Close snapshot immutable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000992',true);
select is(public.finance_review_period_close((select id from close_state where k='close'),true,'Independent reconciled snapshot confirmed'),'locked','Independent checker locks ended month');
select is((select state from public.finance_periods where month_start='2001-01-01'),'locked','Approved close persisted');
select throws_ok($$select private.treasury_post('CLOSE-LOCK-PROBE',gen_random_uuid(),'2001-01-15','Synthetic locked period direct posting',jsonb_build_array(jsonb_build_object('account','1100','debit',1),jsonb_build_object('account','4000','credit',1)),auth.uid())$$,'P0001','Finance period is locked','Locked period denies direct journal posting');
select throws_ok(format('select public.finance_review_period_close(%L::uuid,true,%L)',(select id from close_state where k='close'),'Duplicate independent close approval'),'P0001','Close request not pending','Close replay rejected');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000991',true);
insert into close_state select 'stale',public.finance_request_period_close('2001-02-01','Synthetic stale source snapshot test','');
select private.treasury_post('CLOSE-STALE-PROBE',gen_random_uuid(),'2001-02-15','Synthetic posting after close request',jsonb_build_array(jsonb_build_object('account','1100','debit',1),jsonb_build_object('account','4000','credit',1)),auth.uid());
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000992',true);
select throws_ok(format('select public.finance_review_period_close(%L::uuid,true,%L)',(select id from close_state where k='stale'),'Changed source independent approval'),'P0001','Period sources changed; reject request and qualify a new snapshot','Source change invalidates close qualification');
select is(public.finance_review_period_close((select id from close_state where k='stale'),false,'Stale snapshot rejected for requalification'),'rejected','Stale close can be independently rejected');
select ok(not has_table_privilege('authenticated','public.finance_period_close_requests','UPDATE'),'No raw close mutation grants');
select ok((select relrowsecurity from pg_class where oid='public.finance_period_close_requests'::regclass),'Period close RLS retained');
select is((select count(*)::integer from public.audit_events where event_type='finance_period_close_approved' and entity_id=(select id from close_state where k='close')),1,'Immutable close audit recorded once');
set constraints all immediate;
select * from finish();
rollback;
