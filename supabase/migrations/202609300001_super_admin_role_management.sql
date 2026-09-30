-- Audited application-role management.
create or replace function public.super_admin_set_role(p_user_id uuid,p_role text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_count int;
begin
 if not private.has_role(v_actor,'super_admin') then raise exception 'Super Admin required'; end if;
 if p_role not in ('admin','pickup_operator','super_admin') then raise exception 'Unsupported role'; end if;
 if p_user_id is null then raise exception 'User required'; end if;
 if p_enabled then
  insert into public.user_roles(user_id,role) values(p_user_id,p_role) on conflict do nothing;
 else
  if p_role='super_admin' then
   select count(*) into v_count from public.user_roles where role='super_admin';
   if v_count<=1 and exists(select 1 from public.user_roles where user_id=p_user_id and role='super_admin') then raise exception 'Cannot remove the last Super Admin'; end if;
  end if;
  delete from public.user_roles where user_id=p_user_id and role=p_role;
 end if;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(v_actor,case when p_enabled then 'role_granted' else 'role_revoked' end,'user',p_user_id,jsonb_build_object('role',p_role));
end; $$;
revoke all on function public.super_admin_set_role(uuid,text,boolean) from public;
grant execute on function public.super_admin_set_role(uuid,text,boolean) to authenticated;
