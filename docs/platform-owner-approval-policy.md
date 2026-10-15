# 2TBR owner authority and approval policy (Issue #96)

## Identity, not merely title

The platform **Owner** is one explicitly bound account in `private.platform_owner_identity`, and that account must also hold `super_admin`. Adding a separate Super Admin does not grant ownership. Client-side checks only affect UX; the authoritative publication decision is database-enforced.

## Product catalog / bilingual SEO publication (implemented)

- Verified Owner editing their own product content may save a draft or explicitly choose **Save & publish now**, without a second content reviewer.
- Existing Owner-authored content already in `review` may publish directly with the same action. The app never automatically publishes previously saved content merely because a migration runs.
- Admin/staff/non-owner Super Admin submissions remain in `review`, and a separate Super Admin must approve them. Self-approval by another Super Admin is not allowed.
- All submissions, including the Owner's, must pass verified specifications, bilingual content minimums, internal supplier facts, non-demo active product status and genuine master-image presence.
- Owner publication is audited as `published`, with the owner as actor and an explicit direct-publication note; it does not falsely assign an independent reviewer.
- Owner direct publication exposes **informational** product pages only. Listing a product in a Pool, Group Deal, exclusive showcase, or enabling checkout still requires their separate eligibility and publication controls.

## Other approval systems

Owner direct-publishing is currently implemented for Product SEO/catalog content **only**, not as a broad bypass of other approval RPCs. Non-financial operational workflow extensions require separate analysis and end-to-end tests, and must verify both the identity and original author.

Finance/Treasury/Procurement/period close and commerce/stock/offer approval routines have money movement, inventory or purchase side effects. They retain independent maker-checker and release qualifications, pending an explicit separately reviewed change. A generic owner role cannot silently bypass them. Production purchases remain disabled.

## Rollout and tests

- Migration bootstraps Owner identity only if exactly one Super Admin exists; other configurations fail closed and need separate explicit secure provisioning.
- Disposable pgTAP verifies owner draft/review publication, staff isolation, non-owner Super Admin, evidence and image constraints, and auditing.
- Application, database and browser CI must pass before merge; production schema migration and deployment must be verified independently.
