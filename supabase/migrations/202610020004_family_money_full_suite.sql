-- Expand My Money into a full free household finance utility.
-- Manual-only: no bank credentials, wallet custody, or external payment execution.

create table public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  account_type text not null default 'cash' check (account_type in ('cash','bank','credit_card','mobile_wallet','other')),
  opening_balance numeric(14,2) not null default 0 check (abs(opening_balance) <= 1000000000),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name), unique(id,user_id)
);

create table public.money_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_default boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name), unique(id,user_id)
);

alter table public.money_transactions add column account_id uuid;
alter table public.money_transactions add column person_id uuid;
alter table public.money_transactions add column description text;
alter table public.money_transactions add constraint money_transactions_account_user_fk foreign key (account_id,user_id) references public.money_accounts(id,user_id) on delete restrict;
alter table public.money_transactions add constraint money_transactions_person_user_fk foreign key (person_id,user_id) references public.money_people(id,user_id) on delete restrict;
alter table public.money_transactions add constraint money_transactions_description_length check (description is null or char_length(description) <= 120);

create table public.money_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  transfer_date date not null default current_date,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  foreign key (from_account_id,user_id) references public.money_accounts(id,user_id) on delete restrict,
  foreign key (to_account_id,user_id) references public.money_accounts(id,user_id) on delete restrict
);

create table public.money_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('expense','income')),
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  category_id uuid not null,
  account_id uuid not null,
  person_id uuid not null,
  frequency text not null default 'monthly' check (frequency in ('weekly','monthly','yearly')),
  start_date date not null default current_date,
  end_date date,
  next_due_date date not null default current_date,
  description text check (description is null or char_length(description) <= 120),
  note text check (note is null or char_length(note) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  foreign key (category_id,user_id) references public.money_categories(id,user_id) on delete restrict,
  foreign key (account_id,user_id) references public.money_accounts(id,user_id) on delete restrict,
  foreign key (person_id,user_id) references public.money_people(id,user_id) on delete restrict
);

create table public.money_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('savings','emergency')),
  account_id uuid,
  target_amount numeric(14,2) check (target_amount is null or target_amount > 0),
  monthly_target numeric(14,2) check (monthly_target is null or monthly_target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,goal_type),
  foreign key (account_id,user_id) references public.money_accounts(id,user_id) on delete set null
);

create index money_accounts_user_idx on public.money_accounts(user_id,active,sort_order);
create index money_people_user_idx on public.money_people(user_id,active,sort_order);
create index money_transfers_user_date_idx on public.money_transfers(user_id,transfer_date desc,created_at desc);
create index money_recurring_user_due_idx on public.money_recurring(user_id,active,next_due_date);
create index money_transactions_user_account_idx on public.money_transactions(user_id,account_id,transaction_date desc);
create index money_transactions_user_person_idx on public.money_transactions(user_id,person_id,transaction_date desc);

create trigger money_accounts_touch before update on public.money_accounts for each row execute function private.touch_updated_at();
create trigger money_people_touch before update on public.money_people for each row execute function private.touch_updated_at();
create trigger money_recurring_touch before update on public.money_recurring for each row execute function private.touch_updated_at();
create trigger money_goals_touch before update on public.money_goals for each row execute function private.touch_updated_at();

create or replace function private.seed_money_suite_defaults(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.money_accounts(user_id,name,account_type,opening_balance,sort_order) values(p_user_id,'Cash','cash',0,10) on conflict (user_id,name) do nothing;
  insert into public.money_people(user_id,name,is_default,sort_order) values(p_user_id,'Me',true,10),(p_user_id,'Shared',true,20) on conflict (user_id,name) do nothing;
  insert into public.money_categories(user_id,name,kind,icon,is_default,sort_order) values
    (p_user_id,'Gifts','expense','🎁',true,125),
    (p_user_id,'Insurance','expense','🛡️',true,135),
    (p_user_id,'Subscriptions','expense','🔁',true,145)
  on conflict (user_id,name,kind) do nothing;
end;
$$;
revoke all on function private.seed_money_suite_defaults(uuid) from public;

do $$ begin perform private.seed_money_suite_defaults(id) from public.profiles; end $$;

update public.money_transactions t set account_id=a.id from public.money_accounts a where t.account_id is null and a.user_id=t.user_id and a.name='Cash';
update public.money_transactions t set person_id=p.id from public.money_people p where t.person_id is null and p.user_id=t.user_id and p.name='Me';
alter table public.money_transactions alter column account_id set not null;
alter table public.money_transactions alter column person_id set not null;

create or replace function private.seed_money_suite_defaults_on_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.seed_money_suite_defaults(new.id); return new; end;
$$;
revoke all on function private.seed_money_suite_defaults_on_profile() from public;
drop trigger if exists profiles_seed_money_suite_defaults on public.profiles;
create trigger profiles_seed_money_suite_defaults after insert on public.profiles for each row execute function private.seed_money_suite_defaults_on_profile();

alter table public.money_accounts enable row level security;
alter table public.money_people enable row level security;
alter table public.money_transfers enable row level security;
alter table public.money_recurring enable row level security;
alter table public.money_goals enable row level security;
create policy money_accounts_self on public.money_accounts for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy money_people_self on public.money_people for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy money_transfers_self on public.money_transfers for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy money_recurring_self on public.money_recurring for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy money_goals_self on public.money_goals for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

revoke all on public.money_accounts,public.money_people,public.money_transfers,public.money_recurring,public.money_goals from anon;
revoke all on public.money_accounts,public.money_people,public.money_transfers,public.money_recurring,public.money_goals from authenticated;
grant select,insert,update,delete on public.money_accounts to authenticated;
grant select,insert,update,delete on public.money_people to authenticated;
grant select,insert,update,delete on public.money_transfers to authenticated;
grant select,insert,update,delete on public.money_recurring to authenticated;
grant select,insert,update,delete on public.money_goals to authenticated;
