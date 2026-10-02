-- Free My Money / family budget tracker for 2-TAKA-R-BAZAR customers.
-- Manual tracking only: no bank credentials, wallet custody, or payment execution.

create table if not exists public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('expense','income')),
  icon text,
  is_default boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name, kind),
  unique(id, user_id)
);

create table if not exists public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('expense','income')),
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  category_id uuid not null references public.money_categories(id) on delete restrict,
  transaction_date date not null default current_date,
  payment_method text not null default 'cash' check (payment_method in ('cash','mobile_wallet','bank','card','other')),
  note text check (note is null or char_length(note) <= 300),
  source text not null default 'manual' check (source in ('manual','bazar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.money_categories(id, user_id) on delete restrict
);

create table if not exists public.money_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.money_categories(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (month = date_trunc('month', month)::date),
  unique(user_id, category_id, month),
  foreign key (category_id, user_id) references public.money_categories(id, user_id) on delete cascade
);

create index if not exists money_transactions_user_date_idx
  on public.money_transactions(user_id, transaction_date desc, created_at desc);
create index if not exists money_transactions_user_category_idx
  on public.money_transactions(user_id, category_id, transaction_date desc);
create index if not exists money_budgets_user_month_idx
  on public.money_budgets(user_id, month);

create trigger money_categories_touch before update on public.money_categories
  for each row execute function private.touch_updated_at();
create trigger money_transactions_touch before update on public.money_transactions
  for each row execute function private.touch_updated_at();
create trigger money_budgets_touch before update on public.money_budgets
  for each row execute function private.touch_updated_at();

create or replace function private.seed_money_categories(p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.money_categories(user_id,name,kind,icon,is_default,sort_order)
  select p_user_id, v.name, v.kind, v.icon, true, v.sort_order
  from (values
    ('Groceries','expense','🛒',10), ('Food & Dining','expense','🍽️',20),
    ('Transport','expense','🚕',30), ('Rent / Home','expense','🏠',40),
    ('Utilities','expense','⚡',50), ('Education','expense','🎓',60),
    ('Healthcare','expense','🩺',70), ('Children','expense','👶',80),
    ('Shopping','expense','🛍️',90), ('Household','expense','🧹',100),
    ('Personal','expense','👤',110), ('Entertainment','expense','🎬',120),
    ('Travel','expense','✈️',130), ('Bills / Subscriptions','expense','🧾',140),
    ('Other','expense','•',150),
    ('Salary','income','💼',10), ('Business','income','🏪',20),
    ('Freelance','income','💻',30), ('Bonus / Gift','income','🎁',40),
    ('Other Income','income','💰',50)
  ) as v(name,kind,icon,sort_order)
  on conflict (user_id,name,kind) do nothing;
$$;
revoke all on function private.seed_money_categories(uuid) from public;

do $$ begin
  perform private.seed_money_categories(id) from public.profiles;
end $$;

create or replace function private.seed_money_categories_on_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.seed_money_categories(new.id);
  return new;
end;
$$;
revoke all on function private.seed_money_categories_on_profile() from public;

drop trigger if exists profiles_seed_money_categories on public.profiles;
create trigger profiles_seed_money_categories
  after insert on public.profiles
  for each row execute function private.seed_money_categories_on_profile();

alter table public.money_categories enable row level security;
alter table public.money_transactions enable row level security;
alter table public.money_budgets enable row level security;

create policy money_categories_select_self on public.money_categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy money_categories_insert_self on public.money_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy money_categories_update_self on public.money_categories
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy money_categories_delete_self on public.money_categories
  for delete to authenticated using (user_id = (select auth.uid()));

create policy money_transactions_select_self on public.money_transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy money_transactions_insert_self on public.money_transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy money_transactions_update_self on public.money_transactions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy money_transactions_delete_self on public.money_transactions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy money_budgets_select_self on public.money_budgets
  for select to authenticated using (user_id = (select auth.uid()));
create policy money_budgets_insert_self on public.money_budgets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy money_budgets_update_self on public.money_budgets
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy money_budgets_delete_self on public.money_budgets
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.money_categories, public.money_transactions, public.money_budgets from anon;
revoke all on public.money_categories, public.money_transactions, public.money_budgets from authenticated;
grant select, insert, update, delete on public.money_categories to authenticated;
grant select, insert, update, delete on public.money_transactions to authenticated;
grant select, insert, update, delete on public.money_budgets to authenticated;
