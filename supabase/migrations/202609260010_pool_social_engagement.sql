create table if not exists public.pool_loves (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pool_id,user_id)
);

create table if not exists public.pool_item_loves (
  pool_item_id uuid not null references public.pool_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pool_item_id,user_id)
);

create table if not exists public.pool_reviews (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text null check (comment is null or char_length(comment) <= 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pool_id,user_id)
);

create table if not exists public.pool_item_reviews (
  pool_item_id uuid not null references public.pool_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text null check (comment is null or char_length(comment) <= 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pool_item_id,user_id)
);

create or replace function private.can_engage_pool(p_pool_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.pools p
    join public.profiles pr on pr.id=auth.uid()
    where p.id=p_pool_id and pr.community_id=p.community_id and pr.onboarding_completed_at is not null
  );
$$;

create or replace function private.can_engage_pool_item(p_pool_item_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.pool_items pi
    join public.pools p on p.id=pi.pool_id
    join public.profiles pr on pr.id=auth.uid()
    where pi.id=p_pool_item_id and pr.community_id=p.community_id and pr.onboarding_completed_at is not null
  );
$$;

create or replace function private.can_review_pool(p_pool_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.orders o where o.pool_id=p_pool_id and o.customer_id=auth.uid() and o.status='completed');
$$;

create or replace function private.can_review_pool_item(p_pool_item_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
    where oi.pool_item_id=p_pool_item_id and o.customer_id=auth.uid() and o.status='completed'
  );
$$;

grant execute on function private.can_engage_pool(uuid) to authenticated;
grant execute on function private.can_engage_pool_item(uuid) to authenticated;
grant execute on function private.can_review_pool(uuid) to authenticated;
grant execute on function private.can_review_pool_item(uuid) to authenticated;

alter table public.pool_loves enable row level security;
alter table public.pool_item_loves enable row level security;
alter table public.pool_reviews enable row level security;
alter table public.pool_item_reviews enable row level security;

drop policy if exists pool_loves_read on public.pool_loves;
create policy pool_loves_read on public.pool_loves for select to authenticated using (true);
drop policy if exists pool_loves_insert on public.pool_loves;
create policy pool_loves_insert on public.pool_loves for insert to authenticated with check (user_id=auth.uid() and private.can_engage_pool(pool_id));
drop policy if exists pool_loves_delete on public.pool_loves;
create policy pool_loves_delete on public.pool_loves for delete to authenticated using (user_id=auth.uid());

drop policy if exists pool_item_loves_read on public.pool_item_loves;
create policy pool_item_loves_read on public.pool_item_loves for select to authenticated using (true);
drop policy if exists pool_item_loves_insert on public.pool_item_loves;
create policy pool_item_loves_insert on public.pool_item_loves for insert to authenticated with check (user_id=auth.uid() and private.can_engage_pool_item(pool_item_id));
drop policy if exists pool_item_loves_delete on public.pool_item_loves;
create policy pool_item_loves_delete on public.pool_item_loves for delete to authenticated using (user_id=auth.uid());

drop policy if exists pool_reviews_read on public.pool_reviews;
create policy pool_reviews_read on public.pool_reviews for select to authenticated using (true);
drop policy if exists pool_reviews_insert on public.pool_reviews;
create policy pool_reviews_insert on public.pool_reviews for insert to authenticated with check (user_id=auth.uid() and private.can_review_pool(pool_id));
drop policy if exists pool_reviews_update on public.pool_reviews;
create policy pool_reviews_update on public.pool_reviews for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and private.can_review_pool(pool_id));

drop policy if exists pool_item_reviews_read on public.pool_item_reviews;
create policy pool_item_reviews_read on public.pool_item_reviews for select to authenticated using (true);
drop policy if exists pool_item_reviews_insert on public.pool_item_reviews;
create policy pool_item_reviews_insert on public.pool_item_reviews for insert to authenticated with check (user_id=auth.uid() and private.can_review_pool_item(pool_item_id));
drop policy if exists pool_item_reviews_update on public.pool_item_reviews;
create policy pool_item_reviews_update on public.pool_item_reviews for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and private.can_review_pool_item(pool_item_id));

grant select,insert,delete on public.pool_loves to authenticated;
grant select,insert,delete on public.pool_item_loves to authenticated;
grant select,insert,update on public.pool_reviews to authenticated;
grant select,insert,update on public.pool_item_reviews to authenticated;

create index if not exists pool_loves_pool_idx on public.pool_loves(pool_id);
create index if not exists pool_item_loves_item_idx on public.pool_item_loves(pool_item_id);
create index if not exists pool_reviews_pool_idx on public.pool_reviews(pool_id,created_at desc);
create index if not exists pool_item_reviews_item_idx on public.pool_item_reviews(pool_item_id,created_at desc);
