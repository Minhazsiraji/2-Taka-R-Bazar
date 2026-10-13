-- Temporary normal-password test sign-in. Does not grant roles or financial writes.
create table private.commerce_uat_signin_leases(
 actor_id uuid primary key references auth.users(id) on delete restrict,
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 reason text not null check(length(btrim(reason))>=10),
 check(expires_at>issued_at and expires_at<=issued_at+interval '8 hours')
);
alter table private.commerce_uat_signin_leases enable row level security;
revoke all on private.commerce_uat_signin_leases from public,anon,authenticated,service_role;

create function public.commerce_uat_session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from private.commerce_uat_signin_leases l
  join auth.users u on u.id=l.actor_id
  where l.actor_id=auth.uid() and l.expires_at>clock_timestamp()
   and u.email like '%@example.invalid' and u.email_confirmed_at is not null
 );
$$;
revoke all on function public.commerce_uat_session_active() from public,anon,authenticated,service_role;
grant execute on function public.commerce_uat_session_active() to authenticated;

create function private.commerce_uat_signin_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(null,'commerce_uat_signin_'||lower(tg_op),'commerce_uat_signin_lease',
  case when tg_op='DELETE' then old.actor_id else new.actor_id end,
  jsonb_build_object('operator',session_user,'old',case when tg_op<>'INSERT' then to_jsonb(old) else null end,
   'new',case when tg_op<>'DELETE' then to_jsonb(new) else null end));
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.commerce_uat_signin_audit() from public,anon,authenticated,service_role;
create trigger commerce_uat_signin_operator_audit after insert or update or delete
 on private.commerce_uat_signin_leases for each row execute function private.commerce_uat_signin_audit();
