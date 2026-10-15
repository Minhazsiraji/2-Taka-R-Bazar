-- Issue #96: owner-only content publication, without transferring owner power
-- to a future Super Admin. Commerce/Finance maker-checker controls are untouched.
create table if not exists private.platform_owner_identity (
 singleton boolean primary key default true check (singleton),
 owner_user_id uuid not null unique references auth.users(id) on delete restrict,
 designated_at timestamptz not null default now()
);
alter table private.platform_owner_identity enable row level security;
revoke all on private.platform_owner_identity from public, anon, authenticated;

-- Bootstrap only when exactly one Super Admin exists in this database.
-- Empty disposable databases fail closed until a synthetic test explicitly binds its owner.
insert into private.platform_owner_identity(singleton,owner_user_id)
select true,r.user_id from public.user_roles r
where r.role='super_admin'
and (select count(*) from public.user_roles where role='super_admin')=1
on conflict (singleton) do nothing;

create or replace function private.is_platform_owner(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null
 and private.has_role(p_user,'super_admin')
 and exists(select 1 from private.platform_owner_identity i
            where i.singleton and i.owner_user_id=p_user)
$$;
revoke all on function private.is_platform_owner(uuid) from public,anon,authenticated;

create or replace function public.is_current_platform_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_platform_owner(auth.uid())
$$;
revoke all on function public.is_current_platform_owner() from public,anon,authenticated;
grant execute on function public.is_current_platform_owner() to authenticated;

-- One DB-authoritative submission gate. Owner-authored drafts or existing
-- owner-authored REVIEW entries publish immediately; staff-created content
-- remains in independent review. Published records still require all evidence,
-- bilingual SEO, an active real SKU and a master image.
create or replace function public.admin_submit_product_seo(p_product_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 r public.product_seo_content%rowtype;
 v_owner boolean:=private.is_platform_owner(auth.uid());
begin
 if not(private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')) then
  raise exception 'Admin required';
 end if;
 select * into r from public.product_seo_content where product_id=p_product_id for update;
 if r.product_id is null or
    (r.status<>'draft' and not (v_owner and r.status='review' and r.edited_by=v_user)) or
    length(btrim(r.description_en))<40 or length(btrim(r.description_bn))<20 or
    length(btrim(r.meta_title_en))<10 or length(btrim(r.meta_title_bn))<10 or
    length(btrim(r.meta_description_en))<30 or length(btrim(r.meta_description_bn))<20 or
    length(btrim(r.alt_en))<5 or length(btrim(r.alt_bn))<5 or
    length(btrim(r.verification_notes))<10 or
    not exists(select 1 from public.products p
     where p.id=p_product_id and p.active and not p.is_demo and p.image_url is not null)
 then raise exception 'Content incomplete, unverified, inactive or missing genuine image';end if;

 if v_owner and r.edited_by=v_user then
  update public.product_seo_content set status='published',
   reviewed_by=null,review_notes='Direct publication by verified platform owner',
   verified_at=now(),published_at=now(),updated_at=now()
  where product_id=p_product_id;
  insert into public.product_seo_audit(product_id,event,actor_id,version,notes)
   values(p_product_id,'published',v_user,r.version,'Owner direct publication; no independent content reviewer');
 else
  update public.product_seo_content set status='review',updated_at=now() where product_id=p_product_id;
  insert into public.product_seo_audit(product_id,event,actor_id,version)
   values(p_product_id,'submitted',v_user,r.version);
 end if;
end $$;
revoke all on function public.admin_submit_product_seo(uuid) from public,anon;
grant execute on function public.admin_submit_product_seo(uuid) to authenticated;
