-- Aggregate-only My Money analytics for the owner command center.
-- No household identities or individual transaction rows are returned.
-- Financial totals are suppressed for cohorts smaller than 3 active families.

create or replace function public.super_admin_money_analytics(p_month date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_next_month date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date;
  v_min_families integer := 3;
  v_active_families integer := 0;
  v_expense_families integer := 0;
  v_registered_families integer := 0;
  v_money_users_lifetime integer := 0;
  v_transaction_count integer := 0;
  v_expense_transaction_count integer := 0;
  v_expense_total numeric := 0;
  v_income_total numeric := 0;
  v_budget_users integer := 0;
  v_recurring_users integer := 0;
  v_categories jsonb := '[]'::jsonb;
  v_trend jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into v_registered_families
  from public.profiles
  where onboarding_completed_at is not null;

  select count(distinct user_id) into v_money_users_lifetime
  from public.money_transactions;

  select count(distinct user_id), count(*)
    into v_active_families, v_transaction_count
  from public.money_transactions
  where transaction_date >= v_month
    and transaction_date < v_next_month;

  select count(distinct user_id), count(*), coalesce(sum(amount),0)
    into v_expense_families, v_expense_transaction_count, v_expense_total
  from public.money_transactions
  where transaction_type = 'expense'
    and transaction_date >= v_month
    and transaction_date < v_next_month;

  select coalesce(sum(amount),0) into v_income_total
  from public.money_transactions
  where transaction_type = 'income'
    and transaction_date >= v_month
    and transaction_date < v_next_month;

  select count(distinct user_id) into v_budget_users
  from public.money_budgets;

  select count(distinct user_id) into v_recurring_users
  from public.money_recurring;

  if v_active_families >= v_min_families then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', q.name,
        'icon', q.icon,
        'amount', q.amount,
        'transactions', q.transactions,
        'families', q.families,
        'share_pct', case when v_expense_total > 0 then round((q.amount / v_expense_total) * 100, 1) else 0 end
      ) order by q.amount desc
    ), '[]'::jsonb)
    into v_categories
    from (
      select c.name,
             c.icon,
             sum(t.amount)::numeric as amount,
             count(*)::integer as transactions,
             count(distinct t.user_id)::integer as families
      from public.money_transactions t
      join public.money_categories c
        on c.id = t.category_id
       and c.user_id = t.user_id
      where t.transaction_type = 'expense'
        and t.transaction_date >= v_month
        and t.transaction_date < v_next_month
      group by c.name, c.icon
      having count(distinct t.user_id) >= v_min_families
      order by sum(t.amount) desc
      limit 10
    ) q;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'month', to_char(q.month_start, 'YYYY-MM'),
      'active_families', q.active_families,
      'transaction_count', q.transaction_count,
      'expense_total', case when q.active_families >= v_min_families then q.expense_total else null end,
      'income_total', case when q.active_families >= v_min_families then q.income_total else null end,
      'privacy_limited', q.active_families < v_min_families
    ) order by q.month_start
  ), '[]'::jsonb)
  into v_trend
  from (
    select m.month_start,
           count(distinct t.user_id)::integer as active_families,
           count(t.id)::integer as transaction_count,
           coalesce(sum(t.amount) filter (where t.transaction_type='expense'),0)::numeric as expense_total,
           coalesce(sum(t.amount) filter (where t.transaction_type='income'),0)::numeric as income_total
    from (
      select generate_series(
        (v_month - interval '5 months')::date,
        v_month,
        interval '1 month'
      )::date as month_start
    ) m
    left join public.money_transactions t
      on t.transaction_date >= m.month_start
     and t.transaction_date < (m.month_start + interval '1 month')::date
    group by m.month_start
  ) q;

  return jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'privacy_min_families', v_min_families,
    'privacy_limited', v_active_families < v_min_families,
    'registered_families', v_registered_families,
    'money_users_lifetime', v_money_users_lifetime,
    'active_families', v_active_families,
    'expense_families', v_expense_families,
    'budget_users_lifetime', v_budget_users,
    'recurring_users_lifetime', v_recurring_users,
    'transaction_count', v_transaction_count,
    'expense_transaction_count', v_expense_transaction_count,
    'expense_total', case when v_active_families >= v_min_families then v_expense_total else null end,
    'income_total', case when v_active_families >= v_min_families then v_income_total else null end,
    'average_expense_per_expense_family', case
      when v_active_families >= v_min_families and v_expense_families > 0 then round(v_expense_total / v_expense_families, 2)
      else null
    end,
    'average_expense_transaction', case
      when v_active_families >= v_min_families and v_expense_transaction_count > 0 then round(v_expense_total / v_expense_transaction_count, 2)
      else null
    end,
    'top_categories', v_categories,
    'trend', v_trend
  );
end;
$$;

revoke all on function public.super_admin_money_analytics(date) from public;
revoke all on function public.super_admin_money_analytics(date) from anon;
revoke all on function public.super_admin_money_analytics(date) from authenticated;
grant execute on function public.super_admin_money_analytics(date) to authenticated;
