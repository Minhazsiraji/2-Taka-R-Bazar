# APPROVED — Bilingual Typography (Mobile App)

**Owner selection:** Inter (English), Hind Siliguri (Bangla), softer typography for 2TBR.
**Scope:** Native Expo Android/iOS across Home, Group Deals, Exclusive Products, Pool Details, Cart, Checkout, Account, Orders, Savings, native sign-in, shared header/footer.
**PR:** Draft #123 — `feat/mobile-expo-locked-home-v1`.

## Canonical mapping

| Text role | English | Bangla |
| --- | --- | --- |
| Regular body / helper text | Inter Regular (400) | Hind Siliguri Regular (400) |
| Label / secondary emphasis | Inter Medium (500) | Hind Siliguri Medium (500) |
| Button / product name / price emphasis | Inter SemiBold (600) | Hind Siliguri SemiBold (600) |
| Page/section headline | Inter Bold (700) | Hind Siliguri Bold (700) |

Previous 800/900 weights are mapped centrally to 600/700. Do not reintroduce ultra-black font weights. Source of truth: `mobile/src/typography.tsx`; fonts bundled with Expo Google Fonts, loaded once at root; fall back to prior OS font when loading fails. Text/placeholder script determines family, and EN/BAN context handles number-only fields.

## Permanent invariants

- **Do not change V1 Signature Teal palette**: #007F83, #2CD6CE, #17233B, #F4F1F6.
- **Do not alter geometry**: no new cards, margins, heights, navigation, buttons, icons, status indicators, content, finance logic or user data.
- Keep previously approved Home, Group Deals, Product Details, Pools, Cart/Checkout, Account, Orders and Savings layout behavior.
- Font metrics can affect text wrapping on narrow screens: verify EN/BAN at 360/390/412 px on real devices before release. Avoid reducing text legibility below previous styles.
- No external font CDN required by installed app; HTML demo preview uses Google Fonts CSS while online and system fallback if offline.
- Production website font change requires a separately reviewed website PR; this mobile PR must not silently change live website typography.
- No APK, TestFlight, app store delivery, production deployment or checkout permission is implied by JavaScript bundle export.

## Tests

`mobile/tests/typography-lock.test.mjs` validates font packages, shared provider, weights, bilingual field coverage, brand color snapshot and locked Home content order. Expo Android+iOS JS export/TypeScript and application tests run in the Mobile Foundation non-production GitHub workflow.

