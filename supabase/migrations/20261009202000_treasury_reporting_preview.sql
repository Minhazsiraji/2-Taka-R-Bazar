-- Read-only management treasury analytics. IAS 7 certification remains blocked until
-- customer receipts, procurement AP/COGS, banking, cash in transit and card classification reconcile.
create or replace function public.treasury_dashboard(p_today date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_today date:=coalesce(p_today,(now() at time zone 'Asia/Dhaka')::date);
 v_cash numeric;v_restricted numeric;v_liquid numeric;v_cards numeric;v_card_credit numeric;
 v_debt numeric;v_reserve numeric;v_due numeric;v_forecast_in numeric;v_pending numeric;v_statement_unmatched int;
 v_result jsonb;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 select coalesce(sum(bal),0),coalesce(sum(least(bal,restricted_amount)),0)
 into v_cash,v_restricted
 from (
  select a.restricted_amount,private.treasury_account_balance(a.id) bal
  from public.treasury_accounts a where a.account_kind<>'credit_card'
 ) x;
 v_liquid=v_cash-v_restricted;
 select coalesce(sum(private.treasury_account_balance(id)),0),
        coalesce(sum(greatest(0,credit_limit-private.treasury_account_balance(id))),0)
 into v_cards,v_card_credit from public.treasury_accounts where account_kind='credit_card';
 select coalesce(sum(private.treasury_facility_balance(id)),0) into v_debt
 from public.treasury_facilities;
 select minimum_operating_reserve into v_reserve from public.treasury_reserve_policy where singleton;
 select coalesce(sum(-expected_cash_change),0) into v_due from public.treasury_forecast_events
 where status='open' and confidence='contractual' and expected_cash_change<0 and due_date between v_today and v_today+13;
 select coalesce(sum(expected_cash_change),0) into v_forecast_in from public.treasury_forecast_events
 where status='open' and confidence='contractual' and expected_cash_change>0 and due_date between v_today and v_today+13;
 select coalesce(sum(amount+interest_amount+fee_amount),0) into v_pending from public.treasury_transactions where status='pending';
 select count(*) into v_statement_unmatched from public.treasury_statement_lines where matched_transaction_id is null;
 select jsonb_build_object(
 'cash_total',v_cash,
 'restricted_cash',v_restricted,
 'unrestricted_cash',v_liquid,
 'minimum_reserve',coalesce(v_reserve,0),
 'contractual_outflows_14d',v_due,
 'contractual_inflows_14d',v_forecast_in,
 'deployable_cash',greatest(0,v_liquid-coalesce(v_reserve,0)-v_due),
 'card_outstanding',v_cards,
 'card_unused_limit',v_card_credit,
 'loan_and_private_borrowing_outstanding',v_debt,
 'total_financing_liabilities',v_cards+v_debt,
 'pending_treasury_requests',v_pending,
 'unmatched_statement_lines',v_statement_unmatched,
 'accounts',coalesce((select jsonb_agg(jsonb_build_object(
    'id',a.id,'name',a.name,'kind',a.account_kind,'institution',a.institution,'last_four',a.last_four,
    'balance',private.treasury_account_balance(a.id),
    'restricted',a.restricted_amount,
    'credit_limit',a.credit_limit,
    'active',a.active) order by a.account_kind,a.name)
    from public.treasury_accounts a),'[]'::jsonb),
 'facilities',coalesce((select jsonb_agg(jsonb_build_object(
   'id',d.id,'lender',d.lender,'kind',d.facility_kind,
   'outstanding',private.treasury_facility_balance(d.id),
   'original_principal',d.original_principal,'apr',d.interest_apr,
   'due_day',d.due_day,'maturity_date',d.maturity_date)
   order by d.lender) from public.treasury_facilities d),'[]'::jsonb),
 'cashflow_status','MANAGEMENT_ONLY_OPERATIONS_AND_BANK_RECONCILIATION_PENDING',
 'credit_card_cashflow_status','UNALLOCATED_PENDING_PURCHASE_CLASSIFICATION',
 'verified_bank_balance_status','REQUIRES_INDEPENDENT_STATEMENT_MATCH'
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.treasury_dashboard(date) from public,anon,authenticated;
grant execute on function public.treasury_dashboard(date) to authenticated;

create or replace function public.treasury_transaction_feed(p_limit integer default 100)
returns table(
 id uuid,kind text,source_account_id uuid,target_account_id uuid,
 facility_id uuid,expense_id uuid,amount numeric,interest_amount numeric,fee_amount numeric,
 business_date date,external_reference text,memo text,status text,
 requested_by uuid,approved_by uuid,created_at timestamptz,
 journal_id uuid, matched_source boolean,matched_target boolean
) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 return query select t.id,t.kind,t.source_account_id,t.target_account_id,t.facility_id,t.expense_id,
  t.amount,t.interest_amount,t.fee_amount,t.business_date,t.external_reference,t.memo,t.status,
  t.requested_by,t.approved_by,t.created_at,t.journal_id,
  exists(select 1 from public.treasury_statement_lines s
    where s.matched_transaction_id=t.id and s.account_id=t.source_account_id),
  exists(select 1 from public.treasury_statement_lines s
    where s.matched_transaction_id=t.id and s.account_id=t.target_account_id)
 from public.treasury_transactions t order by t.created_at desc limit greatest(1,least(coalesce(p_limit,100),500));
end $$;
revoke all on function public.treasury_transaction_feed(integer) from public,anon,authenticated;
grant execute on function public.treasury_transaction_feed(integer) to authenticated;

create or replace function public.treasury_statement_feed(p_limit integer default 100)
returns table(id uuid,account_id uuid,external_line_id text,statement_date date,
 signed_amount numeric,reference text,matched_transaction_id uuid,imported_by uuid,matched_by uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 return query select s.id,s.account_id,s.external_line_id,s.statement_date,
 s.signed_amount,s.reference,s.matched_transaction_id,s.imported_by,s.matched_by
 from public.treasury_statement_lines s order by s.statement_date desc,s.imported_at desc limit greatest(1,least(coalesce(p_limit,100),500));
end $$;
revoke all on function public.treasury_statement_feed(integer) from public,anon,authenticated;
grant execute on function public.treasury_statement_feed(integer) to authenticated;

create or replace function public.treasury_forecast_feed(p_today date)
returns table(id uuid,due_date date,expected_cash_change numeric,event_kind text,confidence text,
 description text,source_reference text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 return query select e.id,e.due_date,e.expected_cash_change,e.event_kind,e.confidence,
 e.description,e.source_reference,e.status from public.treasury_forecast_events e
 where e.due_date>=coalesce(p_today,current_date)-7 and e.due_date<=coalesce(p_today,current_date)+90
 order by e.due_date limit 500;
end $$;
revoke all on function public.treasury_forecast_feed(date) from public,anon,authenticated;
grant execute on function public.treasury_forecast_feed(date) to authenticated;

-- A management cash-movement report, explicitly not a certified IAS 7 statement.
create or replace function public.treasury_cashflow_trend(p_month date)
returns table(month_start date,operating_outflow numeric,financing_inflow numeric,
 financing_outflow numeric,unallocated_card_bill numeric,other_unallocated_interest numeric,
 net_cash_movement numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 if p_month is null then raise exception 'Month required'; end if;
 return query
 select g.d::date,
  coalesce(sum(case when t.kind='expense_cash' then t.amount else 0 end),0)::numeric,
  coalesce(sum(case when t.kind in ('owner_capital','loan_draw') then t.amount else 0 end),0)::numeric,
  coalesce(sum(case when t.kind in ('owner_draw','loan_repay') then t.amount else 0 end),0)::numeric,
  coalesce(sum(case when t.kind='card_bill' then t.amount else 0 end),0)::numeric,
  coalesce(sum(case when t.kind='loan_repay' then t.interest_amount+t.fee_amount else 0 end),0)::numeric,
  coalesce(sum(case
    when t.kind in ('owner_capital','loan_draw') then t.amount
    when t.kind in ('expense_cash','owner_draw','card_bill') then -t.amount
    when t.kind='loan_repay' then -(t.amount+t.interest_amount+t.fee_amount)
    else 0 end),0)::numeric
 from generate_series(date_trunc('month',p_month::timestamp)-interval '5 months',
       date_trunc('month',p_month::timestamp), interval '1 month') g(d)
 left join public.treasury_transactions t
  on t.status='posted' and t.business_date>=g.d::date
   and t.business_date<(g.d+interval '1 month')::date
 group by g.d order by g.d;
end $$;
revoke all on function public.treasury_cashflow_trend(date) from public,anon,authenticated;
grant execute on function public.treasury_cashflow_trend(date) to authenticated;

-- Extend previous finance cash-outflow reporting with account-linked, independently approved treasury payments.
create or replace function public.finance_report(p_month date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_start date:=date_trunc('month',p_month::timestamp)::date; v_out jsonb;
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin role required'; end if;
 if p_month is null then raise exception 'Month required'; end if;
 select jsonb_build_object(
  'month',v_start,
  'posted_expenses',coalesce((select sum(l.debit-l.credit) from public.finance_journal_lines l
    join public.finance_journals j on j.id=l.journal_id
    join public.finance_accounts a on a.code=l.account_code and a.kind='expense'
    where j.posting_date>=v_start and j.posting_date<(v_start+interval '1 month')::date
     and j.source_type='expense_accrual'),0),
  'settled_cash_out',
   coalesce((select sum(l.credit) from public.finance_journal_lines l
    join public.finance_journals j on j.id=l.journal_id
    where j.source_type='expense_settlement' and l.account_code in ('1000','1010','1020')
      and j.posting_date>=v_start and j.posting_date<(v_start+interval '1 month')::date),0)
   +coalesce((select sum(t.amount) from public.treasury_transactions t
     where t.status='posted' and t.kind='expense_cash'
      and t.business_date>=v_start and t.business_date<(v_start+interval '1 month')::date),0),
  'pending_count',(select count(*) from public.finance_expenses
    where incurred_on>=v_start and incurred_on<(v_start+interval '1 month')::date and status='submitted'),
  'payment_pending_count',(select count(*) from public.finance_expenses
    where incurred_on>=v_start and incurred_on<(v_start+interval '1 month')::date and status in ('posted','settlement_requested')),
  'by_category',coalesce((select jsonb_agg(jsonb_build_object('category',cat,'amount',total) order by cat)
    from (select e.category cat,sum(e.amount) total from public.finance_expenses e
          where e.incurred_on>=v_start and e.incurred_on<(v_start+interval '1 month')::date
          and e.status in ('posted','settlement_requested','settled') group by e.category) q),'[]'::jsonb),
  'profit_status','UNAVAILABLE_UNTIL_REVENUE_COGS_RECONCILED'
 ) into v_out;
 return v_out;
end $$;
revoke all on function public.finance_report(date) from public,anon,authenticated;
grant execute on function public.finance_report(date) to authenticated;


-- Limited request metadata for operations staff. No company-wide balances, debt outstanding, or bank statements.
create or replace function public.treasury_request_options()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 return jsonb_build_object(
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',account_kind,
   'institution',institution,'last_four',last_four) order by name)
   from public.treasury_accounts where active),'[]'::jsonb),
  'facilities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'lender',lender,'kind',facility_kind)
   order by lender) from public.treasury_facilities where active),'[]'::jsonb),
  'approved_expenses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'description',description,
    'vendor',vendor_name,'amount',amount) order by created_at desc)
    from (select id,description,vendor_name,amount,created_at from public.finance_expenses
          where status='posted' order by created_at desc limit 100) e),'[]'::jsonb)
 );
end $$;
revoke all on function public.treasury_request_options() from public,anon,authenticated;
grant execute on function public.treasury_request_options() to authenticated;
