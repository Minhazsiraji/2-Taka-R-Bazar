# Consolidated storefront review candidate (five PRs)

Date: 2026-10-12

This isolated candidate is based on the qualified #61 commit `1ca209aca42e91288286fd19bcbdee01d42e04c2`. It **does not merge into main**, deploy database migrations to the hosted project, change Vercel Production aliases, or activate purchases.

## Reconciliation ledger

| PR | Integration decision | Evidence / remaining dependency |
| --- | --- | --- |
| #56 Own/exclusive carousel, details, image gallery and videos | Retain the admin-authenticated publishing action, published-only narrow guest RPC, product details and image/video gallery already carried into #61 | Real photos/videos and approval of non-demo products must be supplied before Production publication |
| #59 Bilingual hero, menu and demo buying experience | Use the revised #61 implementation with Bangla default, mobile menu and safe disabled sample buying | Demo-only representations cannot become live offers |
| #60 Approved responsive UI and Pool galleries | Keep #61 rendering and all eleven visual design-lock file hashes unchanged | Existing five-width light/dark browser CI remains mandatory |
| #61 Real catalog/Pool integration | Base of this candidate: guest RPCs, admin-selected ordered Pool images, safe community filtering and database-based counts/prices | Hosted migrations, verified non-demo stock/prices, authenticated buying/cart/settlement remain release blockers |
| #62 Verified professional contact emails | Keep the already approved footer text/links untouched and centralize business/support constants; Organization email is business and customer ContactPoint is support | Existing Cloudflare/Brevo are externally verified; no SMTP credentials or automatic mail sending is added |

## Invariants

- Approved CSS, hero, header and footer layout stay byte-for-byte intact under `scripts/check-home-design-lock.mjs`.
- Public product and Pool queries exclude inactive, unpublished/demo inventory. No fake stock, household counts, verified reviews, final prices or real orders.
- Preview demo purchasing remains disabled; the real Buy Alone and Group Buy purchase flow must not be enabled until the financial and security controls are qualified.
- Finance/Treasury PRs #54/#58 and their operating permissions are **not touched** by this candidate. Notifications PR #11 and Dependabot changes are outside this five-PR scope.

## Mandatory gates before release

1. CI exact candidate SHA: app tests, lint, TypeScript, build, production dependency audit, approved design lock, from-zero disposable DB/pgTAP, and browser at 360, 393, 768, 1440 and 1920 pixels (light/dark).
2. Verify Vercel Preview exact SHA and linked route navigation; perform review without signing into Production or importing synthetic data to hosted DB.
3. Hosted approved public storefront/showcase RPC and RLS qualification, no customer data leak, genuine products and availability with approved prices, eligible communities and valid fulfillment terms.
4. Complete Buy Alone and Group Buy authenticated reservation, quantity/cart, pricing, delivery, payment/refund/settlement reconciliation, fraud/idempotency/race protections and end-to-end UAT **in a separately qualified commerce release**. Until then keep purchase actions disabled.
5. Obtain final release decision for main/Production separately after outstanding hosted gates pass. Leave original PRs open/draft until reconciliation proof and review are accepted; close duplicates only after verifying the consolidated candidate contains their intended features.

This is an engineering consolidation and code-review candidate, not a certification that real commerce can accept orders today.
