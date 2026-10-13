begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
insert into auth.users(id,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000981','budget-maker@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000982','budget-checker@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-000000000981','admin'),('00000000-0000-4000-8000-000000000982','super_admin');
insert into private.finance_uat_leases(actor_id,expires_at,reason) values
 ('00000000-0000-4000-8000-000000000981',clock_timestamp()+interval '1 hour','Synthetic budget and attribution qualification'),
 ('00000000-0000-4000-8000-000000000982',clock_timestamp()+interval '1 hour','Synthetic budget and attribution qualification');
insert into storage.objects(bucket_id,name) values
 ('finance-evidence','00000000-0000-4000-8000-000000000981/budget1.pdf'),
 ('finance-evidence','00000000-0000-4000-8000-000000000981/budget2.pdf');
create temp table budget_state(k text primary key,id uuid);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000981',true);
insert into budget_state select 'budget1',public.finance_request_campaign_budget('BUDGET-UAT-100',date_trunc('month',current_date)::date,'offline',100,'Synthetic offline marketing monthly plan');
select is((select status from public.finance_campaign_budgets where id=(select id from budget_state where k='budget1')),'pending','Maker budget remains unapproved');
insert into budget_state select 'expense1',public.finance_submit_expense('marketing_offline','Synthetic poster printing','Budget UAT printer','BUDGET-EXP-75',75,current_date,'00000000-0000-4000-8000-000000000981/budget1.pdf',repeat('1',64),null,null);
insert into budget_state select 'expense2',public.finance_submit_expense('marketing_offline','Synthetic leaflet printing','Budget UAT printer','BUDGET-EXP-50',50,current_date,'00000000-0000-4000-8000-000000000981/budget2.pdf',repeat('2',64),null,null);
select throws_ok(format('select public.finance_request_expense_attribution(%L::uuid,%L::jsonb,%L)',
 (select id from budget_state where k='expense1'),jsonb_build_array(jsonb_build_object('amount',75,'cost_center','marketing','budget_id',(select id from budget_state where k='budget1'))),'Synthetic allocation before expense approval'),
 'P0001','Approved expense required','Unapproved expense cannot be attributed');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000982',true);
select is(public.finance_review_campaign_budget((select id from budget_state where k='budget1'),true,'Independent campaign plan checked'),'approved','Independent budget approval');
select public.finance_review_expense((select id from budget_state where k='expense1'),true,'Original synthetic poster invoice checked');
select public.finance_review_expense((select id from budget_state where k='expense2'),true,'Original synthetic leaflet invoice checked');
insert into budget_state select 'selfbudget',public.finance_request_campaign_budget('BUDGET-SELF-TEST',date_trunc('month',current_date)::date,'google',100,'Synthetic independent reviewer qualification');
select throws_ok(format('select public.finance_review_campaign_budget(%L::uuid,true,%L)',(select id from budget_state where k='selfbudget'),'Self approval must be rejected'),'P0001','Independent maker-checker required','Budget maker cannot self approve');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000981',true);
select throws_ok(format('select public.finance_request_expense_attribution(%L::uuid,%L::jsonb,%L)',
 (select id from budget_state where k='expense1'),jsonb_build_array(jsonb_build_object('amount',74,'cost_center','marketing','budget_id',(select id from budget_state where k='budget1'))),'Synthetic invalid total allocation'),'P0001','Allocation total must exactly equal source expense','No allocation rounding loss');
insert into budget_state select 'allocation1',public.finance_request_expense_attribution((select id from budget_state where k='expense1'),
 jsonb_build_array(jsonb_build_object('amount',75,'cost_center','marketing','budget_id',(select id from budget_state where k='budget1'))),'Full poster expense attributed to campaign');
select throws_ok(format('select public.finance_request_expense_attribution(%L::uuid,%L::jsonb,%L)',
 (select id from budget_state where k='expense2'),jsonb_build_array(jsonb_build_object('amount',50,'cost_center','marketing','budget_id',(select id from budget_state where k='budget1'))),'Synthetic budget over-allocation attempt'),
 'P0001','Campaign budget exceeded including pending reservations','Pending allocations reserve campaign budget');
insert into budget_state select 'budget2',public.finance_request_campaign_budget('BUDGET-UAT-50',date_trunc('month',current_date)::date,'offline',50,'Additional independently authorized offline campaign');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000982',true);
select is(public.finance_review_expense_attribution((select id from budget_state where k='allocation1'),true,'Exact source and campaign allocation checked'),'approved','Independent attribution approval');
select public.finance_review_campaign_budget((select id from budget_state where k='budget2'),true,'Independent additional campaign budget approved');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000981',true);
insert into budget_state select 'allocation2',public.finance_request_expense_attribution((select id from budget_state where k='expense2'),
 jsonb_build_array(jsonb_build_object('amount',25,'cost_center','marketing','budget_id',(select id from budget_state where k='budget1')),
 jsonb_build_object('amount',25,'cost_center','marketing','budget_id',(select id from budget_state where k='budget2'))),'Leaflet expense split between two authorized campaigns');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000982',true);
select is(public.finance_review_expense_attribution((select id from budget_state where k='allocation2'),true,'Exact split and remaining campaign budget checked'),'approved','Split expense approved without over-allocation');
select is((select sum((r->>'amount')::numeric) from public.finance_expense_attributions a cross join lateral jsonb_array_elements(a.allocations) r where a.id in(select id from budget_state where k like 'allocation%')),125::numeric,'Allocated amounts equal both source accruals exactly');
select is((select count(*)::integer from public.finance_journals where source_id in(select id from budget_state where k like 'expense%')),2,'Attribution does not post expense twice');
select is((select sum(l.debit-l.credit) from public.finance_journal_lines l join public.finance_journals j on j.id=l.journal_id where j.source_id in(select id from budget_state where k like 'expense%')),0::numeric,'Attribution preserves balanced accruals');
select throws_ok(format('update public.finance_expense_attributions set allocations=%L::jsonb where id=%L::uuid','[]',(select id from budget_state where k='allocation1')),'P0001','Financial attribution source is immutable','Approved attribution cannot be rewritten');
select ok(not has_table_privilege('authenticated','public.finance_campaign_budgets','UPDATE'),'No direct campaign mutation grants');
select ok((select relrowsecurity from pg_class where oid='public.finance_expense_attributions'::regclass),'Expense attribution RLS denies raw access');
set constraints all immediate;
select * from finish();
rollback;
