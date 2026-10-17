# 2TBR real-customer order release | Operational runbook

**Status:** NOT LIVE. This document describes the controlled transition from existing synthetic Preview Commerce to a limited real-customer pilot. Never treat the successful synthetic suite as Production authorization. All real financial controls, original audit records, two real identity accounts, and approved storefront design remain protected.

## Product and launch scope

Initial authorized intended area: **Amin Model Town (AMT-01)**, not automatically nationwide.
Proposed owner retail prices (not yet real offers): Butter `BUTTER-EXC-1KG` **BDT 1,240 / 1 kg**; Ghee `GHEE-1KG-UNB-001` **BDT 1,450 / 1 kg**; Duck `DUC-ESC-001` **BDT 950 / kg**. Duck is **on HOLD** while product pack (`1 Pcs`) and unit (`Pcs/Kg`) differ from the approved per-kg sales unit and its recorded stock unit is unknown.

## P0 hard stops — all must pass BEFORE real Production checkout

1. Independently verify **physical custody and real stock**. Original site finance/commerce data was explicitly classified as synthetic, so saved `own_product_inventory.stock_on_hand` does not prove actual physical quantity. Verify SKU, batch, sealed packaging, location, received quantity in a single unit, expiry where applicable, cold chain for Duck, vendor ownership, receiving evidence and signed second-person stock review. Reject unverifiable inventory without deleting records. Separate historic synthetic stock adjustments from real opening stock in auditable entries.
2. Approve **real individual offers** by community with explicit expiry, verified real seller/custodian, valid physical stock reservation, permitted pickup/delivery, delivery charges, payment policy and independently checked retail price. Never reuse preview-only `is_synthetic=true` offers or stale benchmark figures. Maker cannot approve own price, stock, payment, purchase, return or refund.
3. Design, implement and test **separate Production Commerce authorization** at BOTH app and database. Existing `commerceEnabled()` requires Vercel Preview and a Preview secret; existing `private.commerce_assert_preview` verifies a Preview proof, and individual stored procedures explicitly reject non-synthetic carts/quotes/orders. Do not flip only one layer, copy Preview secret to Production, remove SQL guards, allow anonymous writes, or create live offers before end-to-end gates.
4. COD/cash-on-pickup checkout must create **unpaid** orders with server-calculated item prices and delivery charges. Payment `custody_recorded` only after original cash evidence; verification/journals follow independent Finance maker/checker. Do not mark COD paid on placement, supplier acceptance or delivery alone. No online gateway until proper configured provider, signed callbacks and idempotent webhook audit.
5. Reserve physical inventory with concurrent last-unit locking and rollback on failure/expiry/rejection; idempotent order creation and checkout; no negative stock, duplicate SKU reservations, duplicate COD, double refunds or unbalanced financial postings.
6. Honor verified customer community/household and address; browse without login, sign in at checkout; distinguish SOLO payable orders vs unpriced Pool/Group commitments (cannot charge until lock and explicit final confirmation).
7. Confirm operational receiving point, delivery service capacity, real service-area coverage, customer support, cancellation, returns/refunds, supplier SLA, order notifications and privacy/access scoping. Duck requires explicitly verified slaughter/packaging and refrigerated/frozen storage and delivery.
8. Full UAT on **disposable database** with real-order code in Preview: owner + different checker; guest→cart→sign-in→quote→COD order→supplier/inventory→pickup/delivery→COD evidence→independent financial review→returns/refund→reports; forced stale/expired quote, no GPS, cross-community, malicious supplier, concurrent last unit, duplicate checkout, declined credit, finance period close and backup restore.
9. Approve formal backup/rollback, verify active storefront hash/design, all checks of exact release SHA (typecheck, lint, build, database constraints, security, Finance, concurrency and browser 320/393/768/1024/1440 px EN/BN light/dark). Only then authorized Production database migration and controlled pilot. Confirm Vercel Production domain alias points to the qualified main SHA.
10. Rollback if any unauthorized purchase, oversell, price mismatch, finance journal/receipt mismatch, customer data leakage or disabled control. **Disable new order creation in both app + SQL** while retaining all historical orders and financial records; reconcile outstanding orders, never delete submitted orders as rollback.

## Precise current blockers — verified 2026-10-16

- Production DB has **zero** non-synthetic `commerce_offers` and **zero** non-synthetic `commerce_orders`.
- Stock recorded for three products but **no verified physical inventory evidence**, and Duck inventory-unit ambiguity.
- The current Purchase/Cart/Quote/Order/fulfillment/COD code is gated to synthetic Preview. Finance integration procedures are tested against UAT restrictions, not production real sale qualification.
- Website pricing fields, homepage cards and a green Preview build are **not** independent seller/stock/payment approval.

## Current read-only Owner monitoring

Open `/super-admin/commerce-release`. The Owner-only checklist is fail-closed and does not mutate Commerce, inventory, Finance or orders. Existing product and Pool admin remain the places to inspect catalog and operations; do not use `/commerce` synthetic-offer form to try to place real orders.

## References

- GitHub Issue #64 — unified Commerce operational release and negative paths.
- GitHub Issue #109 — pilot Buy Alone prices and release prerequisites.
- PR #110 — conditional Buy Alone CTA only for approved eligible Commerce offers; Production checkout still disabled.
- PR #111 and #113 — mobile review and synthetic form clarity fixes already live.
