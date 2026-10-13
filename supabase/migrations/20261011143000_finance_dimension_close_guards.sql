create function private.finance_dimension_period_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare v_month date;v_date date;
begin
 if tg_table_name='finance_campaign_budgets' then v_month=coalesce(new.month_start,old.month_start);
 else select incurred_on into v_month from public.finance_expenses where id=coalesce(new.expense_id,old.expense_id); end if;
 perform private.finance_require_open(v_month);
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.finance_dimension_period_guard() from public,anon,authenticated,service_role;
create trigger finance_dimension_period_guard before insert or update or delete on public.finance_campaign_budgets for each row execute function private.finance_dimension_period_guard();
create trigger finance_dimension_period_guard before insert or update or delete on public.finance_expense_attributions for each row execute function private.finance_dimension_period_guard();
create function public.finance_staff_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.finance_authorized(auth.uid()) then raise exception 'Finance role required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',u.user_id,'name',coalesce(nullif(p.full_name,''),'Staff '||left(u.user_id::text,8))) order by u.user_id)
 from (select distinct user_id from public.user_roles where role<>'customer') u left join public.profiles p on p.id=u.user_id),'[]'::jsonb);
end $$;
revoke all on function public.finance_staff_options() from public,anon,authenticated;
grant execute on function public.finance_staff_options() to authenticated;
