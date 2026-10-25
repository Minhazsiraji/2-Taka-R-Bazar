import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import configFn from '../app.config.cjs';

const path=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const original=JSON.parse(path('app.json')).expo;
const eas=JSON.parse(path('eas.json'));
const old=process.env.EAS_BUILD_PROFILE;
try{
 process.env.EAS_BUILD_PROFILE='2tbr-internal-preview';
 const preview=configFn({config:original});
 assert.equal(preview.android.package,'com.twotbr.internalpreview');
 assert.equal(preview.extra.releaseStage,'development');
 process.env.EAS_BUILD_PROFILE='production';
 const production=configFn({config:original});
 assert.equal(production.owner,'minhazsiraji');
 assert.equal(production.slug,'2tbr');
 assert.equal(production.extra.eas.projectId,'ab58cc05-7f1e-42ad-9e7f-9b5b13c91dc4');
 assert.equal(production.scheme,'twotbr');
 assert.equal(production.android.package,'com.twotbr.marketplace');
 assert.equal(production.ios.bundleIdentifier,'com.twotbr.marketplace');
 assert.equal(eas.build.production.distribution,'store');
 assert.equal(eas.build.production.android.buildType,'app-bundle');
 assert.equal(eas.build.production.environment,'production');
 assert.equal(eas.build.production.env.EXPO_PUBLIC_DEMO_MODE,'false');
 assert.equal(eas.build.production.env.EXPO_PUBLIC_NATIVE_AUTH_ENABLED,'true');
 assert.equal(eas.build.production.env.EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED,'false');
 assert.ok(!JSON.stringify(eas).includes('sb_secret_'));
 assert.ok(!JSON.stringify(eas).includes('service_role'));
 assert.ok(path('src/customer/native-workspace.tsx').includes('requestCustomerAccountDeletion'));
 assert.ok(path('../app/account/delete/page.tsx').includes('requestAccountDeletion'));
 assert.ok(path('src/auth/native-register.tsx').includes('client.auth.signUp'));
 assert.ok(path('src/customer/api.ts').includes('launch_submit_order'));
 console.log('Store candidate static gates: PASS; internal preview identity preserved.');
 console.log('Release still requires EAS environment publishable URL/key, signed devices, privacy disclosures, valid art, account erasure fulfillment, and authorized store accounts.');
}finally{if(old===undefined)delete process.env.EAS_BUILD_PROFILE;else process.env.EAS_BUILD_PROFILE=old;}
