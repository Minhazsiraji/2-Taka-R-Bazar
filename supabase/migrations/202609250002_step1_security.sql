-- Keep household scope internally consistent. Customers may choose their community once
-- during onboarding, but cannot silently move themselves to another operating community.
create or replace function private.validate_profile_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_pickup_community uuid;
  v_pickup_active boolean;
begin
  if tg_op = 'UPDATE' and v_actor is not null and v_actor = old.id and not private.has_role(v_actor, 'admin') then
    if old.community_id is not null and new.community_id is distinct from old.community_id then
      raise exception 'Community cannot be changed after onboarding; contact operations';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Profile email follows the authenticated account';
    end if;
  end if;

  if new.pickup_point_id is not null then
    select community_id, active into v_pickup_community, v_pickup_active
      from public.pickup_points where id = new.pickup_point_id;
    if not found or not v_pickup_active then raise exception 'Pickup point is unavailable'; end if;
    if new.community_id is null or v_pickup_community is distinct from new.community_id then
      raise exception 'Pickup point must belong to the household community';
    end if;
  end if;

  if new.onboarding_completed_at is not null and (
    nullif(btrim(coalesce(new.full_name,'')), '') is null or
    nullif(btrim(coalesce(new.phone,'')), '') is null or
    nullif(btrim(coalesce(new.household_name,'')), '') is null or
    new.community_id is null or new.pickup_point_id is null
  ) then
    raise exception 'Complete name, phone, household, community and pickup point before onboarding';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_profile_scope() from public;
create trigger profiles_validate_scope before insert or update on public.profiles
  for each row execute function private.validate_profile_scope();

create or replace function private.has_role(p_user_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.user_roles r where r.user_id = p_user_id and r.role = p_role);
$$;
revoke all on function private.has_role(uuid,text) from public;
grant execute on function private.has_role(uuid,text) to authenticated;

create or replace function private.is_assigned_pickup(p_user_id uuid, p_pickup_point_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.has_role(p_user_id, 'admin') or exists(
    select 1 from public.pickup_operator_assignments a
    where a.user_id = p_user_id and a.pickup_point_id = p_pickup_point_id
  );
$$;
revoke all on function private.is_assigned_pickup(uuid,uuid) from public;
grant execute on function private.is_assigned_pickup(uuid,uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, email) values(new.id, new.email)
    on conflict (id) do update set email = excluded.email;
  insert into public.user_roles(user_id, role) values(new.id, 'customer')
    on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- RLS
alter table public.communities enable row level security;
alter table public.pickup_points enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.pickup_operator_assignments enable row level security;
alter table public.products enable row level security;
alter table public.market_price_observations enable row level security;
alter table public.market_price_benchmarks enable row level security;
alter table public.suppliers enable row level security;
alter table public.pools enable row level security;
alter table public.pool_items enable row level security;
alter table public.commitments enable row level security;
alter table public.supplier_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.fulfilments enable row level security;
alter table public.savings_ledger enable row level security;
alter table public.payment_records enable row level security;
alter table public.feedback enable row level security;
alter table public.operational_issues enable row level security;
alter table public.audit_events enable row level security;

-- Safe read entities for authenticated users.
create policy communities_read on public.communities for select to authenticated using (active or private.has_role((select auth.uid()), 'admin'));
create policy pickup_points_read on public.pickup_points for select to authenticated using (active or private.has_role((select auth.uid()), 'admin'));
create policy products_read on public.products for select to authenticated using (active or private.has_role((select auth.uid()), 'admin'));
create policy benchmarks_read on public.market_price_benchmarks for select to authenticated using ((approved and superseded_at is null) or private.has_role((select auth.uid()), 'admin'));

-- Private user-owned data.
create policy profiles_self_read on public.profiles for select to authenticated using ((select auth.uid()) = id or private.has_role((select auth.uid()), 'admin'));
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid()) = id or private.has_role((select auth.uid()), 'admin')) with check ((select auth.uid()) = id or private.has_role((select auth.uid()), 'admin'));
create policy roles_self_read on public.user_roles for select to authenticated using ((select auth.uid()) = user_id or private.has_role((select auth.uid()), 'admin'));
create policy pickup_assignments_self_read on public.pickup_operator_assignments for select to authenticated using ((select auth.uid()) = user_id or private.has_role((select auth.uid()), 'admin'));

-- Community-local pool visibility.
create policy pools_read on public.pools for select to authenticated using (
  private.has_role((select auth.uid()), 'admin') or community_id = (select p.community_id from public.profiles p where p.id = (select auth.uid()))
);
create policy pool_items_read on public.pool_items for select to authenticated using (
  private.has_role((select auth.uid()), 'admin') or exists(
    select 1 from public.pools po where po.id = pool_id and po.community_id = (select p.community_id from public.profiles p where p.id = (select auth.uid()))
  )
);

create policy commitments_read on public.commitments for select to authenticated using (customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin'));
create policy commitments_insert on public.commitments for insert to authenticated with check (customer_id = (select auth.uid()));
create policy commitments_update on public.commitments for update to authenticated using (customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin')) with check (customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin'));

create policy orders_read on public.orders for select to authenticated using (
  customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin') or private.is_assigned_pickup((select auth.uid()), pickup_point_id)
);
create policy order_items_read on public.order_items for select to authenticated using (exists(
  select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin') or private.is_assigned_pickup((select auth.uid()), o.pickup_point_id))
));
create policy fulfilments_read on public.fulfilments for select to authenticated using (exists(
  select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin') or private.is_assigned_pickup((select auth.uid()), o.pickup_point_id))
));
create policy savings_read on public.savings_ledger for select to authenticated using (customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin'));
create policy payments_read on public.payment_records for select to authenticated using (exists(select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin'))));
create policy feedback_read on public.feedback for select to authenticated using (customer_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin'));
create policy feedback_insert on public.feedback for insert to authenticated with check (
  customer_id = (select auth.uid()) and exists(
    select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()) and o.status = 'completed'
  )
);
create policy feedback_update on public.feedback for update to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()) and exists(
    select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()) and o.status = 'completed'
  ));
create policy issues_read on public.operational_issues for select to authenticated using (
  reported_by = (select auth.uid()) or private.has_role((select auth.uid()), 'admin')
);
create policy issues_insert on public.operational_issues for insert to authenticated with check (
  reported_by = (select auth.uid()) and (
    order_id is null or exists(
      select 1 from public.orders o where o.id = order_id and (
        o.customer_id = (select auth.uid()) or private.is_assigned_pickup((select auth.uid()), o.pickup_point_id)
      )
    )
  )
);

-- Admin-only commercial/operational tables and mutations.
create policy observations_admin on public.market_price_observations for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy suppliers_admin on public.suppliers for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy quotes_admin on public.supplier_quotes for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy audit_admin_read on public.audit_events for select to authenticated using (private.has_role((select auth.uid()), 'admin'));

create policy communities_admin_write on public.communities for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy pickup_points_admin_write on public.pickup_points for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy products_admin_write on public.products for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy benchmarks_admin_write on public.market_price_benchmarks for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy pools_admin_write on public.pools for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy pool_items_admin_write on public.pool_items for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy orders_admin_write on public.orders for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy fulfilments_admin_write on public.fulfilments for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy payments_admin_write on public.payment_records for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy pickup_assignments_admin_write on public.pickup_operator_assignments for all to authenticated using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));

-- Core transactional RPCs. Each SECURITY DEFINER function verifies auth/role and is not executable by anon/PUBLIC.
