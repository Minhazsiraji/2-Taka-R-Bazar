# 2TBR Android + iOS store candidate — customer-only release

## Approved scope
- Preserve owner-locked Home layout, four hero messages, native 8s cart video, glossy white rims, dark/light tokens, brand logo, fonts, five bottom tabs, and card layouts.
- Guest: see published catalog, genuine prices/availability, published Deals/Pools and product details. Demo fixtures only when `EXPO_PUBLIC_DEMO_MODE=true` in an internal preview.
- Native account: mobile/password sign-in, optional native Google only after allowlist + Apple equivalent login compliance, registration, household/community onboarding, secure sign out, profile/community move.
- Group Deal and Pool: choose actual published community/cycle and quantities, explicit commit -> wait for closure -> locked server-issued per-customer quote -> delivery selection -> confirmed delivery fee -> explicit exact-total acceptance -> official bKash/bank recipient -> send real transaction reference -> wait for **separate web-side human verification** -> view order. Never make an order on commit or transfer-reference submission.
- Direct product: review actual available SOLO items, native cart, community pickup/home delivery, terms, create requested launch order by idempotency key, human review of delivery fee, human verification of transfer.
- Customer read views: launch order statuses, genuine eligible savings (never wallet money), in-app notifications, account deletion request.
- No mobile admin, staff operational, finance, treasury, supplier or inventory writes.

## Store builds — profiles are prepared, NOT run

The production EAS profile uses the EXISTING Expo account/project with separate app identifiers:
- Expo account: `minhazsiraji`, project slug `2tbr`, ID `ab58cc05-7f1e-42ad-9e7f-9b5b13c91dc4`
- Android application ID: `com.twotbr.marketplace`
- iOS bundle ID: `com.twotbr.marketplace`
- Version: 1.0.0; Android build code 1, iOS build number 1
- Android: .aab for Play; iOS: signed .ipa for App Store
- `2tbr-internal-preview` profile and current app package are unchanged.

Set the following **on the Expo EAS production environment**, not in Git:
- `EXPO_PUBLIC_SUPABASE_URL` = `https://sukabonfjcnaavjgjyuy.supabase.co`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = current enabled public project publishable key, obtained through Supabase Connect; **never use a secret/service-role key**.
- Production profile already enforces `EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_NATIVE_AUTH_ENABLED=true`, and `EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED=false` until Apple-equivalent social sign-in is approved.
- Configure secure `twotbr://auth/callback` redirect in Supabase only if native OAuth is enabled; test on installed binaries.

Do not automatically set credentials or submit on behalf of an account owner. After verifying all gates, from `mobile/` use `eas build --platform android --profile production` and `eas build --platform ios --profile production`; then manually approve Play closed/internal testing and App Store TestFlight before promotion. EAS Store builds require valid Play developer and Apple Developer/App Store Connect access, Android signing and Apple certificates/profiles.

## Blocking requirements before store submission

1. **Signed-device acceptance:** test on real Android and iOS with at least two fresh customer accounts and different registered communities. Verify login, sign-up, OAuth status, session persistence after restart, onboarding, no fabricated prices, all product details/images, accepted UI in light/dark, and small/big devices. CI JavaScript export is not a signed binary or physical device test.
2. **Commerce UAT:** test a Group Deal filling its first tier, higher tier, and deadline without tier; one Pool with up to 20 distinct products; multi-community isolation; leave before closure; exact quote and delivery fee; wrong-fee refusal; order only after independent payment verification; duplicate taps/retries/foreground/offline/expiration; direct order selection and stock race. Use synthetic isolated records first. Never run real payments for test.
3. **Visuals:** add exact owner-authoritative logo on opaque 1024x1024 PNG App Store icon, adaptive Android icon, launch/splash art, phone/tablet screenshots and store featured artwork without redesign. `mobile/app.json` currently has no release-ready icon; **not approved to submit until produced and signed off**.
4. **Account deletion:** the authenticated in-app deletion request, external `/account/delete` route and private queue are implemented. Assign an authorized operator to actually erase eligible personal data, notify the customer, track completion and document lawful order/financial retention. A request form alone does not complete deletion. Publish an appropriate web deletion disclosure/page accessible outside the app.
5. **Privacy and legal:** publish an accurate privacy policy, Google Play Data Safety and Apple App Privacy answers, contact/support URL, refund/return terms and minimum age handling. Verify that analytic/notification/device permissions match disclosures.
6. **App Review credentials:** create customer-only reviewer account with harmless synthetic sample offers and account permissions; do not share owner/super-admin login. Ensure Apple can see the entire customer journey without real bank transfers, and document where staff verification occurs.
7. **Store rights:** check `com.twotbr.marketplace` availability before registering bundle IDs; configure Play Console and App Store Connect entries, regional tax/business identity and signing. New Play personal accounts may require 12 opted-in testers for 14 consecutive days before production access.
8. **Social sign-in:** Google button must remain disabled in iOS store builds until an equivalent Apple-compliant login is provided, or rely exclusively on first-party mobile/password accounts. Do not accidentally enable both without compliance review.

## Release gate status

- Source branch/PR: `feat/mobile-customer-native-journey-oct25` / PR #158 (Draft)
- Native unit tests, TypeScript, static Expo config, Android/iOS JavaScript bundle exports: automated by `.github/workflows/mobile-customer-ci.yml`.
- CI does NOT authenticate an EAS account, create signed binaries, test device-native payment/login, or publish to stores.
- Production website/database continue operating separately; staff manually verifies transfers via the website.
- **Do not merge PR #158 or submit binaries until the blockers above are completed and owner accepts native screenshots.**
