create or replace function public.save_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if coalesce(p_endpoint,'')='' or coalesce(p_p256dh,'')='' or coalesce(p_auth,'')='' then raise exception 'Invalid push subscription'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,active,updated_at)
  values(v_user,p_endpoint,p_p256dh,p_auth,p_user_agent,true,now())
  on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,active=true,updated_at=now();
  update public.notifications
    set push_attempts=0,push_error=null
    where user_id=v_user and push_sent_at is null and created_at>now()-interval '7 days';
end; $$;
revoke all on function public.save_push_subscription(text,text,text,text) from public;
grant execute on function public.save_push_subscription(text,text,text,text) to authenticated;
