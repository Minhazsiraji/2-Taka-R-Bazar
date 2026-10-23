-- A household may relocate without replacing its identity or changing historical orders.
-- Private audit metadata; no customer-facing write privileges.
create table if not exists private.profile_community_move_audit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  previous_community_id uuid not null,
  new_community_id uuid not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
alter table private.profile_community_move_audit enable row level security;
revoke all on private.profile_community_move_audit from public, anon, authenticated;
create index if not exists profile_community_move_by_profile
 on private.profile_community_move_audit(profile_id, changed_at desc);

create or replace function private.validate_profile_community_relocation()
 returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.community_id is not distinct from old.community_id then return new; end if;
 if new.community_id is null or not exists(
    select 1 from public.communities c where c.id=new.community_id and c.active
 ) then
  raise exception 'Choose an active community before saving your move';
 end if;
 -- Initial account registration remains unchanged; relocation rules apply only
 -- after a household has finished onboarding.
 if old.onboarding_completed_at is null then return new; end if;
 if coalesce(length(btrim(new.address_hint)),0)<5 then
  raise exception 'Enter your new building, road or landmark to change community';
 end if;
 -- Preserve historical orders and immutable closed-cycle prices. No participant
 -- can transfer to a different community while a cycle is still open.
 if exists(
    select 1 from public.simple_sale_cycle_members m
     join public.simple_sale_cycles cy on cy.id=m.cycle_id
    where m.customer_id=old.id and cy.status='open'
 ) or exists(
    select 1 from public.simple_sale_offer_joins j
    where j.customer_id=old.id and j.status='active'
 ) or exists(
    select 1 from public.group_deal_commitments g
    where g.customer_id=old.id and g.status not in ('fulfilled','cancelled')
 ) then
  raise exception 'Active Deal or Pool commitment: leave or settle it before changing community';
 end if;
 if exists(
   select 1 from public.simple_sale_cycle_quotes q
   where q.customer_id=old.id and q.status not in ('cancelled','verified')
 ) then
  raise exception 'An unsettled Deal or Pool price quote must be resolved before moving';
 end if;
 -- A former area's default pickup point and shared location URL are not valid
 -- for a new residence. Existing orders retain their original fulfillment data.
 new.pickup_point_id:=null;
 new.google_maps_url:=null;
 return new;
end;
$$;
revoke all on function private.validate_profile_community_relocation() from public,anon,authenticated;

create or replace function private.audit_profile_community_relocation()
 returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.onboarding_completed_at is not null and
   old.community_id is distinct from new.community_id and
   old.community_id is not null then
  insert into private.profile_community_move_audit(
    profile_id,previous_community_id,new_community_id,changed_by
  ) values(old.id,old.community_id,new.community_id,auth.uid());
 end if;
 return new;
end;
$$;
revoke all on function private.audit_profile_community_relocation() from public,anon,authenticated;

drop trigger if exists validate_profile_community_relocation on public.profiles;
create trigger validate_profile_community_relocation
 before update of community_id on public.profiles
 for each row execute function private.validate_profile_community_relocation();
drop trigger if exists audit_profile_community_relocation on public.profiles;
create trigger audit_profile_community_relocation
 after update of community_id on public.profiles
 for each row execute function private.audit_profile_community_relocation();

-- Serialized with relocation updates: an account must still belong to the
-- cycle's actual area at the instant a new membership row is written.
create or replace function private.validate_cycle_member_current_community()
 returns trigger language plpgsql security definer set search_path='' as $$
declare member_area uuid; cycle_area uuid;
begin
 select p.community_id into member_area
 from public.profiles p where p.id=new.customer_id for share;
 select c.community_id into cycle_area
 from public.simple_sale_cycles c where c.id=new.cycle_id;
 if member_area is null or cycle_area is null or member_area<>cycle_area then
  raise exception 'Member community has changed; refresh and join the correct area';
 end if;
 return new;
end;
$$;
revoke all on function private.validate_cycle_member_current_community() from public,anon,authenticated;
drop trigger if exists validate_cycle_member_current_community on public.simple_sale_cycle_members;
create trigger validate_cycle_member_current_community
 before insert on public.simple_sale_cycle_members
 for each row execute function private.validate_cycle_member_current_community();

-- Replace only the obsolete blanket lock; keep all other existing profile protections.
CREATE OR REPLACE FUNCTION private.validate_profile_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_pickup_community uuid;
  v_pickup_active boolean;
  v_auth_phone text;
begin
  if tg_op = 'UPDATE' and v_actor is not null and v_actor = old.id and not private.has_role(v_actor, 'admin') then
    select u.phone into v_auth_phone from auth.users u where u.id=v_actor;

    -- Change of community is separately guarded and audited by
    -- private.validate_profile_community_relocation(). All existing
    -- profile identity and signup restrictions remain in force.
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
$function$

