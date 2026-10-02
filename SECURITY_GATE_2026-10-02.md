# Security Gate 2026-10-02

Scope: narrow production hardening only. Core pool, pricing, referral, payment, inventory, and household financial-sharing behavior are unchanged.

Changes:
- Upgrade Next.js from 16.3.6 to 16.3.8.
- Remove unintended anonymous EXECUTE privileges from eight SECURITY DEFINER RPCs while preserving authenticated access.
- Sanitize OTP verification errors shown to customers.
- Add regression coverage for the hardening migration and OTP error handling.

Accepted platform warning:
- `pg_net` remains in its existing Supabase-managed location because the installed extension is non-relocatable. Moving it would require dropping/recreating notification infrastructure and would violate the no-core-operation-change constraint.

Explicitly excluded by owner instruction:
- No change to `money_summary_sharing` default or related financial-sharing behavior.
