-- Customer-integrity and external-abuse hardening.
-- Preserves current business flows while closing direct Data API field tampering.

-- Anonymous visitors have no legitimate write path in public application tables.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke usage, select, update on all sequences in schema public from anon;

-- Profiles are created by the auth trigger; customers may only update their own row.
revoke insert, delete on public.profiles from authenticated;

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
    if new.phone is distinct from v_auth_phone then
      raise exception 'Profile phone follows the verified authenticated account';
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

-- Customers may submit/edit feedback content, but moderation state and audit identity are server-owned.
create or replace function private.validate_feedback_customer_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is not null and v_actor = new.customer_id and not private.has_role(v_actor,'admin') then
    if char_length(coalesce(new.comment,'')) > 2000 then
      raise exception 'Feedback comment is too long';
    end if;
    if tg_op='INSERT' then
      if new.review_status <> 'pending' then raise exception 'Feedback review status is moderator managed'; end if;
      if new.created_at < now()-interval '5 minutes' or new.created_at > now()+interval '5 minutes' then
        raise exception 'Feedback creation time is system managed';
      end if;
    else
      if new.review_status is distinct from old.review_status then raise exception 'Feedback review status is moderator managed'; end if;
      if new.customer_id is distinct from old.customer_id then raise exception 'Feedback owner cannot be changed'; end if;
      if new.order_id is distinct from old.order_id then raise exception 'Feedback order cannot be changed'; end if;
      if new.created_at is distinct from old.created_at then raise exception 'Feedback creation time is system managed'; end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_customer_write_guard on public.feedback;
create trigger feedback_customer_write_guard
before insert or update on public.feedback
for each row execute function private.validate_feedback_customer_write();

-- Issue reporters may submit only the fields used by the application.
revoke insert on public.operational_issues from anon, authenticated;
grant insert (order_id, reported_by, issue_type, description) on public.operational_issues to authenticated;

alter table public.operational_issues
  add constraint operational_issues_type_format
  check (char_length(issue_type) between 1 and 40 and issue_type ~ '^[a-z0-9_]+$');
alter table public.operational_issues
  add constraint operational_issues_description_length
  check (char_length(description) between 5 and 2000);

-- Restore the intended Admin resolve workflow; customers still have no UPDATE policy.
drop policy if exists issues_admin_update on public.operational_issues;
create policy issues_admin_update
on public.operational_issues
for update
to authenticated
using (private.has_role((select auth.uid()),'admin'))
with check (private.has_role((select auth.uid()),'admin'));
