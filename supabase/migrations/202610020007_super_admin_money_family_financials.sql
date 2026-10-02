create or replace function public.super_admin_money_family_financials(p_month date default null)
returns table(
  family_key text,
  family_label text,
  community_name text,
  income_total numeric,
  expense_total numeric,
  savings_total numeric,
  transaction_count bigint,
  top_categories jsonb,
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
  with family_index as (
    select p.id,
      ('F-'||upper(substr(md5(p.id::text),1,8)))::text as family_key,
      ('Family '||lpad(row_number() over(order by p.id::text)::text,3,'0'))::text as family_label,
      coalesce(cm.name,'Unassigned')::text as community_name
    from public.profiles p
    left join public.communities cm on cm.id=p.community_id
    where p.onboarding_completed_at is not null
  ), tx as (
    select t.user_id,
      coalesce(sum(t.amount) filter(where t.transaction_type='income'),0)::numeric as income_total,
      coalesce(sum(t.amount) filter(where t.transaction_type='expense'),0)::numeric as expense_total,
      count(*)::bigint as transaction_count,
      max(t.transaction_date)::date as last_activity
    from public.money_transactions t
    where t.transaction_date>=v_month and t.transaction_date<v_next
    group by t.user_id
  ), category_totals as (
    select t.user_id,c.name,
      sum(t.amount)::numeric as amount,
      count(*)::bigint as entries,
      row_number() over(partition by t.user_id order by sum(t.amount) desc,c.name) as rn
    from public.money_transactions t
    join public.money_categories c on c.id=t.category_id and c.user_id=t.user_id
    where t.transaction_type='expense'
      and t.transaction_date>=v_month and t.transaction_date<v_next
    group by t.user_id,c.name
  ), top5 as (
    select ct.user_id,
      jsonb_agg(
        jsonb_build_object('name',ct.name,'amount',ct.amount,'entries',ct.entries)
        order by ct.rn
      ) as top_categories
    from category_totals ct
    where ct.rn<=5
    group by ct.user_id
  )
  select fi.family_key,fi.family_label,fi.community_name,
    coalesce(tx.income_total,0)::numeric,
    coalesce(tx.expense_total,0)::numeric,
    (coalesce(tx.income_total,0)-coalesce(tx.expense_total,0))::numeric,
    coalesce(tx.transaction_count,0)::bigint,
    coalesce(top5.top_categories,'[]'::jsonb),
    tx.last_activity
  from family_index fi
  left join tx on tx.user_id=fi.id
  left join top5 on top5.user_id=fi.id
  order by coalesce(tx.transaction_count,0) desc,fi.family_label;
end;
$$;

revoke all on function public.super_admin_money_family_financials(date) from public;
grant execute on function public.super_admin_money_family_financials(date) to authenticated;
