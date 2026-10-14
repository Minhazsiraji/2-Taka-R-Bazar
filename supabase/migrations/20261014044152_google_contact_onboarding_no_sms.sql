-- Permit initial contact onboarding for identities without an Auth phone.
-- Existing phone identities and every independent integrity guard stay enforced.
create or replace function private.validate_profile_scope()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_pickup_community uuid;
  v_pickup_active boolean;
  v_auth_phone text;
begin
  if tg_op = 'UPDATE' and v_actor is not null and v_actor = old.id and not private.has_role(v_actor, 'admin') then
    select u.phone into v_auth_phone from auth.users u where u.id=v_actor;

    if old.community_id is not null and new.community_id is distinct from old.community_id then
      raise exception 'Community cannot be changed after onboarding; contact operations';
    end if;
    if old.community_id is null and new.community_id is not null
       and not exists(select 1 from public.communities c where c.id=new.community_id and c.active) then
      raise exception 'Choose an active community';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Profile email follows the authenticated account';
    end if;
    if nullif(v_auth_phone,'') is not null then
      if new.phone is distinct from v_auth_phone then
        raise exception 'Profile phone follows the authenticated login number';
      end if;
    elsif new.phone is distinct from old.phone then
      -- A Google/email account may supply an initial order contact. It is not
      -- phone ownership evidence, household verification or an Auth identity.
      if nullif(old.phone,'') is not null then
        raise exception 'Mobile contact is fixed; manage login methods in Account security';
      end if;
      if new.phone is null or new.phone !~ '^8801[3-9][0-9]{8}$' then
        raise exception 'Enter a valid Bangladesh mobile contact number';
      end if;
    end if;
    if new.referral_code is distinct from old.referral_code then
      raise exception 'Referral code is system managed';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'Profile creation time is system managed';
    end if;
    if old.onboarding_completed_at is not null
       and new.onboarding_completed_at is distinct from old.onboarding_completed_at then
      raise exception 'Onboarding completion is system managed';
    end if;
    if old.onboarding_completed_at is null and new.onboarding_completed_at is not null
       and (new.onboarding_completed_at < now()-interval '5 minutes'
            or new.onboarding_completed_at > now()+interval '5 minutes') then
      raise exception 'Invalid onboarding completion time';
    end if;
  end if;

  if new.pickup_point_id is not null then
    select community_id, active into v_pickup_community, v_pickup_active
      from public.pickup_points where id = new.pickup_point_id;
    if not found or not v_pickup_active then raise exception 'Pickup point is unavailable'; end if;
    if new.community_id is null or v_pickup_community is distinct from new.community_id then
      raise exception 'Pickup point must belong to the household community';
    end if;
  end if;

  if char_length(coalesce(new.full_name,'')) > 100 then raise exception 'Name is too long'; end if;
  if char_length(coalesce(new.household_name,'')) > 120 then raise exception 'Household name is too long'; end if;
  if char_length(coalesce(new.address_hint,'')) > 240 then raise exception 'Address is too long'; end if;
  if char_length(coalesce(new.google_maps_url,'')) > 500 then raise exception 'Map URL is too long'; end if;
  if new.google_maps_url is not null and btrim(new.google_maps_url) <> ''
     and new.google_maps_url !~* '^https://' then
    raise exception 'Map URL must use HTTPS';
  end if;

  if new.onboarding_completed_at is not null and (
    nullif(btrim(coalesce(new.full_name,'')), '') is null or
    nullif(btrim(coalesce(new.phone,'')), '') is null or
    nullif(btrim(coalesce(new.household_name,'')), '') is null or
    new.community_id is null
  ) then
    raise exception 'Complete name, phone, household and community before onboarding';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_profile_scope() from public;
