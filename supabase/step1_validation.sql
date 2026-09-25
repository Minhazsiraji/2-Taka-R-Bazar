-- Run after migration/seed as an admin SQL validation aid.
-- Every exposed public table must have RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

-- Active benchmark uniqueness should exist.
select indexname, indexdef from pg_indexes where schemaname='public' and indexname='market_price_benchmarks_one_active';

-- Double-credit guard: unique order_item_id in savings_ledger.
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.savings_ledger'::regclass;
