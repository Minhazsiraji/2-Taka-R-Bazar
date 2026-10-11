-- Separate public marketing content from private own-product accounting and inventory.
create table public.own_product_showcase (
  product_id uuid primary key references public.products(id) on delete cascade,
  description text not null default '',
  highlights text[] not null default '{}'::text[],
  gallery_urls text[] not null default '{}'::text[],
  video_url text,
  published boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now(),
  constraint showcase_highlights_limit check (cardinality(highlights) <= 8),
  constraint showcase_gallery_limit check (cardinality(gallery_urls) <= 6),
  constraint showcase_description_limit check (length(description) <= 3000),
  constraint showcase_video_length check (video_url is null or length(video_url) <= 1000)
);

alter table public.own_product_showcase enable row level security;
create policy own_product_showcase_admin on public.own_product_showcase
for all to authenticated
using (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'))
with check (private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));

revoke all on public.own_product_showcase from anon;
grant select,insert,update,delete on public.own_product_showcase to authenticated;
create index own_product_showcase_published_featured_idx
on public.own_product_showcase(sort_order,product_id) where published and featured;

-- Deliberately expose only customer-facing fields. Product costs, supplier references,
-- stock, unpublished drafts and demo products never leave this narrow RPC.
create function public.get_public_own_product_showcase(
  p_product_id uuid default null,
  p_featured_only boolean default false
)
returns table(
  product_id uuid,
  name text,
  brand text,
  category text,
  package_size text,
  unit text,
  image_url text,
  source_type text,
  description text,
  highlights text[],
  gallery_urls text[],
  video_url text,
  featured boolean
)
language sql stable security definer
set search_path=''
as $$
  select p.id,p.name,p.brand,p.category,p.package_size,p.unit,p.image_url,
         p.source_type,s.description,s.highlights,s.gallery_urls,s.video_url,s.featured
  from public.products p
  join public.own_product_showcase s on s.product_id=p.id
  where p.active=true and p.is_demo=false
    and p.source_type in ('PRIVATE_LABEL','EXCLUSIVE_PARTNER')
    and s.published=true
    and (p_product_id is null or p.id=p_product_id)
    and (not p_featured_only or s.featured=true)
  order by s.sort_order asc,p.created_at desc
  limit 24;
$$;
revoke all on function public.get_public_own_product_showcase(uuid,boolean) from public;
grant execute on function public.get_public_own_product_showcase(uuid,boolean) to anon,authenticated;
