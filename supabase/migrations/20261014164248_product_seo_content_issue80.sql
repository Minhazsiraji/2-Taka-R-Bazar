-- Issue #80. Additive product content layer. No customer, stock, order, Finance or offer writes.
alter table public.products add column if not exists brand_type text;
update public.products set brand_type=case
  when source_type='PRIVATE_LABEL' then '2TBR_PRIVATE_LABEL'
  when nullif(btrim(brand),'') is null then 'UNBRANDED_LOOSE'
  else 'SUPPLIER_BRAND' end where brand_type is null;
alter table public.products alter column brand_type set default 'UNBRANDED_LOOSE';
alter table public.products alter column brand_type set not null;
alter table public.products add constraint products_brand_type_valid
  check (brand_type in ('UNBRANDED_LOOSE','SUPPLIER_BRAND','2TBR_PRIVATE_LABEL'));

create table public.product_seo_content(
 product_id uuid primary key references public.products(id) on delete restrict,
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=120),
 title_en text not null check(length(title_en) between 3 and 180),
 title_bn text not null check(length(title_bn) between 3 and 180),
 short_en text not null default '' check(length(short_en)<=320),
 short_bn text not null default '' check(length(short_bn)<=320),
 description_en text not null default '' check(length(description_en)<=8000),
 description_bn text not null default '' check(length(description_bn)<=8000),
 meta_title_en text not null default '' check(length(meta_title_en)<=110),
 meta_title_bn text not null default '' check(length(meta_title_bn)<=110),
 meta_description_en text not null default '' check(length(meta_description_en)<=320),
 meta_description_bn text not null default '' check(length(meta_description_bn)<=320),
 alt_en text not null default '' check(length(alt_en)<=200),
 alt_bn text not null default '' check(length(alt_bn)<=200),
 specs jsonb not null default '{}'::jsonb check(jsonb_typeof(specs)='object' and length(specs::text)<=8000),
 verification_notes text not null default '' check(length(verification_notes)<=3000),
 status text not null default 'draft' check(status in ('draft','review','published','unlisted')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 verified_at timestamptz,
 edited_by uuid references auth.users(id) on delete set null,
 reviewed_by uuid references auth.users(id) on delete set null,
 review_notes text,
 version integer not null default 1 check(version>=1)
);
create index product_seo_published_idx on public.product_seo_content(updated_at desc,product_id)
 where status='published';

create table public.product_seo_faqs(
 product_id uuid not null references public.product_seo_content(product_id) on delete cascade,
 position integer not null check(position between 1 and 8),
 question_en text not null check(length(question_en) between 5 and 300),
 answer_en text not null check(length(answer_en) between 5 and 1200),
 question_bn text not null check(length(question_bn) between 5 and 300),
 answer_bn text not null check(length(answer_bn) between 5 and 1200),
 primary key(product_id,position)
);
create table public.product_seo_media(
 product_id uuid not null references public.product_seo_content(product_id) on delete cascade,
 position integer not null check(position between 1 and 12),
 kind text not null check(kind in ('gallery','marketing')),
 url text not null check(length(url)<=1200 and url ~ '^https://[^ ]+$'),
 alt_en text not null check(length(alt_en) between 3 and 200),
 alt_bn text not null check(length(alt_bn) between 3 and 200),
 primary key(product_id,kind,position)
);
create table public.product_seo_slug_aliases(
 slug text primary key check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 product_id uuid not null references public.products(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table public.product_seo_audit(
 id bigint generated always as identity primary key,
 product_id uuid not null references public.products(id) on delete restrict,
 event text not null check(event in ('saved','submitted','published','rejected','unlisted')),
 actor_id uuid references auth.users(id) on delete set null,
 version integer not null,
 notes text,
 changed_at timestamptz not null default now()
);

-- No table-level public writes or direct reads. The public projection RPC is intentionally narrow.
alter table public.product_seo_content enable row level security;
alter table public.product_seo_faqs enable row level security;
alter table public.product_seo_media enable row level security;
alter table public.product_seo_slug_aliases enable row level security;
alter table public.product_seo_audit enable row level security;
revoke all on public.product_seo_content,public.product_seo_faqs,public.product_seo_media,
 public.product_seo_slug_aliases,public.product_seo_audit from public,anon,authenticated;
grant select on public.product_seo_content,public.product_seo_faqs,public.product_seo_media,
 public.product_seo_slug_aliases,public.product_seo_audit to authenticated;
-- Explicitly reserve privileged fixture/maintenance DML for server-only service-role credentials.
-- Browser visitors and ordinary signed-in roles still have no direct table writes.
grant select,insert,update,delete on public.product_seo_content,public.product_seo_faqs,public.product_seo_media,
 public.product_seo_slug_aliases,public.product_seo_audit to service_role;
grant usage,select on sequence public.product_seo_audit_id_seq to service_role;
create policy product_seo_admin_content on public.product_seo_content for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy product_seo_admin_faq on public.product_seo_faqs for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy product_seo_admin_media on public.product_seo_media for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy product_seo_admin_alias on public.product_seo_slug_aliases for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy product_seo_admin_audit on public.product_seo_audit for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));

-- The app validates text and media before invoking this single-transaction server-side RPC.
create function public.admin_save_product_seo(p_product_id uuid,p_data jsonb,p_faqs jsonb,p_media jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.product_seo_content%rowtype;
        v_slug text:=lower(btrim(coalesce(p_data->>'slug','')));
        v_brand_type text:=coalesce(p_data->>'brand_type','UNBRANDED_LOOSE');
        v_faq jsonb;v_media jsonb;v_pos integer;
begin
 if v_user is null or not (private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')) then raise exception 'Admin required';end if;
 if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found';end if;
 if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug)>120 or
   length(btrim(coalesce(p_data->>'title_en','')))<3 or length(btrim(coalesce(p_data->>'title_bn','')))<3
   then raise exception 'Valid slug and both language titles required';end if;
 if v_brand_type not in ('UNBRANDED_LOOSE','SUPPLIER_BRAND','2TBR_PRIVATE_LABEL') then raise exception 'Unknown brand type';end if;
 if jsonb_typeof(p_faqs) is distinct from 'array' or jsonb_array_length(p_faqs)>8 then raise exception 'Maximum eight bilingual FAQs';end if;
 if jsonb_typeof(p_media) is distinct from 'array' or jsonb_array_length(p_media)>12 then raise exception 'Maximum twelve media images';end if;
 if jsonb_typeof(coalesce(p_data->'specs','{}'::jsonb)) is distinct from 'object' then raise exception 'Specifications must be an object';end if;
 if v_brand_type='2TBR_PRIVATE_LABEL' and not exists(
   select 1 from public.products where id=p_product_id and source_type='PRIVATE_LABEL'
     and upper(btrim(coalesce(brand,''))) in ('2TBR','2-TAKA-R-BAZAR')
 ) then raise exception '2TBR private label requires an actual 2TBR branded product SKU and packaging';end if;
 if v_brand_type='SUPPLIER_BRAND' and not exists(
   select 1 from public.products where id=p_product_id and nullif(btrim(brand),'') is not null
 ) then raise exception 'Supplier brand classification requires the actual brand';end if;
 if v_brand_type='UNBRANDED_LOOSE' and exists(
   select 1 from public.products where id=p_product_id and
     upper(btrim(coalesce(brand,''))) not in ('','UNBRANDED','GENERIC')
 ) then raise exception 'A third-party branded product must not be classified as unbranded';end if;
 select * into v_row from public.product_seo_content where product_id=p_product_id for update;
 if v_row.product_id is not null and coalesce(nullif(p_data->>'expected_version','')::integer,-1)<>v_row.version
  then raise exception 'Product content changed in another session. Reload before saving';end if;
 if v_row.product_id is not null and v_row.slug<>v_slug then
   if exists(select 1 from public.product_seo_slug_aliases where slug=v_slug) then raise exception 'Slug reserved by previous product';end if;
   insert into public.product_seo_slug_aliases(slug,product_id) values(v_row.slug,p_product_id) on conflict(slug) do nothing;
 end if;
 update public.products set brand_type=v_brand_type where id=p_product_id;
 insert into public.product_seo_content(product_id,slug,title_en,title_bn,short_en,short_bn,
   description_en,description_bn,meta_title_en,meta_title_bn,meta_description_en,meta_description_bn,
   alt_en,alt_bn,specs,verification_notes,status,edited_by,reviewed_by,review_notes,updated_at,version)
 values(p_product_id,v_slug,btrim(p_data->>'title_en'),btrim(p_data->>'title_bn'),
   coalesce(p_data->>'short_en',''),coalesce(p_data->>'short_bn',''),
   coalesce(p_data->>'description_en',''),coalesce(p_data->>'description_bn',''),
   coalesce(p_data->>'meta_title_en',''),coalesce(p_data->>'meta_title_bn',''),
   coalesce(p_data->>'meta_description_en',''),coalesce(p_data->>'meta_description_bn',''),
   coalesce(p_data->>'alt_en',''),coalesce(p_data->>'alt_bn',''),
   coalesce(p_data->'specs','{}'::jsonb),coalesce(p_data->>'verification_notes',''),
   'draft',v_user,null,null,now(),1)
 on conflict(product_id) do update set slug=excluded.slug,title_en=excluded.title_en,title_bn=excluded.title_bn,
   short_en=excluded.short_en,short_bn=excluded.short_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,
   meta_title_en=excluded.meta_title_en,meta_title_bn=excluded.meta_title_bn,
   meta_description_en=excluded.meta_description_en,meta_description_bn=excluded.meta_description_bn,
   alt_en=excluded.alt_en,alt_bn=excluded.alt_bn,specs=excluded.specs,
   verification_notes=excluded.verification_notes,status='draft',edited_by=v_user,
   reviewed_by=null,review_notes=null,updated_at=now(),version=public.product_seo_content.version+1;
 delete from public.product_seo_faqs where product_id=p_product_id;
 v_pos:=0;
 for v_faq in select value from jsonb_array_elements(p_faqs) loop
   v_pos:=v_pos+1;
   insert into public.product_seo_faqs(product_id,position,question_en,answer_en,question_bn,answer_bn)
    values(p_product_id,v_pos,btrim(v_faq->>'question_en'),btrim(v_faq->>'answer_en'),
       btrim(v_faq->>'question_bn'),btrim(v_faq->>'answer_bn'));
 end loop;
 delete from public.product_seo_media where product_id=p_product_id;
 v_pos:=0;
 for v_media in select value from jsonb_array_elements(p_media) loop
   v_pos:=v_pos+1;
   if coalesce(v_media->>'kind','') not in ('gallery','marketing') then raise exception 'Invalid media role';end if;
   insert into public.product_seo_media(product_id,position,kind,url,alt_en,alt_bn)
     values(p_product_id,v_pos,v_media->>'kind',v_media->>'url',
       btrim(v_media->>'alt_en'),btrim(v_media->>'alt_bn'));
 end loop;
 insert into public.product_seo_audit(product_id,event,actor_id,version)
   select p_product_id,'saved',v_user,version from public.product_seo_content where product_id=p_product_id;
end $$;

create function public.admin_submit_product_seo(p_product_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); r public.product_seo_content%rowtype;
begin
 if not(private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')) then raise exception 'Admin required';end if;
 select * into r from public.product_seo_content where product_id=p_product_id for update;
 if r.product_id is null or r.status<>'draft' or
  length(btrim(r.description_en))<40 or length(btrim(r.description_bn))<20 or
  length(btrim(r.meta_title_en))<10 or length(btrim(r.meta_title_bn))<10 or
  length(btrim(r.meta_description_en))<30 or length(btrim(r.meta_description_bn))<20 or
  length(btrim(r.alt_en))<5 or length(btrim(r.alt_bn))<5 or
  length(btrim(r.verification_notes))<10 or
  not exists(select 1 from public.products p where p.id=p_product_id and p.active and not p.is_demo and p.image_url is not null)
 then raise exception 'Content incomplete, unverified, inactive or missing genuine image';end if;
 update public.product_seo_content set status='review',updated_at=now() where product_id=p_product_id;
 insert into public.product_seo_audit(product_id,event,actor_id,version) values(p_product_id,'submitted',v_user,r.version);
end $$;

create function public.admin_review_product_seo(p_product_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();r public.product_seo_content%rowtype;
begin
 if not private.has_role(v_user,'super_admin') then raise exception 'Super Admin required';end if;
 select * into r from public.product_seo_content where product_id=p_product_id for update;
 if r.product_id is null or r.status<>'review' or r.edited_by=v_user or p_approve is null or length(btrim(coalesce(p_note,'')))<10 then
  raise exception 'Independent review and reason required';end if;
 update public.product_seo_content set status=case when p_approve then 'published' else 'draft' end,
  reviewed_by=v_user,review_notes=p_note,verified_at=case when p_approve then now() else verified_at end,
  published_at=case when p_approve then now() else published_at end,updated_at=now()
 where product_id=p_product_id;
 insert into public.product_seo_audit(product_id,event,actor_id,version,notes)
 values(p_product_id,case when p_approve then 'published' else 'rejected' end,v_user,r.version,p_note);
end $$;

create function public.admin_unlist_product_seo(p_product_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_version integer;
begin
 if not(private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')) or length(btrim(coalesce(p_reason,'')))<10 then
  raise exception 'Authorized reason required';end if;
 update public.product_seo_content set status='unlisted',updated_at=now() where product_id=p_product_id
 returning version into v_version;
 if v_version is null then raise exception 'Product content not found';end if;
 insert into public.product_seo_audit(product_id,event,actor_id,version,notes) values(p_product_id,'unlisted',v_user,v_version,p_reason);
end $$;

-- Public anonymous function deliberately returns no supplier identifiers, purchase limits, costs, stock,
-- verification notes, internal reviewer IDs or unpublished/demo product content.
create function public.get_public_product_seo(p_slug text default null,p_limit integer default 200,p_offset integer default 0)
returns table(product_id uuid,slug text,sku text,title_en text,title_bn text,short_en text,short_bn text,
 description_en text,description_bn text,meta_title_en text,meta_title_bn text,
 meta_description_en text,meta_description_bn text,alt_en text,alt_bn text,
 specs jsonb,faqs jsonb,media jsonb,brand text,brand_type text,category text,
 package_size text,unit text,image_url text,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select p.id,c.slug,p.sku,c.title_en,c.title_bn,c.short_en,c.short_bn,c.description_en,c.description_bn,
  c.meta_title_en,c.meta_title_bn,c.meta_description_en,c.meta_description_bn,c.alt_en,c.alt_bn,
  c.specs,coalesce((select jsonb_agg(jsonb_build_object('question_en',f.question_en,'answer_en',f.answer_en,
     'question_bn',f.question_bn,'answer_bn',f.answer_bn) order by f.position)
   from public.product_seo_faqs f where f.product_id=p.id),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('kind',m.kind,'url',m.url,'alt_en',m.alt_en,
    'alt_bn',m.alt_bn) order by m.position)
   from public.product_seo_media m where m.product_id=p.id),'[]'::jsonb),
  p.brand,p.brand_type,p.category,p.package_size,p.unit,p.image_url,c.updated_at
 from public.product_seo_content c join public.products p on p.id=c.product_id
 where c.status='published' and p.active and not p.is_demo and (p_slug is null or c.slug=p_slug)
 order by c.updated_at desc,p.id
 limit least(greatest(coalesce(p_limit,200),1),500) offset greatest(coalesce(p_offset,0),0)
$$;
create function public.resolve_product_seo_slug(p_slug text)
returns text language sql stable security definer set search_path='' as $$
 select c.slug from public.product_seo_slug_aliases a
 join public.product_seo_content c on c.product_id=a.product_id
 join public.products p on p.id=a.product_id
 where a.slug=p_slug and c.status='published' and p.active and not p.is_demo
 limit 1
$$;

-- Published SEO identity for legacy offer/showcase URLs, used to set a single canonical target.
create function public.get_public_product_seo_slug_for_id(p_product_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select c.slug from public.product_seo_content c
 join public.products p on p.id=c.product_id
 where p.id=p_product_id and p.active and not p.is_demo and c.status='published'
 limit 1
$$;

revoke all on function public.admin_save_product_seo(uuid,jsonb,jsonb,jsonb),
 public.admin_submit_product_seo(uuid),public.admin_review_product_seo(uuid,boolean,text),
 public.admin_unlist_product_seo(uuid,text),public.get_public_product_seo(text,integer,integer),
 public.resolve_product_seo_slug(text),public.get_public_product_seo_slug_for_id(uuid) from public,anon,authenticated;
grant execute on function public.admin_save_product_seo(uuid,jsonb,jsonb,jsonb),
 public.admin_submit_product_seo(uuid),public.admin_review_product_seo(uuid,boolean,text),
 public.admin_unlist_product_seo(uuid,text) to authenticated;
grant execute on function public.get_public_product_seo(text,integer,integer),
 public.resolve_product_seo_slug(text),public.get_public_product_seo_slug_for_id(uuid) to anon,authenticated;
