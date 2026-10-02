create or replace function public.super_admin_money_family_usage(p_month date default null)
returns table(
  family_key text,
  community_name text,
  transaction_count bigint,
  expense_entries bigint,
  income_entries bigint,
  budget_count bigint,
  recurring_count bigint,
  top_category text,
  last_activity date
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_month date:=date_trunc('month',coalesce(p_month,timezone('Asia/Dhaka',now())::date))::date;
  v_next date:=(v_month+interval '1 month')::date;
begin
  if auth.uid() is null or not private.has_role(auth.uid(),'super_admin') then
    raise exception 'forbidden';
  end if;

  return query
  with tx as (
    select t.user_id,count(*)::bigint transaction_count,
      count(*) filter(where t.transaction_type='expense')::bigint expense_entries,
      count(*) filter(where t.transaction_type='income')::bigint income_entries,
      max(t.transaction_date)::date last_activity
    from public.money_transactions t
    where t.transaction_date>=v_month and t.transaction_date<v_next
    group by t.user_id
  ), budgets as (
    select b.user_id,count(*)::bigint budget_count
    from public.money_budgets b where b.month=v_month group by b.user_id
  ), recurring as (
    select r.user_id,count(*)::bigint recurring_count
    from public.money_recurring r where r.active=true group by r.user_id
  ), cats as (
    select t.user_id,c.name,row_number() over(partition by t.user_id order by count(*) desc,c.name) rn
    from public.money_transactions t
    join public.money_categories c on c.id=t.category_id and c.user_id=t.user_id
    where t.transaction_type='expense' and t.transaction_date>=v_month and t.transaction_date<v_next
    group by t.user_id,c.name
  )
  select ('F-'||upper(substr(md5(p.id::text),1,8)))::text,
    coalesce(cm.name,'Unassigned')::text,
    coalesce(tx.transaction_count,0),coalesce(tx.expense_entries,0),coalesce(tx.income_entries,0),
    coalesce(budgets.budget_count,0),coalesce(recurring.recurring_count,0),cats.name::text,tx.last_activity
  from public.profiles p
  left join public.communities cm on cm.id=p.community_id
  left join tx on tx.user_id=p.id
  left join budgets on budgets.user_id=p.id
  left join recurring on recurring.user_id=p.id
  left join cats on cats.user_id=p.id and cats.rn=1
  where p.onboarding_completed_at is not null
  order by coalesce(tx.transaction_count,0) desc,family_key;
end;
$$;

revoke all on function public.super_admin_money_family_usage(date) from public;
grant execute on function public.super_admin_money_family_usage(date) to authenticated;
