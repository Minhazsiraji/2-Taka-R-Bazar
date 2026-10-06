-- Defense-in-depth Data API defaults.
-- Existing application behavior is unchanged; future objects become explicit opt-in.

-- Sensitive internal tables remain inaccessible even if a future migration accidentally grants table privileges.
revoke all on table public.notification_dispatch_config from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;

drop policy if exists notification_dispatch_config_client_deny on public.notification_dispatch_config;
create policy notification_dispatch_config_client_deny
  on public.notification_dispatch_config
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists push_subscriptions_client_deny on public.push_subscriptions;
create policy push_subscriptions_client_deny
  on public.push_subscriptions
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- New public objects must be deliberately exposed; accidental Data API publication fails closed.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role, public;

-- Private schema functions are also explicit opt-in, including service-role callers.
alter default privileges for role postgres in schema private
  revoke execute on functions from anon, authenticated, service_role, public;
