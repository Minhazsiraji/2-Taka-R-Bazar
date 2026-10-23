-- Service role is used by isolated synthetic browser UAT and trusted server
-- workflows. Do not grant writes to authenticated/anon customers.
grant select on public.simple_sale_commitment_items to service_role;
grant select on public.simple_sale_commitment_delivery to service_role;
