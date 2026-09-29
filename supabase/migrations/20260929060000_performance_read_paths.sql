-- Performance-only read-path improvements. No business rules change.

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id)
  where read_at is null;

create index if not exists orders_customer_ready_idx
  on public.orders(customer_id, ready_at desc)
  where status = 'ready_for_pickup';

create index if not exists pools_community_active_created_idx
  on public.pools(community_id, created_at desc)
  where status in ('open','pricing','final_price','confirmation','ordered','ready_for_pickup');

create or replace function public.get_my_savings_summary()
returns table(
  month_verified_saving numeric,
  lifetime_verified_saving numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(s.amount) filter (
      where s.verified_at >= (date_trunc('month', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')
    ), 0)::numeric as month_verified_saving,
    coalesce(sum(s.amount), 0)::numeric as lifetime_verified_saving
  from public.savings_ledger s
  where s.customer_id = auth.uid();
$$;

revoke all on function public.get_my_savings_summary() from public, anon;
grant execute on function public.get_my_savings_summary() to authenticated;
