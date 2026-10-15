-- Issue #86: guided product creation, safe deletion, archive. No Commerce/Finance state writes.
create table public.product_deletion_audit (
 event_id bigint generated always as identity primary key,
 product_id uuid not null, original_sku text not null, original_name text not null,
 actor_id uuid references auth.users(id) on delete set null,
 reason text not null check(length(btrim(reason))>=10),
 content_history jsonb not null default '[]'::jsonb,
 deleted_at timestamptz not null default now()
);
alter table public.product_deletion_audit enable row level security;
revoke all on public.product_deletion_audit from public,anon,authenticated;
grant select on public.product_deletion_audit to authenticated;
create policy product_deletion_audit_super_admin on public.product_deletion_audit
 for select to authenticated using(private.has_role((select auth.uid()),'super_admin'));

create function public.admin_create_product_with_seo(p_master jsonb,p_content jsonb,p_faqs jsonb,p_media jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid;v_brand_type text:=coalesce(p_content->>'brand_type','UNBRANDED_LOOSE');
 v_brand text:=nullif(btrim(p_master->>'brand'),'');v_source text;
begin
 if v_user is null or not (private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')) then raise exception 'Admin required';end if;
 if length(btrim(coalesce(p_master->>'name',''))) not between 2 and 180 or
    length(btrim(coalesce(p_master->>'category',''))) not between 2 and 120 or
    length(btrim(coalesce(p_master->>'unit',''))) not between 1 and 30 or
    length(btrim(coalesce(p_master->>'package_size',''))) not between 1 and 60 or
    coalesce(p_master->>'sku','') !~ '^[A-Z0-9][A-Z0-9_-]{2,79}$' then raise exception 'Valid product master fields and SKU required';end if;
 if v_brand_type='2TBR_PRIVATE_LABEL' then
   if upper(coalesce(v_brand,'')) not in ('2TBR','2-TAKA-R-BAZAR') then
     raise exception '2TBR private label needs actual 2TBR packaging and exact brand';end if;
   v_source:='PRIVATE_LABEL';
 else
   v_source:='SUPPLIER_POOL';
 end if;
 if v_brand_type='SUPPLIER_BRAND' and v_brand is null then raise exception 'Actual supplier brand required';end if;
 if v_brand_type='UNBRANDED_LOOSE' and upper(coalesce(v_brand,'')) not in ('','UNBRANDED','GENERIC') then
   raise exception 'Unbranded product must not show another brand';end if;
 insert into public.products(name,brand,category,package_size,unit,sku,image_url,is_demo,source_type,brand_type)
 values(btrim(p_master->>'name'),v_brand,btrim(p_master->>'category'),
  btrim(p_master->>'package_size'),btrim(p_master->>'unit'),p_master->>'sku',
  nullif(p_master->>'image_url',''),coalesce((p_master->>'is_demo')::boolean,false),
  v_source,v_brand_type)
 returning id into v_id;
 perform public.admin_save_product_seo(v_id,p_content,p_faqs,p_media);
 return v_id;
end $$;

-- Block hard deletion if a related business row exists, including any order of one piece.
-- Inspect FK metadata at deletion time, so future protected dependencies are included automatically.
create function public.admin_product_delete_check(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_p public.products%rowtype;v_c public.product_seo_content%rowtype;
 v_fk record;v_used boolean;v_blockers text[]:=array[]::text[];
begin
 if v_user is null or not private.has_role(v_user,'super_admin') then raise exception 'Super Admin required';end if;
 select * into v_p from public.products where id=p_product_id for update;
 if not found then raise exception 'Product not found';end if;
 select * into v_c from public.product_seo_content where product_id=p_product_id;
 if v_c.product_id is not null and (v_c.published_at is not null or v_c.reviewed_by is not null
   or v_c.status in ('published','review')) then
  v_blockers:=array_append(v_blockers,'Previously published or independently reviewed SEO record');
 end if;
 if exists(select 1 from public.product_seo_slug_aliases where product_id=p_product_id) then
   v_blockers:=array_append(v_blockers,'Existing public URL redirect history');
 end if;
 for v_fk in
   select n.nspname as sch, cls.relname as tbl,att.attname as col
   from pg_constraint c
   join pg_class cls on cls.oid=c.conrelid
   join pg_namespace n on n.oid=cls.relnamespace
   join pg_attribute att on att.attrelid=c.conrelid and att.attnum=c.conkey[1]
   where c.contype='f' and c.confrelid='public.products'::regclass and cardinality(c.conkey)=1
     and not (n.nspname='public' and cls.relname in ('product_seo_content','product_seo_audit','product_seo_slug_aliases','commerce_skus'))
 loop
   execute format('select exists(select 1 from %I.%I where %I=$1)',v_fk.sch,v_fk.tbl,v_fk.col)
     using p_product_id into v_used;
   if v_used then v_blockers:=array_append(v_blockers,v_fk.sch||'.'||v_fk.tbl);end if;
 end loop;
 -- A commerce_skus row is automatically generated on master creation. It is safe to
 -- delete ONLY if no offer, order, inventory, stock or other FK-linked SKU history exists.
 for v_fk in
   select n.nspname as sch, cls.relname as tbl, att.attname as col
   from pg_constraint c
   join pg_class cls on cls.oid=c.conrelid
   join pg_namespace n on n.oid=cls.relnamespace
   join pg_attribute att on att.attrelid=c.conrelid and att.attnum=c.conkey[1]
   where c.contype='f' and c.confrelid='public.commerce_skus'::regclass and cardinality(c.conkey)=1
 loop
   execute format('select exists(select 1 from %I.%I where %I in (select id from public.commerce_skus where product_id=$1))',
     v_fk.sch,v_fk.tbl,v_fk.col) using p_product_id into v_used;
   if v_used then v_blockers:=array_append(v_blockers,v_fk.sch||'.'||v_fk.tbl);end if;
 end loop;
 -- UUIDs embedded in storefront featured-product arrays are business references even without an FK.
 if exists(select 1 from public.pool_storefront_publication where p_product_id=any(featured_product_ids)) then
   v_blockers:=array_append(v_blockers,'public.pool_storefront_publication featured product');
 end if;
 return jsonb_build_object('eligible',cardinality(v_blockers)=0,'blockers',to_jsonb(v_blockers),
    'product_id',p_product_id,'sku',v_p.sku);
end $$;

create function public.admin_product_archive(p_product_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_version integer;
begin
 if v_user is null or not private.has_role(v_user,'super_admin') then raise exception 'Super Admin required';end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Archive reason must be 10+ characters';end if;
 perform 1 from public.products where id=p_product_id for update;
 if not found then raise exception 'Product not found';end if;
 update public.products set active=false where id=p_product_id;
 update public.product_seo_content set status='unlisted',updated_at=now()
   where product_id=p_product_id and status<>'unlisted'
   returning version into v_version;
 if v_version is not null then
  insert into public.product_seo_audit(product_id,event,actor_id,version,notes)
  values(p_product_id,'unlisted',v_user,v_version,'Product archived: '||p_reason);
 end if;
end $$;

create function public.admin_delete_unused_product(p_product_id uuid,p_expected_sku text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_p public.products%rowtype;v_check jsonb;v_history jsonb;
begin
 if v_user is null or not private.has_role(v_user,'super_admin') then raise exception 'Super Admin required';end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Deletion reason must be 10+ characters';end if;
 select * into v_p from public.products where id=p_product_id for update;
 if not found or v_p.sku is distinct from p_expected_sku then raise exception 'Product not found or SKU changed';end if;
 v_check:=public.admin_product_delete_check(p_product_id);
 if (v_check->>'eligible')::boolean is distinct from true then
  raise exception 'Delete blocked by usage/history. Archive instead: %',v_check->'blockers';
 end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)
 into v_history from public.product_seo_audit a where a.product_id=p_product_id;
 insert into public.product_deletion_audit(product_id,original_sku,original_name,actor_id,reason,content_history)
 values(p_product_id,v_p.sku,v_p.name,v_user,p_reason,v_history);
 -- Only non-published drafts with no FK relationships can be cleaned.
 delete from public.product_seo_faqs where product_id=p_product_id;
 delete from public.product_seo_media where product_id=p_product_id;
 delete from public.product_seo_audit where product_id=p_product_id;
 delete from public.product_seo_content where product_id=p_product_id;
 -- Delete only the automatically generated commerce identity, once its entire FK history is absent.
 delete from public.commerce_skus where product_id=p_product_id;
 -- RESTRICT/NO ACTION on every business FK is the final concurrent-safety barrier.
 delete from public.products where id=p_product_id;
end $$;

revoke all on function public.admin_create_product_with_seo(jsonb,jsonb,jsonb,jsonb),
 public.admin_product_delete_check(uuid),public.admin_product_archive(uuid,text),
 public.admin_delete_unused_product(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_create_product_with_seo(jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.admin_product_delete_check(uuid),
 public.admin_product_archive(uuid,text),public.admin_delete_unused_product(uuid,text,text) to authenticated;
