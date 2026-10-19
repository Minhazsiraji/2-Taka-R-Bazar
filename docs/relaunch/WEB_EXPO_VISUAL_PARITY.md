# Web → Expo visual parity (Issue #126, 2026-10-19)

**Owner direction:** The accepted Expo Android Home is the authority for the website. Website design changes take priority over further backend work. Preserve native Home acceptance and keep production untouched.

## Stacked implementation
- Parent/base: PR #124 (`feat/approved-unified-home-savings-121`) on clean relaunch PR #122; this is a visual-only stacked PR until qualified.
- Reuses exact existing mobile image Git blob: `mobile/assets/2tbr-hero-panorama-v2.jpg` → `public/2tbr-app-hero.jpg`; no invented assets, redesigned logo or rasterized interface.
- First-slide copy and four English/Bangla carousel slides use the same accepted mobile content in `mobile/src/content.ts`.
- Browser hero full-bleed background avoids the React Native padded-box clipping issue; controls are centered below the CTA and remain actual accessible buttons.
- Four saving tiles use the original verified backend values/null unavailable states (never app demo values). Visible unavailable explanatory text remains accessible and readable.
- Keeps existing communities, search, listings, price/stock disclosure rules, real clickable actions, mobile dock, permanent slogans, user theme preference and authenticated safe UI.
- New CSS `app/marketplace-expo-parity.css` is imported **last** in the site layout to override old Home-only styling, scoped to `main.public-marketplace-flat`.

## Acceptance needed
Review Vercel Preview at phone 320/360/390/412px, tablet 768/820px, and desktop 1024/1440px in EN/BN and both themes. Check no overflow, static full cart, valid carousel controls, label readability, real price-only cards and logged-out savings unavailable state. Capture matching screenshots against installed app. Do not merge or deploy production before owner acceptance. Do not touch Auth, SQL, checkout, Finance, admin, or releases.

## Baseline reference
Owner-accepted native PR #123 commit `75c083a83d7e8081d7a1bb5b9749441f708f19ab`, Expo preview group `d6117ac4-4ac7-4f7d-a424-3e4640ce76c2`.

## Owner refinement 2026-10-19 (seven UI changes)
- Compact desktop first-row header with search, Cart and My Money, responsive compact mobile header with dock preserved.
- Rounded right-hand area-picker popover on desktop, native touch-friendly select on phone.
- Four Savings values remain verified/unavailable; panel height reduced without inventing balances.
- Up to six genuine active Group Deals in a three-card-per-row laptop grid, not six synthetic deals.
- Four Exclusive products per desktop row in taller app-style cards; unpriced CTA is View details, never Ask for Price.
- Web applies same Inter / Hind Siliguri type families as Expo with fallbacks.
- Pools keep 3 genuine pictures, tier/deadline, membership and progress; no fabricated activity.
- Release requires CI, Vercel Preview and owner device/browser acceptance, Production unchanged.
