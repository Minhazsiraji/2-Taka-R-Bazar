# 2TBR Expo Account Linking — Required Setup

Status (2026-10-19): **Expo account owner verified as `minhazsiraji`; no independently verified 2TBR Expo project UUID yet.** Preview dependency and fail-closed setup checks have been prepared in Draft PR #123, but no cloud link, Expo build or OTA update has been performed. Current installed Android APK is not OTA-enabled.

## What we have done safely

- Draft PR #123: `mobile/eas.json` has an **isolated internal APK profile** named `2tbr-internal-preview`, tied only to the update channel `2tbr-internal-preview`, EAS environment `preview`.
- Production application config and live website remain unchanged.
- Current installed Android binary is standalone but **not OTA-enabled**. Do not expect it to receive updates.

## Next user input — no secret

Create a **new** Expo project in the `minhazsiraji` account named `2tbr-mobile` (do not reuse `velunee`), then share its project dashboard URL or the project UUID displayed in the project settings.

Do **not** share passwords, Expo access tokens or keys in chat.

## After the project account/project UUID is known

1. Associate Expo app slug `2tbr-mobile` with the correct owner/project UUID using `eas init` and review the actual project association. No guessed IDs or owner values.
2. `expo-updates` is pinned to Expo SDK 57's `~57.0.22` range, and `runtimeVersion.policy=appVersion` is prepared. Run `npx expo install --check`; use `eas update:configure` to add the actual `updates.url` and `extra.eas.projectId`. Review its diff and confirm it did not introduce a production channel.
3. Keep preview environment settings **EXPO_PUBLIC_DEMO_MODE=true**, **EXPO_PUBLIC_NATIVE_AUTH_ENABLED=false**, **EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED=false**; never package secret or service-role credentials into EXPO_PUBLIC.
4. Use the exact app profile in `mobile/eas.json`. EAS Build will produce an OTA-enabled internal Android test binary for a one-time installation. Apple provisioning is a separate iOS gate.
5. Restrict publishing to manually authorized `2tbr-internal-preview` channel. Do not auto-publish to production or enable checkout. Publishing should use `eas update --channel 2tbr-internal-preview --environment preview --message <reviewed-message>`.
6. On-device A/B check: initial embedded bundle should launch offline; publish a harmless visual change and confirm that compatible OTA update downloads and activates after full restart.
7. Native permissions, new native modules, app upgrades, deep link config and runtime changes still require a new binary.

## Automation proposal, not yet wired

For laptop without admin permission, put a narrowly scoped Expo token **only in GitHub Actions repository secret** (e.g., `EXPO_TOKEN`). A human-authorized CI job can publish reviewed OTA bundles from the protected branch and report the EAS update group ID. Do not commit tokens or log them. Review CI permissions and run safety checks first; do not set up publishing until the account/project binding is verified.

## Official Expo docs
- https://docs.expo.dev/eas-update/getting-started/
- https://docs.expo.dev/eas-update/deployment/
- https://docs.expo.dev/accounts/programmatic-access/
- https://docs.expo.dev/build/internal-distribution/

## Fast, safe activation checklist (from this Draft branch)

Only perform these commands after signing in to Expo as **minhazsiraji** on your own machine or authorized cloud workspace. Start from the repository root:

```bash
git checkout feat/mobile-expo-locked-home-v1
cd mobile
npm install
npx eas-cli@latest whoami                  # MUST print minhazsiraji
npx eas-cli@latest init --account minhazsiraji --non-interactive
npx eas-cli@latest project:info              # confirm owner minhazsiraji, slug 2tbr-mobile
npx eas-cli@latest update:configure --environment preview
npx expo install --check
```

Review the generated `app.json`: `extra.eas.projectId` is the actual **2TBR** UUID and `updates.url` equals `https://u.expo.dev/<same UUID>`. If either points to another Expo project, **stop** and correct the association. Commit only the validated config. Never commit credentials. The existing `velunee` project must not be modified.

For preflight checks, set the three DEMO runner variables explicitly to `true`, `false`, `false` respectively and run `npm run eas:preview:verify`. It must **fail** before linking the real UUID. This is intentional, not a broken mobile app.

After account linking, checks and owner review, create an internal test APK with:

```bash
npx eas-cli@latest build --platform android --profile 2tbr-internal-preview
```

Install the resulting APK once on the test Android phone. Changes to JavaScript/styles/assets that match this binary's runtime can then be published **only with owner review** using:

```bash
npx eas-cli@latest update --channel 2tbr-internal-preview --environment preview --message "Reviewed mobile UI correction"
```

Before either build or update, rerun all tests and the preview preflight, then record the exact commit SHA, build/update group ID and device UAT results. No automatic publishing, no production channels, no payment/checkout activation. A changed native module, native permissions, SDK or native configuration requires a new install and version increment. EAS Free-plan limits apply. iOS needs separate Apple credentials/signing.
