-- Issue 57: central expense trend must include physical Treasury settlements.
-- Read-only reporting fix; does not enable any financial write path.
create or replace function public.finance_expense_trend(p_month date)
returns table(month_start date,posted_expenses numeric,settled_cash_out numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_super(auth.uid()) then raise exception 'Super Admin role required'; end if;
 if p_month is null then raise exception 'Month required'; end if;
 return query
 select g.d::date,
 coalesce((select sum(l.debit-l.credit) from public.finance_journals j
   join public.finance_journal_lines l on l.journal_id=j.id
   join public.finance_accounts a on a.code=l.account_code and a.kind='expense'
   where j.posting_date>=g.d::date and j.posting_date<(g.d+interval '1 month')::date and j.source_type='expense_accrual'),0)::numeric,
 coalesce((select sum(l.credit) from public.finance_journals j
   join public.finance_journal_lines l on l.journal_id=j.id
   where j.source_type='expense_settlement' and l.account_code in ('1000','1010','1020')
     and j.posting_date>=g.d::date and j.posting_date<(g.d+interval '1 month')::date),0)::numeric
 + coalesce((select sum(t.amount) from public.treasury_transactions t
   where t.status='posted' and t.kind='expense_cash'
    and t.business_date>=g.d::date and t.business_date<(g.d+interval '1 month')::date),0)::numeric
 from generate_series(
    date_trunc('month',p_month::timestamp)-interval '5 months',
    date_trunc('month',p_month::timestamp),
    interval '1 month'
 ) g(d) order by g.d;
end $$;
revoke all on function public.finance_expense_trend(date) from public,anon,authenticated;
grant execute on function public.finance_expense_trend(date) to authenticated;
