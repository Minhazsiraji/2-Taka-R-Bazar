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
