-- Authentication still uses normal Supabase password verification. This endpoint
-- can only report the caller's own time-limited operator-issued authorization.
create function public.finance_uat_session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.finance_authorized(auth.uid()) and exists(
   select 1 from private.finance_uat_leases l where l.actor_id=auth.uid() and l.expires_at>clock_timestamp()
 );
$$;
revoke all on function public.finance_uat_session_active() from public,anon,authenticated;
grant execute on function public.finance_uat_session_active() to authenticated;
