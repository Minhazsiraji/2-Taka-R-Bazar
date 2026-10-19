#!/usr/bin/env node
/**
 * Fail-closed guard for the isolated 2TBR internal preview only.
 * Run before EAS Build or publishing an EAS Update.
 * No Expo auth tokens or production secrets belong here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PREVIEW_CHANNEL = '2tbr-internal-preview';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DEMO_FLAGS = {
  EXPO_PUBLIC_DEMO_MODE: 'true',
  EXPO_PUBLIC_NATIVE_AUTH_ENABLED: 'false',
  EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED: 'false',
};

export function checkPreviewConfiguration(app, pkg, eas, environment) {
  const errors = [];
  const expo = app?.expo ?? {};
  const profile = eas?.build?.[PREVIEW_CHANNEL] ?? {};
  const projectId = expo?.extra?.eas?.projectId;
  if (expo.owner !== 'minhazsiraji') errors.push('Expo owner must be minhazsiraji');
  if (expo.slug !== '2tbr-mobile') errors.push('Expo slug must be 2tbr-mobile, never velunee');
  if (expo.android?.package !== 'com.twotbr.internalpreview') errors.push('Wrong Android internal-preview package');
  if (expo.runtimeVersion?.policy !== 'appVersion') errors.push('Use appVersion runtime policy; increment version for native changes');
  if (!pkg.dependencies?.['expo-updates']) errors.push('Missing expo-updates dependency');
  if (!UUID.test(projectId ?? '')) errors.push('Expo project is not linked: run eas init --account minhazsiraji');
  else if (expo.updates?.url !== `https://u.expo.dev/${projectId}`) errors.push('EAS updates.url must match the 2TBR Expo project UUID');
  if (profile.channel !== PREVIEW_CHANNEL || profile.distribution !== 'internal' || profile.environment !== 'preview') {
    errors.push('Internal EAS profile/channel/environment must be isolated from production');
  }
  if (profile.android?.buildType !== 'apk') errors.push('Android internal test build must be APK');
  for (const [key, expected] of Object.entries(DEMO_FLAGS)) {
    if (profile.env?.[key] !== expected) errors.push(`EAS preview profile: ${key} must be ${expected}`);
    if (environment[key] !== expected) errors.push(`Runner environment: ${key} must explicitly be ${expected}`);
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const readJson = name => JSON.parse(readFileSync(join(ROOT, name), 'utf8'));
  const errors = checkPreviewConfiguration(readJson('app.json'), readJson('package.json'), readJson('eas.json'), process.env);
  if (errors.length) {
    console.error('2TBR PREVIEW BLOCKED (no update/build attempted):\n- ' + errors.join('\n- '));
    process.exitCode = 1;
  } else {
    console.log('2TBR preview configuration OK; this is not device qualification or release approval.');
  }
}
