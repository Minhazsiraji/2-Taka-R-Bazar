create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('2taka-notification-reminders');
exception when others then null; end $$;

do $$ begin
  perform cron.unschedule('2taka-push-dispatch');
exception when others then null; end $$;

select cron.schedule(
  '2taka-notification-reminders',
  '*/15 * * * *',
  $$select private.run_notification_reminders();$$
);

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