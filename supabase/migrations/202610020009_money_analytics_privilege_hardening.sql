revoke execute on function public.set_my_money_summary_sharing(boolean) from anon;
revoke execute on function public.super_admin_money_family_financials(date) from anon;
revoke execute on function public.super_admin_money_family_usage(date) from anon;

-- Signed-in callers still use the RPC surface, while each privileged report
-- enforces its own Super Admin role check inside the SECURITY DEFINER body.
