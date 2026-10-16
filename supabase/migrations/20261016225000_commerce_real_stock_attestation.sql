-- Issue #64/#109. Release-preparation proof for physical stock.
-- This migration DOES NOT permit purchases or modify Commerce/Finance posting rules.
-- Existing synthetic inventory figures are never treated as independently verified stock.
create table if not exists public.commerce_live_stock_attestations (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id),
 community_id uuid not null references public.communities(id),
 verified_quantity integer not null check (verified_quantity>0),
 unit_snapshot text not null check (length(unit_snapshot) between 1 and 80),
 evidence_path text not null check (length(evidence_path) between 15 and 280),
 evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
 requested_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 review_reason text,
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 valid_until timestamptz not null,
 check (reviewed_by is null or reviewed_by<>requested_by),
 check (
  (status='pending' and reviewed_by is null and reviewed_at is null) or
  (status<>'pending' and reviewed_by is not null and reviewed_at is not null and length(btrim(review_reason))>=10)
 )
);
create index if not exists commerce_live_stock_by_product
 on public.commerce_live_stock_attestations(product_id,community_id,status,valid_until desc);
alter table public.commerce_live_stock_attestations enable row level security;
revoke all on public.commerce_live_stock_attestations from public,anon,authenticated,service_role;

-- Checker can read original evidence created under a different staff account,
-- but only when the path belongs to an actual stock attestation.
create or replace function private.commerce_live_stock_checker_can_read(p_path text)
returns boolean language sql stable security definer set search_path='' as $
 select private.has_role(auth.uid(),'super_admin') and exists(
  select 1 from public.commerce_live_stock_attestations
  where evidence_path=p_path and status in ('pending','approved','rejected')
 )
$;
revoke all on function private.commerce_live_stock_checker_can_read(text)
 from public,anon,service_role;
grant execute on function private.commerce_live_stock_checker_can_read(text) to authenticated;
create policy commerce_live_stock_checker_evidence_read on storage.objects
 for select to authenticated
 using (bucket_id='commerce-evidence' and private.commerce_live_stock_checker_can_read(name));

-- Scoped workbench. Customers and guests have no direct table read access.
create or replace function public.commerce_live_stock_workbench()
returns jsonb language plpgsql stable security definer set search_path='' as $
begin
 if not private.commerce_admin() then
  raise exception using errcode='42501',message='Authorized Admin required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',a.id,'product_id',a.product_id,'product',p.name,
  'community_id',a.community_id,'community',c.name,
  'quantity',a.verified_quantity,'unit',a.unit_snapshot,
  'status',a.status,'evidence_path',a.evidence_path,
  'requested_by',a.requested_by,'reviewed_by',a.reviewed_by,
  'review_reason',a.review_reason,'created_at',a.requested_at,
  'valid_until',a.valid_until
 ) order by a.requested_at desc)
 from public.commerce_live_stock_attestations a
 join public.products p on p.id=a.product_id
 join public.communities c on c.id=a.community_id), '[]'::jsonb);
end $;
grant execute on function public.commerce_live_stock_workbench() to authenticated;

create or replace function public.commerce_request_live_stock_attestation(
 p_product uuid,p_community uuid,p_quantity integer,p_unit text,
 p_evidence_path text,p_evidence_sha256 text,p_valid_until timestamptz
) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype;i public.own_product_inventory%rowtype;v_id uuid;
begin
 if not private.commerce_admin() then raise exception using errcode='42501',message='Authorized Admin required';end if;
 select * into p from public.products where id=p_product and active and not is_demo for share;
 select * into i from public.own_product_inventory where product_id=p_product for share;
 if p.id is null or p.source_type='SUPPLIER_POOL' or i.product_id is null
  or p_quantity is null or p_quantity<1 or p_quantity<>i.stock_on_hand
  or p_unit is distinct from p.unit or coalesce(p.package_size,'')=''
  or p_unit ~* '(pcs\s*\/\s*kg|kg\s*\/\s*pcs)'
  then raise exception 'Correct product units and reconcile physical inventory before attestation';end if;
 if not exists(select 1 from public.communities where id=p_community and active)
  then raise exception 'Active pilot community required';end if;
 if p_evidence_path is null or p_evidence_path !~ ('^'||auth.uid()::text||'/[a-f0-9-]{36}\.(pdf|jpg|png)$')
  or p_evidence_sha256 !~ '^[a-f0-9]{64}$'
  then raise exception 'Original signed stock-count evidence required';end if;
 if p_valid_until is null or p_valid_until<=now() or p_valid_until>now()+interval '30 days'
  then raise exception 'Verification expiry must be within 30 days';end if;
 if exists(select 1 from public.commerce_live_stock_attestations
  where product_id=p_product and community_id=p_community and status='pending')
  then raise exception 'Existing stock verification awaits independent review';end if;
 insert into public.commerce_live_stock_attestations(
  product_id,community_id,verified_quantity,unit_snapshot,evidence_path,evidence_sha256,
  requested_by,valid_until)
 values(p_product,p_community,p_quantity,p_unit,p_evidence_path,p_evidence_sha256,auth.uid(),p_valid_until)
 returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'commerce_live_stock_attestation_requested','commerce_live_stock_attestation',v_id,
  jsonb_build_object('product_id',p_product,'community_id',p_community,'quantity',p_quantity,'unit',p_unit));
 return v_id;
end $$;

create or replace function public.commerce_review_live_stock_attestation(
 p_id uuid,p_approve boolean,p_reason text
) returns text
language plpgsql security definer set search_path='' as $$
declare a public.commerce_live_stock_attestations%rowtype;p public.products%rowtype;i public.own_product_inventory%rowtype;
begin
 if not private.has_role(auth.uid(),'super_admin')
  then raise exception using errcode='42501',message='Independent Super Admin approval required';end if;
 select * into a from public.commerce_live_stock_attestations where id=p_id for update;
 if a.id is null or a.status<>'pending' or a.requested_by=auth.uid()
  or p_approve is null or length(btrim(coalesce(p_reason,'')))<10 or a.valid_until<=now()
  then raise exception 'Independent pending stock attestation and review reason required';end if;
 select * into p from public.products where id=a.product_id for share;
 select * into i from public.own_product_inventory where product_id=a.product_id for share;
 if p_approve and not exists(select 1 from storage.objects so where so.bucket_id='commerce-evidence' and so.name=a.evidence_path) then raise exception 'Original evidence file missing';end if;
 if p_approve and (p.id is null or not p.active or p.is_demo
  or p.unit is distinct from a.unit_snapshot or i.stock_on_hand is distinct from a.verified_quantity
  or coalesce(i.reserved_quantity,0)>0
  or a.unit_snapshot ~* '(pcs\s*\/\s*kg|kg\s*\/\s*pcs)')
  then raise exception 'Inventory unit, quantity, or reservation changed: recount before approval';end if;
 update public.commerce_live_stock_attestations
 set status=case when p_approve then 'approved' else 'rejected' end,
     reviewed_by=auth.uid(),reviewed_at=now(),review_reason=btrim(p_reason)
 where id=a.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'commerce_live_stock_attestation_reviewed','commerce_live_stock_attestation',a.id,
  jsonb_build_object('approve',p_approve,'reason',btrim(p_reason)));
 return case when p_approve then 'approved' else 'rejected' end;
end $$;

-- Read-only eligibility helper. Will be used in a separately qualified live
-- SOLO offer/checkout migration, not the synthetic Preview functions.
create or replace function private.commerce_live_stock_eligible(
 p_product uuid,p_community uuid,p_requested integer default 1
) returns boolean
language sql stable security definer set search_path='' as $$
 select p_requested>0 and exists (
 select 1 from public.commerce_live_stock_attestations a
 join public.products p on p.id=a.product_id and p.active and not p.is_demo
 join public.own_product_inventory i on i.product_id=p.id
 where a.product_id=p_product and a.community_id=p_community
  and a.status='approved' and a.valid_until>now()
  and a.unit_snapshot=p.unit
  and a.verified_quantity>=i.stock_on_hand
  and i.stock_on_hand-i.reserved_quantity>=p_requested
 )
$$;
revoke all on function private.commerce_live_stock_eligible(uuid,uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.commerce_request_live_stock_attestation(uuid,uuid,integer,text,text,text,timestamptz)
 to authenticated;
grant execute on function public.commerce_review_live_stock_attestation(uuid,boolean,text)
 to authenticated;

-- Intentionally no change to private.commerce_configuration,
-- private.commerce_assert_preview or Finance maker-checker.
