# Native Auth & Account Security — implementation review (NOT production enabled)

**Project:** 2TBR Expo Android/iOS, Draft PR #123. Current implementation is gated; no release, branch merge or production database changes.

## Existing identity reused
Uses the exact same Supabase project URL and **publishable** key as the website, and directly calls Supabase Auth `signInWithPassword({phone,password})`. The `mobile/src/auth/phone.mjs` normalizer matches `lib/bd-phone.mjs`, including local, E.164 and Bangla-number formats. No account creation, OTP bypass, service-role usage, identity migration or database write is introduced. Linked Google identities must already be attached to the correct existing account on the website.

## Security decisions
- **Both methods are OFF by default**: `EXPO_PUBLIC_NATIVE_AUTH_ENABLED=false` and `EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED=false`.
- Native sessions (and OAuth PKCE verifier) reside in OS-backed encrypted Expo SecureStore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Do not fall back to AsyncStorage/localStorage or ship any privileged database key. Reinstall / key invalidation may require signing in again.
- Restore session via `auth.getSession()`, independently verify identity with `auth.getUser()`. Access refresh follows foreground AppState. Auth callbacks schedule verification *outside* the auth state callback to avoid lock deadlocks.
- Sign out using Supabase Auth local sign-out; never equate a browser website session with the native session.
- Google OAuth: `signInWithOAuth({provider:'google',options:{redirectTo:'twotbr://auth/callback',skipBrowserRedirect:true}})` launches a native authentication browser session, validates the callback scheme/host/path, rejects embedded access/refresh tokens and exchanges the single-use authorization code with PKCE. Must allowlist the **exact** redirect `twotbr://auth/callback` in Supabase Auth URL configuration before turning on native Google. A custom scheme is not exclusive on compromised Android devices; assess verified app links/universal links before release.
- Draft direct/Group/Pool carts reset on owner transition (guest -> signed-in, user A -> user B, signed-in -> guest). The same owner's cart remains in memory when moving among screens. This is a privacy rule, not a durable cart sync implementation.
- App uses native sign-in only when configured in an installed build. Otherwise it continues with the clearly labeled existing website sign-in fallback.
- Native sign-in never claims to unlock real Orders or Savings: those screens deliberately remain synthetic and clearly labelled. Real customer data cannot be connected until authenticated customer-scoped RLS/IDOR, audits and verified financial ledgers are qualified.
- The latest storefront, deal, product, pool, cart, order and savings design locks are preserved.

## Owner/developer setup
1. Create an **isolated development build** (not Expo Go) for both Android and iOS; confirm `scheme=twotbr` and exact app bundle IDs.
2. Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the **existing project's public values**. Never use a service-role key, production bypass credentials, or commit `.env`.
3. In that build only, set `EXPO_PUBLIC_NATIVE_AUTH_ENABLED=true`. Test valid/invalid Bangladesh mobile + password, session restoration after app kill, expired refresh, sign out offline/online, device restore/reinstall, account change and guest-cart isolation.
4. For Google, first link Google from the website Account Security page in the same Supabase user, then add the native callback to Auth URL allowlist and set `EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED=true`. Test authorization cancel, callback wrong host, replay/duplicate attempt, expired code, account mismatch, revoked identity, logout and cold start on iOS & Android separately.
5. Keep Auth, Commerce, Finance and customer data API operations read-only in this lane. Do not test with a production super-admin account in a way that could alter live state. Do not log credentials/tokens.
6. Verify Android backup exclusions, iOS Keychain accessibility and release SDK version with actual native signed builds. Validate accessibility and behavior under airplane mode.

## Remaining qualified work before live customer account
Native sign-up/onboarding and recovery; backend-provided customer-scoped Orders and Savings read endpoints with RLS; per-user durable cart syncing (explicitly migrate guest carts only after confirmation); secure deep link verification; first-party test flight / internal release; real device smoke test; release approval.

## Why the browser HTML preview remains unchanged
The browser walkthrough is not a native Expo binary and cannot test securely stored iOS/Android sessions or native deep links. Native auth is deliberately not simulated inside that browser HTML. Customers can still visit the existing website login from its Account page.
