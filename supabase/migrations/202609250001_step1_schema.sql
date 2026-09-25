-- 1TAKA BazarPool Step 1 core schema
-- PostgreSQL / Supabase. All exposed public tables use RLS.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  name text not null,
  contact_name text,
  contact_phone text,
  address text not null,
  google_maps_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  opening_hours text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text unique,
  household_name text,
  community_id uuid references public.communities(id) on delete restrict,
  pickup_point_id uuid references public.pickup_points(id) on delete set null,
  address_hint text,
  google_maps_url text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('customer','admin','pickup_operator')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.pickup_operator_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  pickup_point_id uuid not null references public.pickup_points(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pickup_point_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text not null,
  package_size text not null,
  unit text not null,
  image_url text,
  sku text not null unique,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.market_price_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  community_id uuid not null references public.communities(id) on delete restrict,
  observed_price numeric(12,2) not null check (observed_price > 0),
  source_store text not null,
  observed_on date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.market_price_benchmarks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  community_id uuid not null references public.communities(id) on delete restrict,
  benchmark_price numeric(12,2) not null check (benchmark_price > 0),
  method text not null default 'approved local-market benchmark',
  approved boolean not null default true,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  effective_from date not null default current_date,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index market_price_benchmarks_one_active
  on public.market_price_benchmarks(product_id, community_id)
  where approved = true and superseded_at is null;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_person text,
  mobile text,
  location text,
  product_categories text,
  notes text,
  reliability_status text not null default 'unrated' check (reliability_status in ('unrated','reliable','watch','blocked')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  title text not null,
  status text not null default 'draft' check (status in ('draft','open','pricing','final_price','confirmation','ordered','ready_for_pickup','completed','cancelled')),
  opens_at timestamptz,
  commitment_closes_at timestamptz,
  confirmation_closes_at timestamptz,
  pickup_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pool_items (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  benchmark_id uuid references public.market_price_benchmarks(id) on delete restrict,
  benchmark_price_snapshot numeric(12,2) not null check (benchmark_price_snapshot > 0),
  expected_pool_price numeric(12,2) check (expected_pool_price is null or expected_pool_price > 0),
  final_customer_price numeric(12,2) check (final_customer_price is null or final_customer_price > 0),
  min_quantity integer not null default 1 check (min_quantity > 0),
  max_quantity integer not null default 20 check (max_quantity >= min_quantity),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pool_id, product_id)
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  pool_item_id uuid not null references public.pool_items(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null check (quantity > 0 and quantity <= 100),
  status text not null default 'active' check (status in ('active','withdrawn','confirmed','cancelled')),
  committed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(pool_item_id, customer_id)
);

create table public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  pool_item_id uuid not null references public.pool_items(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  quoted_unit_price numeric(12,2) not null check (quoted_unit_price > 0),
  delivery_cost numeric(12,2) not null default 0 check (delivery_cost >= 0),
  landed_unit_price numeric(12,2) not null check (landed_unit_price > 0),
  available_quantity integer check (available_quantity is null or available_quantity >= 0),
  delivery_date date,
  payment_terms text,
  valid_until date,
  notes text,
  selected boolean not null default false,
  selection_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.pool_items add column selected_supplier_quote_id uuid references public.supplier_quotes(id) on delete set null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default ('BP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_id uuid not null references auth.users(id) on delete restrict,
  pool_id uuid not null references public.pools(id) on delete restrict,
  pickup_point_id uuid not null references public.pickup_points(id) on delete restrict,
  status text not null default 'confirmed' check (status in ('confirmed','ordered','ready_for_pickup','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','payment_pending','paid_manually','cash_on_pickup','refunded','waived_test_order')),
  payment_method text,
  payment_reference text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  confirmed_at timestamptz not null default now(),
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id, pool_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  pool_item_id uuid not null references public.pool_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  benchmark_price_snapshot numeric(12,2) not null check (benchmark_price_snapshot > 0),
  unit_price numeric(12,2) not null check (unit_price > 0),
  expected_saving numeric(12,2) not null default 0 check (expected_saving >= 0),
  created_at timestamptz not null default now(),
  unique(order_id, pool_item_id)
);

create table public.fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  pickup_point_id uuid not null references public.pickup_points(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','ready','collected','issue','cancelled')),
  collected_at timestamptz,
  collected_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.savings_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  community_id uuid not null references public.communities(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  benchmark_price numeric(12,2) not null check (benchmark_price > 0),
  pool_unit_price numeric(12,2) not null check (pool_unit_price > 0),
  fulfilled_quantity integer not null check (fulfilled_quantity > 0),
  amount numeric(12,2) not null check (amount > 0),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('unpaid','payment_pending','paid_manually','cash_on_pickup','refunded','waived_test_order')),
  method text,
  reference_number text,
  amount numeric(12,2) check (amount is null or amount >= 0),
  recorded_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  testimonial_permission boolean not null default false,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, customer_id)
);

create table public.operational_issues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  pool_id uuid references public.pools(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  issue_type text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','investigating','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_community_idx on public.profiles(community_id);
create index pools_community_status_idx on public.pools(community_id, status);
create index commitments_customer_idx on public.commitments(customer_id, status);
create index commitments_pool_item_idx on public.commitments(pool_item_id, status);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_pickup_status_idx on public.orders(pickup_point_id, status);
create index savings_customer_verified_idx on public.savings_ledger(customer_id, verified_at desc);
create index savings_community_verified_idx on public.savings_ledger(community_id, verified_at desc);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger communities_touch before update on public.communities for each row execute function private.touch_updated_at();
create trigger pickup_points_touch before update on public.pickup_points for each row execute function private.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function private.touch_updated_at();
create trigger suppliers_touch before update on public.suppliers for each row execute function private.touch_updated_at();
create trigger pools_touch before update on public.pools for each row execute function private.touch_updated_at();
create trigger pool_items_touch before update on public.pool_items for each row execute function private.touch_updated_at();
create trigger commitments_touch before update on public.commitments for each row execute function private.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function private.touch_updated_at();
create trigger fulfilments_touch before update on public.fulfilments for each row execute function private.touch_updated_at();
create trigger feedback_touch before update on public.feedback for each row execute function private.touch_updated_at();
create trigger issues_touch before update on public.operational_issues for each row execute function private.touch_updated_at();
