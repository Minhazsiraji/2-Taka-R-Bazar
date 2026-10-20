# Public app design continuation — 20 October 2026

Authority: owner's attached FINAL WEB REDESIGN IMPLEMENTATION brief. Continue Draft PR #127 on `feat/web-parity-approved-expo-ui-v1`; parent #124 and relaunch #122 remain unmerged.

## Scope delivered

- Canonical public-only Expo tokens (`#F4F1F6` light, `#0D1424` dark, card/text/line/field colors), consistent forms, cards, controls and footer; staff, Admin, Finance and Treasury frames excluded.
- Compact responsive main header, working search from inner pages, Account disclosure with member-only destinations and sign out, My Money removed from standalone header controls. Login-only “Join the pool”; secondary public navigation removed.
- Locally served Inter and Hind Siliguri in 400/500/600/700 with Fontsource OFL notices. CSP stays unchanged.
- Four compact verified/unavailable savings tiles and correct savings detail destination.
- Group Deals retain genuine records, confirmed/reference prices and verifiable savings; future tier prices remain pending. Closed/synthetic/unavailable states do not expose active joining.
- Exclusive cards retain actual published data, show separate details and validated cart actions, and keep non-buyable cart controls disabled. Existing pilot booking remains a separate valid link.
- Pool cards preserve up to three genuine images and real participation. Missing public target remains “Target not published”; no fabricated target of one. Next savings appear only when supplied by the public model.
- Same Home/Pools/Deals/Exclusive/Cart public dock on all customer pages, flush with safe-area bottom edge. Staff dock destinations remain unchanged.
- Hero artwork, four messages, geometry and controls retained unchanged.

## Qualification

Run application tests, design lock, TypeScript, repository lint and Next production build. New rendered tests cover price pending vs unlocked, synthetic restrictions, missing Pool target, priced/stock cart eligibility, guest/member Account destinations and auth header structure.

`tests/public-app-browser-uat.mjs` runs a production Next server against an isolated, read-only local HTTP fixture, never the hosted database. It checks ten requested widths and both themes/languages on public routes, screenshots selected widths, search, hero, Account disclosure, dock, typography, and auth controls. Existing protected application regression suites remain in place.

Preview-only approval gate: hosted Vercel must be READY at the final branch commit, followed by actual hosted visual inspection. Vercel authentication/access limitations must be reported; do not disable protection or mark unperformed checks as passed.

No schema, Auth records, RLS, orders, inventory, financial calculations, permissions or backend code changed. No new paid service, merge to main or Production release authorized.

## Final owner refinements — Pasted text(2).txt

- One glass search frame with bare SVG search/submit icons. Both Enter and arrow retain the existing submit handlers.
- Public header actions enlarged about 11–13%: 40px desktop, 34px tablet, 31px phone. DOM/focus order is Cart, language, theme, notifications, Account, Menu (Cart stays in the existing dock on phones).
- Community row spans the same content edge as the hero; the trigger stays at its far-right boundary. Existing location, area selection/persistence and keyboard controls are unchanged.
- Legacy broad theme selectors explicitly exclude `main.public-marketplace-flat`, retiring opaque public overrides without changing their staff/Admin/Finance/Treasury declarations.
- Reusable alpha glass/input/menu surfaces, thin white rim, static inner reflection and restrained shadow in the canonical public CSS. White rims have a fine contrasting shadow on light pages. Card blur stays off; only dropdowns use 8px blur. Primary teal controls and neutral photo surfaces stay readable.
- Join action shortened to “Join Deal →” / “ডিলে যোগ দিন →”, nowrap. Existing links and all unavailable/demo/closed restrictions are retained.
- Approved logo, slogans, hero geometry/content, compact Savings, responsive grids and public mobile dock preserved. All other design-lock hashes remain intact; only the explicitly approved header and canonical public CSS hashes are updated.

Regression qualification covers rendered header/focus order, restricted vs joinable deals, bare search icon surfaces, alpha panels/white rims, selector alignment, header control bounds, one-line bilingual join labels, search through Enter/arrow, and the existing responsive/route/theme/language checks. No real account login, cart mutation, order or payment is performed.

## Native app scope

The owner now confirms the Expo Android dock is acceptable. No native dock change, Expo OTA or mobile file change belongs to this web task. This supersedes the earlier separate-dock follow-up note.
