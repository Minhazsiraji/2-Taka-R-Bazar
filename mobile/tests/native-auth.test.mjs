import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toBdE164Phone as webPhone} from '../../lib/bd-phone.mjs';
import {toBdE164Phone as nativePhone,validPassword} from '../src/auth/phone.mjs';

const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/auth/client.ts',import.meta.url),'utf8');
const hook=readFileSync(new URL('../src/auth/use-native-auth.ts',import.meta.url),'utf8');
const form=readFileSync(new URL('../src/auth/native-sign-in.tsx',import.meta.url),'utf8');
const env=readFileSync(new URL('../.env.example',import.meta.url),'utf8');

test('Native phone conversion matches existing website identities',()=>{
 for(const input of ['01404385101','1404385101','+8801404385101','8801404385101','008801404385101','০১৪০৪৩৮৫১০১','01612345678']){
  assert.equal(nativePhone(input),webPhone(input),input);
 }
 for(const input of ['01712','12345','01212345678','++88','',null,undefined]){
  assert.equal(nativePhone(input),webPhone(input),String(input));
 }
 assert.equal(validPassword('secret'),true);
 assert.equal(validPassword(''),false);
 assert.equal(validPassword('a'.repeat(257)),false);
});
test('Native auth defaults disabled and no service-role or implicit flow',()=>{
 assert.ok(env.includes('EXPO_PUBLIC_NATIVE_AUTH_ENABLED=false'));
 assert.ok(env.includes('EXPO_PUBLIC_NATIVE_GOOGLE_ENABLED=false'));
 assert.ok(client.includes("flowType:'pkce'"));
 assert.ok(client.includes('detectSessionInUrl:false'));
 assert.ok(client.includes('SecureStore.getItemAsync'));
 assert.ok(client.includes('SecureStore.setItemAsync'));
 assert.ok(client.includes("keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY"));
 assert.ok(!client.includes("signUp("));
 assert.ok(!client.includes("localStorage"));
});
test('Google OAuth validates native callback and exchanges only code',()=>{
 for(const token of ['twotbr://auth/callback','openAuthSessionAsync','callback.protocol','callback.hostname','callback.pathname',
    "callback.searchParams.has('access_token')","callback.searchParams.has('refresh_token')","exchangeCodeForSession(code)"])
  assert.ok(client.includes(token),token);
 assert.ok(client.includes('nativeGoogleConfigured()'));
});
test('Identity verified on restoration and password sign-in; logout clears session',()=>{
 assert.ok(hook.includes("client.auth.getUser()"));
 assert.ok(hook.includes('client.auth.getSession()'));
 assert.ok(hook.includes("client.auth.signInWithPassword({phone,password})"));
 assert.ok(hook.includes("client.auth.signOut({scope:'local'})"));
 assert.ok(hook.includes('client.auth.onAuthStateChange('));
});
test('Account state isolates drafts between users and never exposes live orders',()=>{
 for(const token of ['cartOwner.current!==owner','setCart({})','setGroupDrafts({})',
 'setPoolDrafts({})','setPoolQuantities({})',"case 'signIn':return <NativeSignIn",'Orders and Savings remain DEMO'])
 assert.ok(app.includes(token),token);
 assert.ok(form.includes('secureTextEntry'));
 assert.ok(form.includes('auth.signInPhone(phone,password)'));
 assert.ok(form.includes('auth.googleEnabled'));
 const home=app.slice(app.indexOf('function Home()'),app.indexOf('function Footer()'));
 assert.ok(home.includes('{Hero()}'));
 assert.ok(home.includes('<Savings home/>'));
});
