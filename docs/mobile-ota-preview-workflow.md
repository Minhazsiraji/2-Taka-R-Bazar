# 2TBR — Fast Mobile Review & OTA Preview Architecture
**Status:** Proposed, pre-activation; no Expo/EAS project ID or token configured. **Branch:** feat/mobile-expo-locked-home-v1 (Draft PR #123).

## Problem observed
Installing a fresh signed APK for each JavaScript/layout correction is slow; the installed Android `app-release.apk` currently embeds JS and does not have EAS Update configured. It **cannot** receive OTA pushes without one new, OTA-capable native build.

## Preferred result: two review lanes

1. **Immediate design QA:** A restricted/staging web link on its **own** preview deployment (never replace the production Vercel project). Review exact Home/Deals/Pools/Cart/Account layouts and responsiveness from any phone/desktop browser. The existing offline HTML review artifact is currently *not* deployed to a stable preview link. Hosted Expo Web parity requires explicit web dependencies and a separate build/QA gate.
2. **Actual phone testing:** Expo EAS Update on the **2tbr-internal-preview** channel, only for compatible React Native JavaScript/UI, assets and content. Build an OTA-enabled Android **internal** package once; after a reviewed `eas update --channel 2tbr-internal-preview --environment preview`, the app downloads updates and applies them on restart (often close/open twice). A visible *Check for update* action may be added for testers, subject to offline/error handling. For iOS, a signed internal/TestFlight install is separately required.

## One-time authorization & setup, not performed
- User creates/signs into an Expo account at https://expo.dev/ without sharing passwords. Assign an EAS project to this mobile app and obtain the real project UUID.
- Link the project in app config (real `extra.eas.projectId` and `updates.url=https://u.expo.dev/<PROJECT_UUID>`), install SDK-57-compatible `expo-updates`, set `runtimeVersion` with `appVersion` policy, choose explicit Android internal application ID `com.twotbr.internalpreview`.
- Point the native Android/iOS test binary to the **2tbr-internal-preview** channel. Use Expo's internal distribution profile (Android APK; iOS ad hoc/TestFlight with provisioning). Ensure real store builds use a separate production channel if/when authorized.
- One-time EAS token goes into **GitHub Actions secret `EXPO_TOKEN`**; do NOT paste tokens, passwords or secret auth keys into chats. Public project ID may be stored as GitHub variable. Require a human-triggered GitHub preview update workflow, tests passing, and update summary/rollback reference before publish.
- Build and install the *new* OTA-enabled Android internal build **once**, uninstalling old preview if signing differs. Old debug/standalone APKs cannot be retroactively OTA-enabled.
- Verify with a harmless UI update before switching normal preview testing to OTA.

## Safety gates
- Only a **manual, reviewed** preview-channel update may be published; no automatic production release or unreviewed push on every PR commit.
- Keep DEMO=true, native auth/Google OFF and real customer/finance/checkout writes disabled in any preview build.
- **No production key** or service role may be put into `EXPO_PUBLIC_*` variables or app assets.
- Auth changes, permissions, Expo/React Native version changes, native modules or native config changes require a new compatible native binary and runtime version; OTA is not a substitute.
- Preview updates may be cached; clearly distinguish *published*, *downloaded* and *applied*. Force close/reopen to activate after downloading, and have a tested rollback path through EAS Update.
- Installed app must still work using its embedded bundle without internet (the update just waits).
- Keep approved hero V2.3, Inter/Hind Siliguri, theme, Savings, Deals, Pools, Cart/Checkout, Account, Notifications visual locks unchanged.

## Success criteria
- User can review each front-end correction via a stable HTTPS preview link; no ZIP downloads.
- After first new Android internal install, updating compatible UI requires only a human-authorized Expo preview push and reopening the app; **no APK transfer**.
- One visible build badge/ID and one update ID in the app/menu make screenshots traceable.
- OS-safe-area, EN/BAN, dark/light and interaction tests still run on actual devices. Do not declare release ready based on browser visuals alone.
- iOS internal preview path is added only after Apple signing/registration requirements are resolved.

**Primary references:** https://docs.expo.dev/eas-update/getting-started/ ; https://docs.expo.dev/eas-update/deployment/ ; https://docs.expo.dev/build/internal-distribution/

## Current implementation state
**Design documented only.** OTA package, Expo project/channel, EAS credentials and hosted preview are not yet wired. Previous Android debug/standalone artifacts require APK replacement; do not promise OTA until an OTA-enabled build is tested and linked to the Expo project.
