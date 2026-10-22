import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkPreviewConfiguration, DEMO_FLAGS } from '../scripts/eas-preview-preflight.mjs';
const read = name => JSON.parse(readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
function fixture() {
  const app=read('app.json'), pkg=read('package.json'), eas=read('eas.json');
  app.expo.extra={...app.expo.extra,eas:{projectId:'ab58cc05-7f1e-42ad-9e7f-9b5b13c91dc4'}};
  app.expo.updates={url:'https://u.expo.dev/ab58cc05-7f1e-42ad-9e7f-9b5b13c91dc4'};
  return {app,pkg,eas};
}
test('the isolated EAS profile and explicit DEMO gates accept a valid project link', () => {
  const {app,pkg,eas}=fixture();
  assert.deepEqual(checkPreviewConfiguration(app,pkg,eas,DEMO_FLAGS), []);
});
test('wrong Expo account, project URL and native package are blocked', () => {
  const {app,pkg,eas}=fixture();
  app.expo.owner='velunee';
  app.expo.extra.eas.projectId='00000000-0000-4000-8000-000000000000';
  app.expo.updates.url='https://u.expo.dev/00000000-0000-4000-8000-000000000000';
  app.expo.android.package='com.example.production';
  assert.ok(checkPreviewConfiguration(app,pkg,eas,DEMO_FLAGS).length >= 3);
});
test('unlinked UUID and disabled DEMO gates block preview publishing', () => {
  const {app,pkg,eas}=fixture();
  delete app.expo.extra.eas.projectId;
  eas.build['2tbr-internal-preview'].env.EXPO_PUBLIC_NATIVE_AUTH_ENABLED='true';
  const errs=checkPreviewConfiguration(app,pkg,eas,{...DEMO_FLAGS,EXPO_PUBLIC_DEMO_MODE:'false'});
  assert.ok(errs.some(x=>x.includes('not linked')));
  assert.ok(errs.some(x=>x.includes('EXPO_PUBLIC_NATIVE_AUTH_ENABLED')));
  assert.ok(errs.some(x=>x.includes('EXPO_PUBLIC_DEMO_MODE')));
});
