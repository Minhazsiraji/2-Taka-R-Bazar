-- Latest external-threat hardening.
-- No business, pool, pricing, referral, payment, delivery or My Money behavior changes.

-- Private SECURITY DEFINER helpers should not inherit generic caller execution.
revoke execute on all functions in schema private from public, anon, authenticated;

-- RLS policies intentionally call only these authenticated helper functions.
grant execute on function private.has_role(uuid,text) to authenticated;
grant execute on function private.is_assigned_pickup(uuid,uuid) to authenticated;
grant execute on function private.can_engage_pool(uuid) to authenticated;
grant execute on function private.can_engage_pool_item(uuid) to authenticated;
grant execute on function private.can_review_pool(uuid) to authenticated;
grant execute on function private.can_review_pool_item(uuid) to authenticated;

-- The retired overload only raises an error and should not remain part of the client RPC surface.
revoke execute on function public.admin_finalize_pool_item(uuid,uuid,numeric,text) from public,anon,authenticated;

-- Prevent future migrations from silently publishing new functions by default.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public;
alter default privileges for role postgres in schema private
  revoke execute on functions from anon, authenticated;
