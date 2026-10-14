-- Issue #64: independent, audited operations verification for saved addresses.
-- Only authenticated Admin/Super Admin can inspect customer address review queue.
create table if not exists public.delivery_location_review_audit(
 id uuid primary key default gen_random_uuid(),
 subject_kind text not null check(subject_kind in ('building','address')),
 subject_id uuid not null,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check(decision in ('registered','verified','rejected')),
 evidence_note text not null check(length(evidence_note) between 10 and 500),
 created_at timestamptz not null default now()
);
alter table public.delivery_location_review_audit enable row level security;
revoke all on public.delivery_location_review_audit from public,anon,authenticated;

create or replace function private.is_delivery_location_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.user_roles
  where user_id=auth.uid() and role in ('admin','super_admin')
 )
$$;
revoke all on function private.is_delivery_location_admin() from public,anon;
grant execute on function private.is_delivery_location_admin() to authenticated;

create or replace function public.admin_register_delivery_building(
 p_community_id uuid,p_zone_code text,p_building_code text,
 p_display_name text,p_evidence_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_zone text:=btrim(coalesce(p_zone_code,''));
        v_code text:=btrim(coalesce(p_building_code,''));
        v_label text:=btrim(coalesce(p_display_name,''));
        v_note text:=btrim(coalesce(p_evidence_note,''));
begin
 if not private.is_delivery_location_admin() then raise exception 'Admin only';end if;
 if length(v_zone) not between 1 and 60 or length(v_code) not between 1 and 60
    or length(v_label) not between 2 and 180 or length(v_note) not between 10 and 500
 then raise exception 'Building identifier or verification evidence is invalid';end if;
 if not exists(select 1 from public.communities where id=p_community_id and active)
 then raise exception 'Active community required';end if;
 insert into public.delivery_buildings(community_id,zone_code,building_code,display_name,verified_at)
 values(p_community_id,v_zone,v_code,v_label,now())
 on conflict(community_id,zone_code,building_code) do update
    set display_name=excluded.display_name
 returning id into v_id;
 insert into public.delivery_location_review_audit(subject_kind,subject_id,reviewer_id,decision,evidence_note)
 values('building',v_id,auth.uid(),'registered',v_note);
 return v_id;
end $$;
revoke all on function public.admin_register_delivery_building(uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_register_delivery_building(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_list_delivery_buildings()
returns table(id uuid,community_id uuid,display_name text,zone_code text,building_code text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_delivery_location_admin() then raise exception 'Admin only';end if;
 return query select b.id,b.community_id,b.display_name,b.zone_code,b.building_code
  from public.delivery_buildings b where b.active and b.verified_at is not null
  order by b.community_id,b.zone_code,b.display_name limit 500;
end $$;
revoke all on function public.admin_list_delivery_buildings() from public,anon;
grant execute on function public.admin_list_delivery_buildings() to authenticated;

create or replace function public.admin_list_delivery_address_reviews()
returns table(id uuid,customer_id uuid,community_id uuid,community_name text,
 building_label text,unit_label text,street_line text,landmark text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_delivery_location_admin() then raise exception 'Admin only';end if;
 return query select a.id,a.customer_id,a.community_id,c.name,
 a.building_label,a.unit_label,a.street_line,a.landmark,a.created_at
 from public.customer_delivery_addresses a join public.communities c on c.id=a.community_id
 where a.verification_status='customer_confirmed'
 order by a.created_at asc limit 100;
end $$;
revoke all on function public.admin_list_delivery_address_reviews() from public,anon;
grant execute on function public.admin_list_delivery_address_reviews() to authenticated;

create or replace function public.admin_review_delivery_address(
 p_address_id uuid,p_building_id uuid,p_approve boolean,p_evidence_note text
) returns void language plpgsql security definer set search_path='' as $$
declare v_address public.customer_delivery_addresses%rowtype;
        v_note text:=btrim(coalesce(p_evidence_note,''));
begin
 if not private.is_delivery_location_admin() then raise exception 'Admin only';end if;
 if length(v_note) not between 10 and 500 then raise exception 'Evidence note required';end if;
 select * into v_address from public.customer_delivery_addresses
 where id=p_address_id and verification_status='customer_confirmed' for update;
 if not found then raise exception 'Address not pending review';end if;
 if v_address.customer_id=auth.uid() then raise exception 'Cannot verify your own household';end if;
 if p_approve then
  if not exists(select 1 from public.delivery_buildings
   where id=p_building_id and community_id=v_address.community_id
     and active and verified_at is not null)
  then raise exception 'Verified building in same community required';end if;
  update public.customer_delivery_addresses set building_id=p_building_id,
   verification_status='operator_verified',updated_at=now()
   where id=p_address_id;
 else
  update public.customer_delivery_addresses set building_id=null,
   verification_status='rejected',updated_at=now() where id=p_address_id;
 end if;
 insert into public.delivery_location_review_audit(subject_kind,subject_id,reviewer_id,decision,evidence_note)
 values('address',p_address_id,auth.uid(),case when p_approve then 'verified' else 'rejected' end,v_note);
end $$;
revoke all on function public.admin_review_delivery_address(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_delivery_address(uuid,uuid,boolean,text) to authenticated;
