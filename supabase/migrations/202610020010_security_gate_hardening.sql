-- Safety & Security Gate hardening.
-- Scope: privilege tightening only; no business/pool/pricing/referral behavior changes.

-- Remove unintended anonymous EXECUTE grants from SECURITY DEFINER RPCs.
-- Authenticated access remains unchanged and each RPC keeps its existing caller checks.
revoke execute on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid) from anon;
revoke execute on function public.get_pool_participation(uuid) from anon;
revoke execute on function public.get_push_public_key() from anon;
revoke execute on function public.has_push_subscription() from anon;
revoke execute on function public.mark_all_notifications_read() from anon;
revoke execute on function public.mark_notification_read(uuid) from anon;
revoke execute on function public.remove_push_subscription(text) from anon;
revoke execute on function public.save_push_subscription(text,text,text,text) from anon;

-- Defense in depth: prevent generic PUBLIC execution from being inherited later.
revoke execute on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid) from public;
revoke execute on function public.get_pool_participation(uuid) from public;
revoke execute on function public.get_push_public_key() from public;
revoke execute on function public.has_push_subscription() from public;
revoke execute on function public.mark_all_notifications_read() from public;
revoke execute on function public.mark_notification_read(uuid) from public;
revoke execute on function public.remove_push_subscription(text) from public;
revoke execute on function public.save_push_subscription(text,text,text,text) from public;

-- Keep the intended signed-in application contract explicit.
grant execute on function public.admin_broadcast_notification(text,text,text,text,uuid,uuid) to authenticated;
grant execute on function public.get_pool_participation(uuid) to authenticated;
grant execute on function public.get_push_public_key() to authenticated;
grant execute on function public.has_push_subscription() to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.save_push_subscription(text,text,text,text) to authenticated;
