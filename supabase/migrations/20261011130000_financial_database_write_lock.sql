-- Default-deny data boundary. App environment variables and caller JWT metadata
-- cannot authorize a financial write. Only an operator may issue short UAT leases.
create table private.finance_uat_leases (
 actor_id uuid primary key references auth.users(id) on delete restrict,
 expires_at timestamptz not null,
 reason text not null check(length(btrim(reason))>=10),
 issued_at timestamptz not null default now(),
 check(expires_at>issued_at and expires_at<=issued_at+interval '8 hours')
);
alter table private.finance_uat_leases enable row level security;
revoke all on private.finance_uat_leases from public,anon,authenticated,service_role;

create function private.finance_assert_write_allowed() returns void
language plpgsql security definer set search_path='' as $$
begin
 -- A definer's current_user is NOT evidence of a trusted originating session.
 -- Maintenance only: no JWT identity and an actual database operator connection.
 if auth.uid() is null and session_user in ('postgres','supabase_admin')
    and coalesce(current_setting('role',true),'none') in ('none','postgres','supabase_admin') then
   return;
 end if;
 if auth.uid() is not null and exists(select 1 from private.finance_uat_leases
   where actor_id=auth.uid() and expires_at>clock_timestamp()) then return; end if;
 raise exception using errcode='42501',message='Financial writes locked: operator-issued UAT lease required';
end $$;
revoke all on function private.finance_assert_write_allowed() from public,anon,authenticated,service_role;

create function private.finance_write_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform private.finance_assert_write_allowed();
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function private.finance_write_lock() from public,anon,authenticated,service_role;

-- Row triggers protect SECURITY DEFINER RPCs and future mutation routes alike.
-- Operational customer/supply tables deliberately remain outside this boundary.
do $$ declare t record; begin
 for t in select c.oid::regclass as name from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and
 (c.relname like 'finance\_%' escape '\' or c.relname like 'treasury\_%' escape '\'
  or c.relname in ('procurement_purchase_orders','procurement_dispatch_links','procurement_supplier_bills'))
 loop
  execute format('create trigger finance_database_write_lock before insert or update or delete on %s for each row execute function private.finance_write_lock()',t.name);
 end loop;
end $$;
