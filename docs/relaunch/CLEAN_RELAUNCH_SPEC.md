# 2TBR Clean Relaunch — implementation contract
**Decision:** 18 October 2026. **Mode:** parallel rebuild, no Production cutover or DB deletion until independently qualified and expressly approved.

## Product rules — non-negotiable
- **Keep pixel-accurate approved landing experience** at `/`: existing `app/page.tsx`, `components/public-marketplace*.tsx`, public header/footer, homepage assets, logo, dark/light theme, mobile navigation, relevant `app/marketplace-*.css` and `app/site-*.css`. Never fabricate or recolor the official black basket-2 logo.
- Brand name **2-TAKA-R-BAZAR**. Permanent slogans **Smart shopping. Real savings!** / **একসাথে কিনি, কম দামে পাই!**. Preserve EN/BAN preference, English first visit, optional location selection, and browse-before-login.
- Only 3 user roles in new business model: **customer**, **admin**, **super_admin**. Super Admin creates, activates and revokes Admin accounts. Both Admin and Super Admin can create, edit, publish/unpublish products, normal offers, Group Deals, Pools; can review/confirm/cancel orders, record handover and verify payment.
- **NO finance module**: no chart of accounts, procurement, maker/checker treasury, loan, bank reconciliation, invoices-as-ledgers, payout approval queues or period closing. Minimal **payment status + immutable event history** remains necessary to avoid falsely marking unpaid orders completed.
- Pilot offers: **Buy Alone**, **Group Deals**, **Pools** (target-based, dated); own-held inventory, realistic quantity and sale price; no fabricated stock or branded rice claims.
- Customer: browse → product/cart → login once at placing → pickup or delivery address → submit order → track → pickup/delivery → payment verified → completed. Customers must never see "No orders" when they actually have an active order/commitment.
- Launch statuses: **placed**, **confirmed**, **preparing**, **ready_for_pickup** or **out_for_delivery**, **handed_over**, **completed**, **cancelled**. Admin UI can only move through valid transitions. **Payment:** unpaid → collected_pending_verification → verified. A completed order requires both handed_over and verified payment (or recorded free order, if deliberately supported).
- Price is an immutable **server-side snapshot** at order placement; frontend totals are display only. Prevent overselling via row locks/reservation, prevent double clicks via idempotency key, preserve order history, one customer sees only their own phone/address, audit status changes, prevent staff privilege escalation.

## DATA / CUTOVER SAFETY
Production project `sukabonfjcnaavjgjyuy` currently includes **134 public + 15 private application tables**, **21 authentication users**, **21 profiles**, and a confirmed pilot booking `FC7026B8`. On 18 October 2026 the owner explicitly classified all existing business records and all non-owner identities as dummy and authorized their removal, while requiring **his login** to survive. Preserve an encrypted rollback snapshot, not permanent reuse of those dummy records. **Do not delete the active project, Auth, Storage, existing rows or old routes while rebuilding.** The currently usable Super Admin identity has linked Google and phone sign-in; another Minhaz-labelled Google-only customer identity exists. Which exact auth account(s) to retain requires the owner's confirmation before any identity deletion. No current production mutation is authorized by this plan.
- Use a **new isolated Supabase project** when owner authorizes any incremental plan/cost, OR a **logically isolated versioned schema** inside the same project only after designing migration/backout and testing RLS. The first is cleaner; do not silently create billable resources.
- Before cutover: export a secured full rollback snapshot of current Auth, roles, profiles, storage assets, catalog and the pilot booking trail; restore-test it in isolation. New clean Production should migrate **only the explicitly identified owner login/auth identity** (with its Google/phone provider links, role bootstrap and minimal profile details). All other records are owner-classified dummy; purge from the replacement only after account identity confirmation and functional release checks. Never paste credentials, personal information or backups into GitHub.
- Seed exactly approved Super Admin accounts by existing auth UUID; do not grant admin by email substring or via self-signup. Existing Google OAuth verified brand remains intact; if project auth host changes, stage Google callback migration with new and returning user tests first.
- Delete/retire all dummy business tables and dummy Auth identities only at the approved, reversible cutover after verified backup/restore and owner account login tests. No unconditional `DROP SCHEMA public CASCADE`, `TRUNCATE auth.users`, deletion of the active Supabase project, or disabling RLS.
- Production alias `2takarbazar.com` must remain on known-good site while the rebuild is under CI + isolated Preview. Switch with a reversible release/rollback checklist and explicit owner's go-live authorization.

## SIMPLE INFORMATION ARCHITECTURE
Customer: **Home**, Product/Offer detail, Group Deals, Pools, Cart, Checkout, My Orders, Profile.
Staff: **Dashboard**, Products, Offers/Deals/Pools, Orders, Payments & Handover (order-linked statuses only), Customers. Super Admin adds **Manage Admins**. No dedicated Finance dashboards.
Backend tables planned (≤9): `store_users`, `store_products`, `store_offers`, `store_offer_items`, `store_orders`, `store_order_items`, `store_order_events`, `store_payments` (+optional stock movements if needed).
- Normal offer = fixed price. Group Deal/Pool = offer with minimum participants/quantity and closing time; expose progress, never claim unlocked until condition true. Publish and capacity gates are server-side.
- Full commerce records must be durable and queryable before any order button is enabled.

## CHECKLIST / RELEASE GATES
1. Lock original homepage screenshots and CSS; capture mobile, tablet and desktop reference, preserve header/footer.
2. Review clean schema/RLS, set role bootstrap, product and stock unit handling (Duck = per kg), test zero/negative inventory, concurrent checkout, duplicate submit, staff/admin/customer isolation, cancellation reversal.
3. Implement public catalog, actual cart, checkout and one clear My Orders view. No legacy links or redundant booking/order systems on new site.
4. Implement Super Admin staff management; staff CRUD/publish products/offers/group deals/pools; live orders inbox, handover and payment verification with audit.
5. Browser UAT: new Google user and returning customer, owner Admin and Super Admin, mobile, cart→order→confirmation→handover→payment→completed; BDT 0 delivery, payment pending/verified, cancel, out-of-stock, returns/status.
6. Full database reset/restore rehearsal, SQL security tests, TypeScript/lint/build, staged domain and rollback.
7. Present owner with actual Preview URL, test evidence and the exact masked identity to retain; obtain confirmation of which owner login (Super Admin linked to Google+phone, or additional Google-only account) survives. Request **final destructive cutover approval**. Only after approval: switch traffic, archive and purge dummy records with restore tested. Never claim ready before evidence.

## Cutover decision still needed
Owner must select where to host clean application data: **(A) fresh Supabase project** (cleanest, may have charges and OAuth migration), or **(B) isolated fresh v2 application tables in existing project** (keeps OAuth/accounts/domain and avoids another subscription; old tables archived after qualified cutover). Recommended **B for fast pilot**, with strict isolation and later archive cleanup. No financial approval queue in either.
