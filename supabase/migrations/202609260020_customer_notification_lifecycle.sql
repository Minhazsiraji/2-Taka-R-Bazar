create schema if not exists private;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text not null default '/notifications',
  priority text not null default 'normal' check (priority in ('normal','high')),
  pool_id uuid references public.pools(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  dedupe_key text not null,
  read_at timestamptz,
  push_sent_at timestamptz,
  push_attempts integer not null default 0,
  push_error text,
  created_at timestamptz not null default now(),
  unique(user_id, dedupe_key)
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_push_pending_idx on public.notifications(created_at) where push_sent_at is null;
alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (auth.uid() = user_id);
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id) where active;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table if not exists public.notification_dispatch_config (
  singleton boolean primary key default true check (singleton),
  dispatch_secret text not null,
  vapid_public_key text,
  vapid_private_key text,
  vapid_subject text not null default 'mailto:notifications@2-taka-r-bazar.local',
  updated_at timestamptz not null default now()
);
alter table public.notification_dispatch_config enable row level security;
revoke all on public.notification_dispatch_config from anon, authenticated;
insert into public.notification_dispatch_config(singleton, dispatch_secret)
values (true, gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (singleton) do nothing;

create or replace function private.enqueue_notification(
  p_user_id uuid, p_kind text, p_title text, p_body text, p_href text,
  p_dedupe_key text, p_priority text default 'normal', p_pool_id uuid default null, p_order_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_user_id is null then return null; end if;
  insert into public.notifications(user_id,kind,title,body,href,dedupe_key,priority,pool_id,order_id)
  values (p_user_id,p_kind,p_title,p_body,coalesce(nullif(p_href,''),'/notifications'),p_dedupe_key,
          case when p_priority='high' then 'high' else 'normal' end,p_pool_id,p_order_id)
  on conflict (user_id,dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function private.enqueue_notification(uuid,text,text,text,text,text,text,uuid,uuid) from public;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid();
end; $$;
create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and read_at is null;
end; $$;
create or replace function public.get_push_public_key()
returns text language sql security definer set search_path = '' stable as $$ select vapid_public_key from public.notification_dispatch_config where singleton=true; $$;
create or replace function public.has_push_subscription()
returns boolean language sql security definer set search_path = '' stable as $$ select exists(select 1 from public.push_subscriptions where user_id=auth.uid() and active); $$;
create or replace function public.save_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if coalesce(p_endpoint,'')='' or coalesce(p_p256dh,'')='' or coalesce(p_auth,'')='' then raise exception 'Invalid push subscription'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,active,updated_at)
  values(v_user,p_endpoint,p_p256dh,p_auth,p_user_agent,true,now())
  on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,active=true,updated_at=now();
end; $$;
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.push_subscriptions set active=false,updated_at=now() where endpoint=p_endpoint and user_id=auth.uid();
end; $$;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.get_push_public_key() from public;
revoke all on function public.has_push_subscription() from public;
revoke all on function public.save_push_subscription(text,text,text,text) from public;
revoke all on function public.remove_push_subscription(text) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.get_push_public_key() to authenticated;
grant execute on function public.has_push_subscription() to authenticated;
grant execute on function public.save_push_subscription(text,text,text,text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

create or replace function private.pool_notification_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status='open' then
    for r in select id from public.profiles where community_id=new.community_id and onboarding_completed_at is not null loop
      perform private.enqueue_notification(r.id,'pool_published','New '||initcap(coalesce(new.cadence,'weekly'))||' pool is live',new.title||' is now open. Review target prices and potential savings, then commit what you want.','/pool','pool:'||new.id||':published','high',new.id,null);
    end loop;
  elsif new.status='pricing' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id and c.status in ('active','confirmed') loop
      perform private.enqueue_notification(r.customer_id,'pricing_started','Demand closed — sourcing started',new.title||' is now being priced with suppliers. We will notify you when the final price is ready.','/pool','pool:'||new.id||':pricing','normal',new.id,null);
    end loop;
  elsif new.status='final_price' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id and c.status in ('active','confirmed') loop
      perform private.enqueue_notification(r.customer_id,'final_price','Final pool prices are ready','Check your final prices and exact expected savings for '||new.title||'.','/pool','pool:'||new.id||':final-price','high',new.id,null);
    end loop;
  elsif new.status='confirmation' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id and c.status='active' loop
      perform private.enqueue_notification(r.customer_id,'confirmation_open','Confirm your purchase',new.title||' is ready for purchase confirmation. Choose a pickup point and confirm before the deadline.','/orders','pool:'||new.id||':confirmation-open','high',new.id,null);
    end loop;
  elsif new.status='cancelled' then
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=new.id loop
      perform private.enqueue_notification(r.customer_id,'pool_cancelled','Pool cancelled',new.title||' has been cancelled. No commitment will become a purchase.','/pool','pool:'||new.id||':cancelled','high',new.id,null);
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists trg_pool_notifications on public.pools;
create trigger trg_pool_notifications after update of status on public.pools for each row execute function private.pool_notification_trigger();

create or replace function private.commitment_notification_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pool_id uuid; v_title text;
begin
  select pi.pool_id,p.title into v_pool_id,v_title from public.pool_items pi join public.pools p on p.id=pi.pool_id where pi.id=new.pool_item_id;
  if tg_op='INSERT' or new.quantity is distinct from old.quantity then
    perform private.enqueue_notification(new.customer_id,'commitment_saved','Commitment saved',coalesce(v_title,'Pool')||': quantity '||new.quantity||' saved. This is not a purchase until you confirm the final price.','/pool','commitment:'||new.id||':qty:'||new.quantity,'normal',v_pool_id,null);
  end if;
  return new;
end; $$;
drop trigger if exists trg_commitment_notifications on public.commitments;
create trigger trg_commitment_notifications after insert or update of quantity on public.commitments for each row execute function private.commitment_notification_trigger();

create or replace function private.order_notification_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_title text; v_pickup text;
begin
  select title into v_title from public.pools where id=new.pool_id;
  select name into v_pickup from public.pickup_points where id=new.pickup_point_id;
  if tg_op='INSERT' then
    perform private.enqueue_notification(new.customer_id,'order_confirmed','Purchase confirmed','Order '||new.order_code||' is confirmed for '||coalesce(v_title,'your pool')||'. Pickup: '||coalesce(v_pickup,'selected point')||'.','/orders','order:'||new.id||':confirmed','high',new.pool_id,new.id);
  elsif new.status is distinct from old.status then
    if new.status='ordered' then
      perform private.enqueue_notification(new.customer_id,'order_placed','Supplier order placed','Your order '||new.order_code||' has been placed for sourcing.','/orders','order:'||new.id||':ordered','normal',new.pool_id,new.id);
    elsif new.status='ready_for_pickup' then
      perform private.enqueue_notification(new.customer_id,'ready_for_pickup','Your order is ready for pickup','Order '||new.order_code||' is ready at '||coalesce(v_pickup,'your selected pickup point')||'.','/pickup','order:'||new.id||':ready','high',new.pool_id,new.id);
    elsif new.status='completed' then
      perform private.enqueue_notification(new.customer_id,'pickup_completed','Pickup complete — savings verified','Order '||new.order_code||' was collected. Your savings are now verified. Please rate the pool and items to finish the journey.','/pool','order:'||new.id||':completed','high',new.pool_id,new.id);
    elsif new.status='cancelled' then
      perform private.enqueue_notification(new.customer_id,'order_cancelled','Order cancelled','Order '||new.order_code||' has been cancelled.','/orders','order:'||new.id||':cancelled','high',new.pool_id,new.id);
    end if;
  end if;
  if tg_op='UPDATE' and new.payment_status is distinct from old.payment_status then
    if new.payment_status='paid_manually' then
      perform private.enqueue_notification(new.customer_id,'payment_recorded','Payment recorded','Payment for order '||new.order_code||' has been recorded.','/orders','order:'||new.id||':payment:paid','normal',new.pool_id,new.id);
    elsif new.payment_status='payment_pending' then
      perform private.enqueue_notification(new.customer_id,'payment_pending','Payment pending','Payment for order '||new.order_code||' is pending.','/orders','order:'||new.id||':payment:pending','normal',new.pool_id,new.id);
    elsif new.payment_status='refunded' then
      perform private.enqueue_notification(new.customer_id,'payment_refunded','Refund recorded','A refund has been recorded for order '||new.order_code||'.','/orders','order:'||new.id||':payment:refunded','high',new.pool_id,new.id);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_order_notifications on public.orders;
create trigger trg_order_notifications after insert or update of status,payment_status on public.orders for each row execute function private.order_notification_trigger();

create or replace function private.maybe_notify_review_complete(p_user uuid,p_pool uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.orders where customer_id=p_user and pool_id=p_pool and status='completed') then return; end if;
  if not exists(select 1 from public.pool_reviews where user_id=p_user and pool_id=p_pool) then return; end if;
  if exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where o.customer_id=p_user and o.pool_id=p_pool and o.status='completed' and not exists(select 1 from public.pool_item_reviews pir where pir.user_id=p_user and pir.pool_item_id=oi.pool_item_id)) then return; end if;
  perform private.enqueue_notification(p_user,'review_complete','Thanks — review complete','You finished reviewing this pool and your purchased items. Thanks for helping the community shop smarter.','/home','pool:'||p_pool||':review-complete','normal',p_pool,null);
end; $$;
create or replace function private.pool_review_notification_trigger() returns trigger language plpgsql security definer set search_path = '' as $$ begin perform private.maybe_notify_review_complete(new.user_id,new.pool_id); return new; end; $$;
drop trigger if exists trg_pool_review_complete on public.pool_reviews;
create trigger trg_pool_review_complete after insert or update on public.pool_reviews for each row execute function private.pool_review_notification_trigger();
create or replace function private.pool_item_review_notification_trigger() returns trigger language plpgsql security definer set search_path = '' as $$ declare v_pool uuid; begin select pool_id into v_pool from public.pool_items where id=new.pool_item_id; perform private.maybe_notify_review_complete(new.user_id,v_pool); return new; end; $$;
drop trigger if exists trg_pool_item_review_complete on public.pool_item_reviews;
create trigger trg_pool_item_review_complete after insert or update on public.pool_item_reviews for each row execute function private.pool_item_review_notification_trigger();

create or replace function private.run_notification_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare p record; r record; n integer:=0; v_joined boolean; v_review_done boolean;
begin
  for p in select * from public.pools where status='open' and commitment_closes_at is not null and commitment_closes_at>now() and commitment_closes_at<=now()+interval '24 hours' loop
    for r in select id from public.profiles where community_id=p.community_id and onboarding_completed_at is not null loop
      select exists(select 1 from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p.id and c.customer_id=r.id and c.status in ('active','confirmed')) into v_joined;
      if p.commitment_closes_at<=now()+interval '3 hours' then
        if private.enqueue_notification(r.id,'commitment_deadline',case when v_joined then '3 hours left — review your commitment' else '3 hours left to join this pool' end,p.title||case when v_joined then ': check your quantities before commitment closes.' else ': commit any items you want before the window closes.' end,'/pool','pool:'||p.id||':commitment-3h','high',p.id,null) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.id,'commitment_deadline',case when v_joined then 'Commitment closes within 24 hours' else 'Last day to join this pool' end,p.title||case when v_joined then ': review your quantities while changes are still open.' else ': review target prices and join before demand closes.' end,'/pool','pool:'||p.id||':commitment-24h','normal',p.id,null) is not null then n:=n+1; end if;
    end loop;
  end loop;

  for p in select * from public.pools where status='confirmation' and confirmation_closes_at is not null and confirmation_closes_at>now() and confirmation_closes_at<=now()+interval '24 hours' loop
    for r in select distinct c.customer_id from public.commitments c join public.pool_items pi on pi.id=c.pool_item_id where pi.pool_id=p.id and c.status='active' and not exists(select 1 from public.orders o where o.pool_id=p.id and o.customer_id=c.customer_id and o.status<>'cancelled') loop
      if p.confirmation_closes_at<=now()+interval '3 hours' then
        if private.enqueue_notification(r.customer_id,'confirmation_deadline','3 hours left to confirm purchase',p.title||': confirm your purchase and pickup point before the deadline.','/orders','pool:'||p.id||':confirm-3h','high',p.id,null) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.customer_id,'confirmation_deadline','Purchase confirmation closes within 24 hours',p.title||': review final prices, savings, and pickup choices.','/orders','pool:'||p.id||':confirm-24h','high',p.id,null) is not null then n:=n+1; end if;
    end loop;
  end loop;

  for r in select o.*,p.pickup_at,p.title as pool_title,pp.name as pickup_name from public.orders o join public.pools p on p.id=o.pool_id left join public.pickup_points pp on pp.id=o.pickup_point_id where o.status in ('confirmed','ordered','ready_for_pickup') and p.pickup_at is not null and p.pickup_at>now() and p.pickup_at<=now()+interval '24 hours' loop
    if r.pickup_at<=now()+interval '3 hours' then
      if private.enqueue_notification(r.customer_id,'pickup_reminder','Pickup in about 3 hours','Order '||r.order_code||' · '||coalesce(r.pickup_name,'selected pickup point')||'.','/pickup','order:'||r.id||':pickup-3h','high',r.pool_id,r.id) is not null then n:=n+1; end if;
    elsif private.enqueue_notification(r.customer_id,'pickup_reminder','Pickup is within 24 hours','Order '||r.order_code||' will be collected at '||coalesce(r.pickup_name,'your selected pickup point')||'.','/pickup','order:'||r.id||':pickup-24h','normal',r.pool_id,r.id) is not null then n:=n+1; end if;
  end loop;

  for r in select o.* from public.orders o where o.status='completed' and o.completed_at is not null and o.completed_at>now()-interval '30 days' and o.completed_at<=now()-interval '2 hours' loop
    select exists(select 1 from public.pool_reviews pr where pr.user_id=r.customer_id and pr.pool_id=r.pool_id) and not exists(select 1 from public.order_items oi where oi.order_id=r.id and not exists(select 1 from public.pool_item_reviews pir where pir.user_id=r.customer_id and pir.pool_item_id=oi.pool_item_id)) into v_review_done;
    if not v_review_done then
      if r.completed_at<=now()-interval '24 hours' then
        if private.enqueue_notification(r.customer_id,'review_reminder','How was your pool?','Your verified-buyer review helps neighbors decide what to join next. Rate the pool and purchased items.','/pool','order:'||r.id||':review-24h','normal',r.pool_id,r.id) is not null then n:=n+1; end if;
      elsif private.enqueue_notification(r.customer_id,'review_reminder','Rate your completed pickup','Your savings are verified. Take a moment to rate the pool and the items you collected.','/pool','order:'||r.id||':review-2h','normal',r.pool_id,r.id) is not null then n:=n+1; end if;
    end if;
  end loop;
  return n;
end; $$;
revoke all on function private.run_notification_reminders() from public;

insert into public.notifications(user_id,kind,title,body,href,priority,pool_id,dedupe_key)
select pr.id,'pool_published','Pool is live',p.title||' is open now. Review target prices, potential savings, and commit what you want.','/pool','high',p.id,'pool:'||p.id||':published'
from public.pools p join public.profiles pr on pr.community_id=p.community_id and pr.onboarding_completed_at is not null
where p.status='open' and p.created_at>now()-interval '30 days'
on conflict(user_id,dedupe_key) do nothing;