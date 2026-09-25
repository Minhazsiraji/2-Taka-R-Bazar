alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role = any (array['customer'::text,'admin'::text,'pickup_operator'::text,'super_admin'::text]));

create or replace function private.has_role(p_user_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.user_roles r
    where r.user_id = p_user_id
      and (
        r.role = p_role
        or (r.role = 'super_admin' and p_role in ('admin','pickup_operator'))
      )
  );
$$;
revoke all on function private.has_role(uuid,text) from public;
grant execute on function private.has_role(uuid,text) to authenticated;
