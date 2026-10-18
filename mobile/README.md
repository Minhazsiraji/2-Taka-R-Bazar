# 2TBR Android + iOS — locked-design mobile foundation

This is a **native cross-platform Expo / React Native app** at \`mobile/\`, entirely isolated from the Next.js website. It is not a WebView wrapping the storefront. No existing website UI, orders, finance or SQL migrations are changed.

## Current state

- Approved header: original brand mark loaded from the existing website, brand name, both permanent slogans, EN/BAN, light/dark, notifications, **account only in header**, menu, and separate search row.
- Approved order of the Home sections: rotating four-copy hero → compact four-card savings panel → Group Deals (image left, information/actions right) → Exclusive Products (two columns) → weekly/monthly Pools.
- Bottom tabs: Home, Pools, Deals, Exclusive, Cart. Cart badge counts **distinct lines**; cart summary also shows total units.
- Detail screens: individual/product deal pricing, member progress and Pool product lists. All public demo data is clearly labeled.
- Local demo cart with quantity controls, no server checkout. No real orders, stock reservation, payments, saved preferences or fake verified savings.
- Optional public **read-only** \`commerce_catalog\` adapter for browsing non-synthetic offers. Native authenticated sessions and transaction flows are intentionally disabled pending security + browser/UAT qualification.
- Demo product images use temporary external illustrative images. Replace with real canonical product media before release.

## Run locally

Requirements: Node.js >=22.13, Android Studio or Xcode (or a phone with Expo Go compatible with SDK 57).

\`\`\`bash
cd mobile
npm install
cp .env.example .env
npm start
npm test
npm run typecheck
\`\`\`

Expo SDK 57; the explicit package versions should be regenerated into a reviewed \`package-lock.json\` before any release. Use \`npx expo install --check\` after installing, and align native library versions as needed. No store release or EAS build is authorized by this branch.

## Changing data mode

\`EXPO_PUBLIC_DEMO_MODE=true\` is the default. To enable the **read-only** real product feed, set it to \`false\` and provide the Supabase URL and publishable key. The app never sends a service-role or secret key. If loading fails it switches to a visibly marked demo view, never to a fake production store.

A verified retail benchmark can change with product, locality and effective date. Real price comparison must snapshot the market reference and selected offer version when the order is created. Earned personal/community savings must be computed from eligible completed/fulfilled units only, net of returns, and never from demo data, bookings, pending commitments or unconfirmed offers. Savings are not a wallet balance.

**Important:** The current pilot booking system records customer service requests, not reserved stock or Commerce/Finance payments. This app must not present those as verified orders.

## Next release gates

1. Set app bundle identifiers and actual Play/App Store assets with owner approval.
2. Install and lock compatible Expo dependencies; verify typecheck, device startup, visuals at 360/390/768px and iOS/Android safe areas.
3. Add authenticated native Supabase Auth (including Google deep linking and account recovery), user-scoped RPCs for orders/notifications/savings; test RLS/IDOR.
4. Add server-authoritative cart, quote, order, stock-reservation and payment flows only after Commerce and Finance release gates are proven. Confirm no double booking on retries.
5. Audit date/currency/return calculations and community aggregate privacy thresholds; no invented savings.
6. Test accessibility, contrast, persistent language/theme, notifications permission, offline behavior, app privacy and account deletion.
7. Qualify Android and iOS builds via EAS/TestFlight/internal testing; do not merge/promote without release authorization.

## Branding rule

Exact reference: approved Oct 18 2TBR Home mockup. **No redesign** of current website, approved product cards, logo, approved color system, slogans, hero text pairs or tab labels. Any visual deviations must be reviewed before release.

## Oct 18 design corrections
Blue people icon + clock in Group Deals, compact matched Exclusive/Pool cards, split contact footer, and a hero cart containing only nonperishable rice/dal/oil/tea/sugar. Backend Group Deal lifecycle remains unchanged; auto-repeat requires explicit policy and separate qualification.
