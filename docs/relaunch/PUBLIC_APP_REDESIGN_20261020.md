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

## Separate mobile follow-up (after website qualification)

Owner also requested the existing Expo dock closer to the bottom safe-area edge, with stronger frosted glass. This must be implemented on a separate mobile branch from PR #123, with mobile checks and an internal Expo OTA update only. It must preserve the approved five destinations, exact hero/logo, and current Expo project/channel/runtime. No native files belong in this web PR. Do not claim an OTA has shipped until its update ID and channel have been verified.
