-- Keep the operational profile aligned with Supabase phone-auth identities.
-- The Auth phone is the verified account identifier; users do not type it again in onboarding.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, email, phone)
  values(new.id, new.email, new.phone)
  on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(public.profiles.phone, excluded.phone);

  insert into public.user_roles(user_id, role)
  values(new.id, 'customer')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

-- Backfill a verified Auth phone where the corresponding profile has none.
update public.profiles p
set phone = u.phone
from auth.users u
where p.id = u.id
  and p.phone is null
  and u.phone is not null;
