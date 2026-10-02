-- Controlled pg_net schema hardening.
-- Core application behavior is unchanged.

create schema if not exists extensions;

-- Pause only the push dispatcher while pg_net is reinstalled.
do $$
begin
  perform cron.unschedule('2taka-push-dispatch');
exception when others then
  null;
end;
$$;

-- Safety gate: do not drop pg_net if any request is still queued.
do $$
begin
  if exists (select 1 from net.http_request_queue) then
    raise exception 'pg_net move aborted: pending HTTP requests exist';
  end if;
end;
$$;

-- Supabase recommends drop/recreate because pg_net is non-relocatable.
drop extension pg_net;
create extension pg_net with schema extensions;

-- Restore the exact existing push-dispatch schedule and target.
select cron.schedule(
  '2taka-push-dispatch',
  '*/2 * * * *',
  $$select net.http_post(
      url := 'https://sukabonfjcnaavjgjyuy.supabase.co/functions/v1/notification-push-dispatch',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-dispatch-secret',(select dispatch_secret from public.notification_dispatch_config where singleton=true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );$$
);
