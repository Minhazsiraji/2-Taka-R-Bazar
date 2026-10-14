-- Admin-only, atomic announcements with retry-safe request identity and delivery history.
create table private.notification_broadcasts (
 id uuid primary key,
 requested_by uuid references auth.users(id) on delete set null,
 title text not null,
 body text not null,
 href text not null,
 priority text not null check(priority in ('normal','high')),
 community_id uuid references public.communities(id),
 pool_id uuid references public.pools(id),
 recipient_count integer not null default 0,
 created_at timestamptz not null default now()
);
alter table private.notification_broadcasts enable row level security;
revoke all on private.notification_broadcasts from public,anon,authenticated;
alter table public.notifications add column broadcast_id uuid references private.notification_broadcasts(id);
create index notifications_broadcast_id_idx on public.notifications(broadcast_id) where broadcast_id is not null;

create function public.admin_broadcast_notification(
 p_title text,p_body text,p_href text,p_priority text,p_community_id uuid,p_pool_id uuid,p_request_id uuid
) returns integer language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_request private.notification_broadcasts%rowtype; v_inserted integer; v_count integer;
begin
 if v_actor is null or not exists(select 1 from public.user_roles where user_id=v_actor and role in ('admin','super_admin')) then raise exception 'Admin access required'; end if;
 if p_request_id is null then raise exception 'Request ID required'; end if;
 if length(trim(coalesce(p_title,'')))=0 or length(trim(coalesce(p_body,'')))=0 then raise exception 'Title and message are required'; end if;
 if length(p_title)>80 or length(p_body)>500 then raise exception 'Broadcast content is too long'; end if;
 if p_priority is null or p_priority not in ('normal','high') then raise exception 'Invalid notification priority'; end if;
 if p_href is null or length(p_href)>500 or p_href !~ '^/($|[?#]|pool($|[/?#])|orders($|[/?#])|pickup($|[/?#])|notifications($|[/?#])|cart($|[/?#])|account($|[/?#])|group-deals($|[/?#]))' or position(chr(92) in p_href)>0 or p_href ~ '[[:cntrl:]]' then raise exception 'Invalid notification destination'; end if;
 if p_community_id is not null and not exists(select 1 from public.communities where id=p_community_id and active) then raise exception 'Active community required'; end if;
 if p_pool_id is not null and not exists(select 1 from public.pools where id=p_pool_id and (p_community_id is null or community_id=p_community_id)) then raise exception 'Pool must belong to the selected community'; end if;
 insert into private.notification_broadcasts(id,requested_by,title,body,href,priority,community_id,pool_id)
 values(p_request_id,v_actor,trim(p_title),trim(p_body),p_href,p_priority,p_community_id,p_pool_id)
 on conflict(id) do nothing;
 get diagnostics v_inserted=row_count;
 select * into strict v_request from private.notification_broadcasts where id=p_request_id for update;
 if v_inserted=0 then
  if v_request.requested_by is distinct from v_actor or v_request.title<>trim(p_title) or v_request.body<>trim(p_body) or v_request.href<>p_href or v_request.priority<>p_priority or v_request.community_id is distinct from p_community_id or v_request.pool_id is distinct from p_pool_id then raise exception 'Request ID already belongs to a different announcement'; end if;
  return v_request.recipient_count;
 end if;
 insert into public.notifications(user_id,kind,title,body,href,priority,pool_id,dedupe_key,broadcast_id)
 select pr.id,'admin_announcement',v_request.title,v_request.body,p_href,p_priority,p_pool_id,'admin:'||p_request_id||':'||pr.id,p_request_id
 from public.profiles pr where pr.onboarding_completed_at is not null and (p_community_id is null or pr.community_id=p_community_id)
 on conflict(user_id,dedupe_key) do nothing;
 get diagnostics v_count=row_count;
 update private.notification_broadcasts set recipient_count=v_count where id=p_request_id;
 return v_count;
end; $$;
revoke all on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid,uuid) from public,anon;
grant execute on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid,uuid) to authenticated;

-- Preserve the existing six-argument API and validate its destinations too.
create or replace function public.admin_broadcast_notification(
 p_title text,p_body text,p_href text default '/notifications',p_priority text default 'normal',
 p_community_id uuid default null,p_pool_id uuid default null
) returns integer language sql security invoker set search_path='' as $$
 select public.admin_broadcast_notification(p_title,p_body,p_href,p_priority,p_community_id,p_pool_id,pg_catalog.gen_random_uuid());
$$;
revoke all on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid) to authenticated;

create function public.admin_notification_broadcast_history()
returns table(id uuid,created_at timestamptz,title text,body text,href text,community_name text,recipients integer,read_count bigint,push_count bigint,error_count bigint)
language plpgsql security definer set search_path='' stable as $$
begin
 if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('admin','super_admin')) then raise exception 'Admin access required'; end if;
 return query
 select b.id,b.created_at,b.title,b.body,b.href,coalesce(c.name,'All communities'),b.recipient_count,
 count(n.id) filter(where n.read_at is not null),count(n.id) filter(where n.push_sent_at is not null),count(n.id) filter(where n.push_error is not null and n.push_sent_at is null)
 from private.notification_broadcasts b left join public.communities c on c.id=b.community_id
 left join public.notifications n on n.broadcast_id=b.id
 group by b.id,c.name order by b.created_at desc limit 50;
end; $$;
revoke all on function public.admin_notification_broadcast_history() from public,anon;
grant execute on function public.admin_notification_broadcast_history() to authenticated;
