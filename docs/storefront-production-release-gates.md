# Storefront production release gates — 12 October 2026

Approved Home visual baseline: `452c8cc98542b86187a61150a22cb261569412ae`.
User authorized backend integration, release checks, then main/Production release. Approval is recorded in `approved-home-design-lock.json`; CI enforces its presentation hashes. Data, navigation and authorization behavior may change without changing the approved visual design.

## Implemented in the integration candidate
- Existing guest catalog, community and exclusive-showcase migrations remain required, narrow public projections; no raw customer/location/supplier tables opened.
- Real featured Pool read model and admin publication controls with up to three ordered images, ownership-in-Pool validation, active/non-demo product validation and default unpublished state.
- Home consumes the real Pool projection with community filtering. It uses database prices/household counts and preserves null/unpublished prices instead of applying Preview formulas to real Pools.
- Closed commitment/confirmation windows excluded from public offer browsing; deactivated or invalid image selections suppress stale publication.
- Existing verified Pool/Group Deal participation flows retained. Publication changes cannot modify orders, inventory, prices or finance entries.
- Brand contact metadata now uses support@2takarbazar.com, matching the approved footer.
- Twenty disposable database assertions cover publication authorization, invalid/duplicate/demo images, empty/unpublished catalog, expired windows and privacy.

## Gate status
- Approved presentation lock, 235 application tests, TypeScript, lint and build: passed locally.
- Fresh isolated database migrations and pgTAP: require candidate CI result; not inferred from local source checks.
- Hosted real-data browser/mobile integration: pending DB qualification. Existing Preview remains illustrative when no real offers exist.
- Connected production DB has zero active non-demo products and no storefront/showcase public RPCs. Sample data must not be promoted or represented as real stock.
- Buy Alone order/cart lifecycle for both owned and supplier stock remains absent: approved price/availability, idempotent reservations, supplier acceptance, fulfillment/payment/refund/finance reconciliation and race/oversell tests remain mandatory. The existing UI correctly keeps this capability disabled.
- No Production migration, main merge or Production alias change is allowed until the required gates pass. This records the user's requested gate sequence; it does not withdraw release authorization or require another cosmetic approval.

## Required commercial inputs
Authorized non-demo products with genuine current solo/group quotes, stock or supplier availability, community coverage and fulfillment schedule. Do not invent these from the Preview fixtures or market benchmarks.
