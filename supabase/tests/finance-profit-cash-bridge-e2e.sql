-- Profit/Cash Bridge read models are Super Admin only, fail closed, and never
-- post journals. All fixture rows are rolled back on disposable local Supabase.
begin;
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.denied(p_sql text,p_part text)
returns boolean language plpgsql as $$
begin execute p_sql; return false;
exception when others then return position(p_part in sqlerrm)>0;end $$;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values
('11111111-1111-4111-8111-111111111911','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profit-owner-qa@example.invalid',now(),now()),
('11111111-1111-4111-8111-111111111912','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profit-customer-qa@example.invalid',now(),now());
insert into public.user_roles(user_id,role) values
('11111111-1111-4111-8111-111111111911','super_admin');

select plan(14);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111912',true);
select ok(pg_temp.denied(
 $$select public.finance_profit_source(date_trunc('month',current_date)::date,null,null)$$,
 'Super Admin required'),'Customer cannot read Finance profit diagnostics');
select ok(pg_temp.denied(
 $$select public.treasury_cash_bridge_source(date_trunc('month',current_date)::date)$$,
 'Super Admin required'),'Customer cannot read company cash bridge');

select set_config('request.jwt.claim.sub','',true);
select ok(pg_temp.denied(
 $$select public.finance_profit_source(date_trunc('month',current_date)::date,null,null)$$,
 'Super Admin required'),'Anonymous cannot read Finance profit diagnostics');
select ok(pg_temp.denied(
 $$select public.treasury_cash_bridge_source(date_trunc('month',current_date)::date)$$,
 'Super Admin required'),'Anonymous cannot read Treasury cash bridge');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111911',true);
select ok(pg_temp.denied(
 $$select public.finance_profit_source(current_date,null,null)$$,
 'First day of month required'),'Only month-start dates are valid for Profit');
select ok(pg_temp.denied(
 $$select public.treasury_cash_bridge_source(current_date)$$,
 'First day of month required'),'Only month-start dates are valid for Cash Bridge');

select is((public.finance_profit_source(date_trunc('month',current_date)::date,null,null)->'lines'), '[]'::jsonb,
 'New empty database has no invented customer product revenue');
select is((public.finance_profit_source(date_trunc('month',current_date)::date,null,null)->>'journalSalesPosted'),'false',
 'Unposted sales must be labeled not certified');
select is((public.finance_profit_source(date_trunc('month',current_date)::date,null,null)->>'taxRate'),null::text,
 'No false Bangladesh corporate tax rate is synthesized');

select is((public.treasury_cash_bridge_source(date_trunc('month',current_date)::date)->>'closingCash')::numeric,0::numeric,
 'Empty ledger means actual closing physical cash zero');

create temporary table profit_qa_account(id uuid);
insert into profit_qa_account(id)
select public.treasury_create_account('QA Profit Bank','bank','Example Bank','9411',
 (now() at time zone 'Asia/Dhaka')::date,1000,'SYNTHETIC-OPEN-1',0,null);
select ok((select id is not null from profit_qa_account),'Treasury synthetic opening journal posted');

select is((public.treasury_cash_bridge_source(date_trunc('month',current_date)::date)->>'closingCash')::numeric,1000::numeric,
 'Read model reads physical book ledger opening but not credit card limits');
select is((public.treasury_cash_bridge_source(date_trunc('month',current_date)::date)->>'grossBankDebits')::numeric,1000::numeric,
 'Opening physical cash journal is a debit this month');
select is((public.treasury_cash_bridge_source(date_trunc('month',current_date)::date)->>'internalTransfers')::numeric,0::numeric,
 'Internal transfers do not invent external cash inflows');

select * from finish();
rollback;
