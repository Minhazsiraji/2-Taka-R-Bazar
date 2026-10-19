# 2TBR Expo Account Linking — Required Setup

Status (2026-10-19): **Expo account exists per owner confirmation; actual username/project link has not yet been supplied**. No Expo project has been created or linked through this PR. No OTA builds or updates have been published.

## What we have done safely

- Draft PR #123: `mobile/eas.json` has an **isolated internal APK profile** named `2tbr-internal-preview`, tied only to the update channel `2tbr-internal-preview`, EAS environment `preview`.
- Production application config and live website remain unchanged.
- Current installed Android binary is standalone but **not OTA-enabled**. Do not expect it to receive updates.

## Next user input — no secret

Share either:
- Expo project dashboard URL (preferred if a project already exists), or
- Expo account username/profile URL, if no project exists yet.

Do **not** share passwords, Expo access tokens or keys in chat.

## After the project account/project UUID is known

1. Associate Expo app slug `2tbr-mobile` with the correct owner/project UUID using `eas init` and review the actual project association. No guessed IDs or owner values.
2. Install the Expo SDK 57-compatible `expo-updates` package with `npx expo install expo-updates`, persist the compatible version in `mobile/package.json`, and use `eas update:configure` to generate `runtimeVersion`, `updates.url` and `extra.eas.projectId`.
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
