-- Allow authenticated admins to edit only safe pool setup columns while preserving
-- privilege hardening for lifecycle/status mutations. RLS still restricts writes
-- to admin-capable users through pools_admin_write.

grant update (
  title,
  cadence,
  opens_at,
  commitment_closes_at,
  confirmation_closes_at,
  supplier_delivery_at,
  pickup_at,
  receiving_pickup_point_id,
  notes
) on public.pools to authenticated;
