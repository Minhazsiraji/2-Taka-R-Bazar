create or replace function public.admin_broadcast_notification(
 p_title text,p_body text,p_href text default '/notifications',p_priority text default 'normal',
 p_community_id uuid default null,p_pool_id uuid default null
) returns integer language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); r record; n integer:=0; v_key text;
begin
 if v_actor is null or not exists(
  select 1 from public.user_roles where user_id=v_actor and role in ('admin','super_admin')
 ) then raise exception 'Admin access required'; end if;
 if length(trim(coalesce(p_title,'')))=0 or length(trim(coalesce(p_body,'')))=0 then raise exception 'Title and message are required'; end if;
 if length(p_title)>80 or length(p_body)>500 then raise exception 'Broadcast content is too long'; end if;
 v_key:='admin:'||gen_random_uuid()::text;
 for r in select id from public.profiles
  where onboarding_completed_at is not null and (p_community_id is null or community_id=p_community_id)
 loop
  if private.enqueue_notification(r.id,'admin_announcement',trim(p_title),trim(p_body),coalesce(nullif(p_href,''),'/notifications'),
   v_key||':'||r.id::text,case when p_priority='high' then 'high' else 'normal' end,p_pool_id,null) is not null then n:=n+1; end if;
 end loop;
 return n;
end; $$;
revoke all on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid) from public;
grant execute on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid) to authenticated;
