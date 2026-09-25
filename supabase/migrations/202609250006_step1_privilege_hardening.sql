-- Route sensitive state changes through guarded transactional RPCs rather than direct table writes.
-- Read access remains controlled by RLS; admin CRUD remains available only where the Step-1 UI needs it.

revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;
revoke insert, update, delete on public.fulfilments from authenticated;
revoke insert, update, delete on public.payment_records from authenticated;
revoke insert, update, delete on public.savings_ledger from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;
revoke insert, update, delete on public.commitments from authenticated;

-- Pools and pool items are created by admins directly while draft, but lifecycle/final-price mutations use RPCs.
revoke update, delete on public.pools from authenticated;
revoke update, delete on public.pool_items from authenticated;

-- Benchmarks are created/superseded only through admin_approve_benchmark().
revoke insert, update, delete on public.market_price_benchmarks from authenticated;

-- Supplier quotes are entered directly but selection/finalization is RPC-owned.
revoke update, delete on public.supplier_quotes from authenticated;
