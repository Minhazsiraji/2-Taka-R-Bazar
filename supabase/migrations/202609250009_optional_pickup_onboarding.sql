-- Pickup point is intentionally optional during household onboarding.
-- Customers choose an active pickup point later when confirming a purchase.
create or replace function private.validate_profile_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_pickup_community uuid;
  v_pickup_active boolean;
begin
  if tg_op = 'UPDATE' and v_actor is not null and v_actor = old.id and not private.has_role(v_actor, 'admin') then
    if old.community_id is not null and new.community_id is distinct from old.community_id then
      raise exception 'Community cannot be changed after onboarding; contact operations';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Profile email follows the authenticated account';
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
