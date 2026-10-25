import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const base=JSON.parse(readFileSync('app.json','utf8')).expo;
const eas=JSON.parse(readFileSync('eas.json','utf8'));
const previous=process.env.EAS_BUILD_PROFILE;
process.env.EAS_BUILD_PROFILE='production';
const production=require('../app.config.cjs')({config:base});
if(previous==null)delete process.env.EAS_BUILD_PROFILE;
else process.env.EAS_BUILD_PROFILE=previous;
assert.equal(production.extra.eas.projectId,'ab58cc05-7f1e-42ad-9e7f-9b5b13c91dc4');
assert.equal(production.android.package,'com.twotbr.marketplace');
assert.equal(production.ios.bundleIdentifier,'com.twotbr.marketplace');
assert.equal(production.version,'1.0.0');
assert.equal(production.icon,'./assets/store-icon.png');
assert.notEqual(production.android.package,base.android.package,'Store and legacy preview packages must remain isolated');
const img=readFileSync('assets/store-icon.png');
assert.equal(img.subarray(1,4).toString('ascii'),'PNG');
assert.equal(img.readUInt32BE(16),1024);
assert.equal(img.readUInt32BE(20),1024);
assert.equal(img[25],2,'Store icon must be opaque RGB (no alpha)');
for(const name of ['production','2tbr-customer-qa']){
 const profile=eas.build[name];
 assert.ok(profile, name+' build profile missing');
 const vars=profile.env;
 assert.equal(vars.EXPO_PUBLIC_DEMO_MODE,'false');
 assert.equal(vars.EXPO_PUBLIC_NATIVE_AUTH_ENABLED,'true');
 assert.equal(vars.EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED,'false');
 assert.equal(vars.EXPO_PUBLIC_SUPABASE_URL,'https://sukabonfjcnaavjgjyuy.supabase.co');
 assert.ok(vars.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'));
 assert.ok(!JSON.stringify(profile).includes('service_role'),'Never expose a privileged backend key');
}
assert.equal(eas.build.production.android.buildType,'app-bundle');
assert.equal(eas.build['2tbr-customer-qa'].android.buildType,'apk');
console.log('Store configuration: verified customer-only Android AAB / iOS IPA inputs and branded opaque icon');
