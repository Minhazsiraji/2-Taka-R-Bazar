-- Include supplier invoices, community COD and open payables in management liquidity; not yet an IAS 7-certified statement.
create or replace function public.treasury_dashboard(p_today date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_today date:=coalesce(p_today,(now() at time zone 'Asia/Dhaka')::date);
 v_cash numeric;v_restricted numeric;v_liquid numeric;v_cards numeric;v_card_credit numeric;
 v_debt numeric;v_reserve numeric;v_due numeric;v_forecast_in numeric;v_pending numeric;v_statement_unmatched int;
 v_result jsonb;v_open_supplier_ap numeric;v_open_expense_ap numeric;v_cod_suspense numeric;
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
 select coalesce(sum(credit-debit),0) into v_open_supplier_ap from public.finance_journal_lines where account_code='2100';
 select coalesce(sum(credit-debit),0) into v_open_expense_ap from public.finance_journal_lines where account_code='2000';
 select coalesce(sum(credit-debit),0) into v_cod_suspense from public.finance_journal_lines where account_code in ('2210','2211');
 select jsonb_build_object(
 'cash_total',v_cash,
 'restricted_cash',v_restricted,
 'unrestricted_cash',v_liquid,
 'minimum_reserve',coalesce(v_reserve,0),
 'contractual_outflows_14d',v_due,
 'contractual_inflows_14d',v_forecast_in,
 'deployable_cash',greatest(0,v_liquid-coalesce(v_reserve,0)-v_due-greatest(0,v_open_supplier_ap)-greatest(0,v_open_expense_ap)),
 'open_supplier_payables',greatest(0,v_open_supplier_ap),
 'open_expense_payables',greatest(0,v_open_expense_ap),
 'unapplied_cod_collections',greatest(0,v_cod_suspense),
 'deployable_cash_status','PROVISIONAL_PENDING_DUPLICATE_COMMITMENT_AND_DEBT_SCHEDULE_RECONCILIATION',
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


drop function if exists public.treasury_cashflow_trend(date);
create or replace function public.treasury_cashflow_trend(p_month date)
returns table(month_start date,operating_outflow numeric,financing_inflow numeric,
 financing_outflow numeric,unallocated_card_bill numeric,other_unallocated_interest numeric,
 net_cash_movement numeric,operating_inflow numeric)
language plpgsql stable security definer set search_path='' as $fn$
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin required'; end if;
 if p_month is null then raise exception 'Month required'; end if;
 return query
 select g.d::date,
  coalesce(a.operating_cash_out,0)::numeric,
  coalesce(a.financing_cash_in,0)::numeric,
  coalesce(a.financing_cash_out,0)::numeric,
  coalesce(a.card_payment,0)::numeric,
  coalesce(a.finance_cost_paid,0)::numeric,
  (coalesce(a.net,0)+coalesce(c.received,0))::numeric,
  coalesce(c.received,0)::numeric
 from generate_series(date_trunc('month',p_month::timestamp)-interval '5 months',
         date_trunc('month',p_month::timestamp),interval '1 month') g(d)
 left join lateral (
   select
    coalesce(sum(case when t.kind in ('expense_cash','supplier_payment') then t.amount else 0 end),0) operating_cash_out,
    coalesce(sum(case when t.kind in ('owner_capital','loan_draw') then t.amount else 0 end),0) financing_cash_in,
    coalesce(sum(case when t.kind in ('owner_draw','loan_repay') then t.amount else 0 end),0) financing_cash_out,
    coalesce(sum(case when t.kind='card_bill' then t.amount else 0 end),0) card_payment,
    coalesce(sum(case when t.kind='loan_repay' then t.interest_amount+t.fee_amount else 0 end),0) finance_cost_paid,
    coalesce(sum(case
      when t.kind in ('owner_capital','loan_draw') then t.amount
      when t.kind in ('expense_cash','supplier_payment','owner_draw','card_bill') then -t.amount
      when t.kind='loan_repay' then -(t.amount+t.interest_amount+t.fee_amount)
      else 0 end),0) net
   from public.treasury_transactions t
   where t.status='posted' and t.business_date>=g.d::date and
         t.business_date<(g.d+interval '1 month')::date
 ) a on true
 left join lateral (
   select coalesce(sum(r.product_cash+r.delivery_cash),0) received
   from public.treasury_community_cash_receipts r
   join public.finance_journals j on j.id=r.journal_id
   where j.posting_date>=g.d::date and j.posting_date<(g.d+interval '1 month')::date
 ) c on true
 order by g.d;
end $fn$;
revoke all on function public.treasury_cashflow_trend(date) from public,anon,authenticated;
grant execute on function public.treasury_cashflow_trend(date) to authenticated;
