-- Service-role access is required by disposable end-to-end verification and trusted
-- server-side workflows. This is not a grant to anon or authenticated users.
-- Both tables remain RLS-protected and public clients remain read-only.
grant select on table public.simple_sale_commitment_items to service_role;
grant select on table public.simple_sale_commitment_delivery to service_role;
