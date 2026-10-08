-- Community QR onboarding and attribution.
-- A QR scan is analytics only. It never creates a member, commitment, order or saving.

create table if not exists public.community_qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  community_id uuid not null references public.communities(id) on delete cascade,
  campaign_name text not null,
  placement text,
  source_type text not null default 'poster',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_qr_codes_code_format check (code = upper(code) and code ~ '^[A-Z0-9-]{3,24}$')
);

create table if not exists public.community_qr_scans (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references public.community_qr_codes(id) on delete cascade,
  scan_token uuid not null unique default gen_random_uuid(),
  source text not null default 'poster',
  scanned_at timestamptz not null default now()
);

create table if not exists public.community_qr_conversions (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references public.community_qr_codes(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_token uuid references public.community_qr_scans(scan_token) on delete set null,
  converted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (qr_code_id, user_id)
);

create index if not exists community_qr_codes_community_idx on public.community_qr_codes(community_id) where active;
create index if not exists community_qr_scans_qr_time_idx on public.community_qr_scans(qr_code_id, scanned_at desc);
create index if not exists community_qr_conversions_qr_time_idx on public.community_qr_conversions(qr_code_id, converted_at desc);
create index if not exists community_qr_conversions_user_idx on public.community_qr_conversions(user_id);

alter table public.community_qr_codes enable row level security;
alter table public.community_qr_scans enable row level security;
alter table public.community_qr_conversions enable row level security;

revoke all on public.community_qr_codes from anon, authenticated;
revoke all on public.community_qr_scans from anon, authenticated;
revoke all on public.community_qr_conversions from anon, authenticated;

create or replace function public.get_public_community_qr(p_code text)
returns table (
  code text,
  community_id uuid,
  community_name text,
  community_slug text,
  campaign_name text,
  placement text,
  active_pool_count bigint,
  active_group_deal_count bigint,
  month_verified_saving numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.code,
    c.id,
    c.name,
    c.slug,
    q.campaign_name,
    q.placement,
    (
      select count(*)
      from public.pools p
      where p.community_id = c.id
        and p.status = 'open'
        and coalesce(p.is_paused,false) = false
    ) as active_pool_count,
    (
      select count(distinct gd.id)
      from public.group_deal_communities gc
      join public.group_deals gd on gd.id = gc.group_deal_id
      where gc.community_id = c.id
        and gd.status = 'open'
    ) as active_group_deal_count,
    (
      select coalesce(sum(s.amount),0)
      from public.savings_ledger s
      where s.community_id = c.id
        and s.verified_at >= date_trunc('month', now())
    ) as month_verified_saving
  from public.community_qr_codes q
  join public.communities c on c.id = q.community_id
  where q.code = upper(btrim(p_code))
    and q.active
    and c.active
  limit 1;
$$;

revoke all on function public.get_public_community_qr(text) from public;
grant execute on function public.get_public_community_qr(text) to anon, authenticated;

create or replace function public.register_community_qr_scan(p_code text, p_source text default 'poster')
returns table (
  scan_token uuid,
  code text,
  community_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qr public.community_qr_codes%rowtype;
  v_token uuid;
  v_source text;
  v_name text;
begin
  select q.* into v_qr
  from public.community_qr_codes q
  join public.communities c on c.id = q.community_id
  where q.code = upper(btrim(p_code))
    and q.active
    and c.active
  limit 1;

  if v_qr.id is null then
    return;
  end if;

  v_source := left(regexp_replace(coalesce(nullif(btrim(p_source),''),'poster'),'[^A-Za-z0-9_-]+','','g'),32);
  if v_source = '' then v_source := 'poster'; end if;

  insert into public.community_qr_scans(qr_code_id, source)
  values(v_qr.id, v_source)
  returning community_qr_scans.scan_token into v_token;

  select c.name into v_name from public.communities c where c.id = v_qr.community_id;

  return query select v_token, v_qr.code, v_name;
end;
$$;

revoke all on function public.register_community_qr_scan(text,text) from public;
grant execute on function public.register_community_qr_scan(text,text) to anon, authenticated;

create or replace function public.complete_community_qr_conversion(p_code text, p_scan_token uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_qr public.community_qr_codes%rowtype;
  v_profile_community uuid;
  v_scan_qr uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select q.* into v_qr
  from public.community_qr_codes q
  join public.communities c on c.id = q.community_id
  where q.code = upper(btrim(p_code))
    and q.active
    and c.active
  limit 1;

  if v_qr.id is null then
    raise exception 'Community QR is unavailable';
  end if;

  select p.community_id into v_profile_community
  from public.profiles p
  where p.id = v_user;

  if v_profile_community is null or v_profile_community is distinct from v_qr.community_id then
    raise exception 'Profile community does not match this QR';
  end if;

  if p_scan_token is not null then
    select s.qr_code_id into v_scan_qr
    from public.community_qr_scans s
    where s.scan_token = p_scan_token;
    if v_scan_qr is distinct from v_qr.id then
      p_scan_token := null;
    end if;
  end if;

  insert into public.community_qr_conversions(qr_code_id, community_id, user_id, scan_token)
  values(v_qr.id, v_qr.community_id, v_user, p_scan_token)
  on conflict (qr_code_id, user_id)
  do update set
    scan_token = coalesce(public.community_qr_conversions.scan_token, excluded.scan_token),
    converted_at = least(public.community_qr_conversions.converted_at, excluded.converted_at);

  return true;
end;
$$;

revoke all on function public.complete_community_qr_conversion(text,uuid) from public;
grant execute on function public.complete_community_qr_conversion(text,uuid) to authenticated;

create or replace function public.get_admin_community_qr_stats()
returns table (
  code text,
  community_name text,
  campaign_name text,
  placement text,
  active boolean,
  scan_count bigint,
  joined_count bigint,
  buyers_with_completed_order bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'super_admin')
  ) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    q.code,
    c.name,
    q.campaign_name,
    q.placement,
    q.active,
    (select count(*) from public.community_qr_scans s where s.qr_code_id=q.id),
    (select count(*) from public.community_qr_conversions cv where cv.qr_code_id=q.id),
    (
      select count(*)
      from public.community_qr_conversions cv
      where cv.qr_code_id=q.id
        and exists (
          select 1 from public.orders o
          where o.customer_id=cv.user_id and o.status='completed'
        )
    )
  from public.community_qr_codes q
  join public.communities c on c.id=q.community_id
  order by q.created_at desc;
end;
$$;

revoke all on function public.get_admin_community_qr_stats() from public;
grant execute on function public.get_admin_community_qr_stats() to authenticated;

insert into public.community_qr_codes(code,community_id,campaign_name,placement,source_type,active)
select
  'AMT-01',
  c.id,
  'Amin Model Town First Launch',
  'Community entrance / physical launch poster',
  'poster',
  true
from public.communities c
where c.slug='amin-model-town'
on conflict (code) do update set
  community_id=excluded.community_id,
  campaign_name=excluded.campaign_name,
  placement=excluded.placement,
  source_type=excluded.source_type,
  active=true,
  updated_at=now();
