-- Read-only pre-cutover validation. Keep protected owner user + both login methods.
-- DO NOT add this file under supabase/migrations.
-- The owner UUID is obtained exclusively from Supabase's protected owner
-- registry; no email, phone, or Auth UUID is hardcoded into GitHub.
with owner as (
  select owner_user_id as id from private.platform_owner_identity
), linked as (
  select u.id,
    u.phone = '8801404385101' as correct_phone,
    exists(select 1 from auth.identities i
       where i.user_id=u.id and i.provider='google'
       and lower(i.identity_data->>'email')='minhazsiraji@gmail.com') as correct_google,
    exists(select 1 from auth.identities i
       where i.user_id=u.id and i.provider='phone') as correct_phone_provider,
    exists(select 1 from public.user_roles r
       where r.user_id=u.id and r.role='super_admin') as correct_role
  from auth.users u join owner o on o.id=u.id
), referenced as (
  select count(*) as fk_total,
    count(*) filter (where pg_get_constraintdef(c.oid) like '%ON DELETE RESTRICT%') as restrict_fks,
    count(*) filter (where pg_get_constraintdef(c.oid) not like '%ON DELETE%') as no_action_fks
  from pg_constraint c
  where c.contype='f' and c.confrelid='auth.users'::regclass
)
select
 (select count(*) from owner)=1 as exactly_one_owner_registry,
 (select count(*) from linked)=1 as owner_auth_exists,
 coalesce((select correct_phone and correct_google and correct_phone_provider and correct_role from linked),false) as owner_sign_in_unchanged,
 (select count(*) from auth.users) as all_accounts,
 (select count(*) from auth.users u where u.id not in (select id from owner)) as dummy_accounts_to_remove,
 fk_total,restrict_fks,no_action_fks
from referenced;
