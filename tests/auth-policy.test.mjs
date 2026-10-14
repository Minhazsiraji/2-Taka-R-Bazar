import test from 'node:test'
import assert from 'node:assert/strict'
import {safeAuthReturnPath, authCallbackUrl, authProviderStatus} from '../lib/auth-policy.mjs'

test('authentication returns allowlisted paths and rejects external or privileged redirects', () => {
  assert.equal(safeAuthReturnPath('/account/security?ignored=true'), '/account/security')
  assert.equal(safeAuthReturnPath('/checkout'), '/checkout')
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/super-admin', '/account#fragment', '/%2F%2Fevil.example', '/login', null]) assert.equal(safeAuthReturnPath(value), null)
})

test('OAuth callback uses the configured HTTPS origin and allows disposable localhost', () => {
  assert.equal(authCallbackUrl('https://2takarbazar.com/ignored'), 'https://2takarbazar.com/auth/callback')
  assert.equal(authCallbackUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000/auth/callback')
  for (const value of ['http://evil.example', 'javascript:alert(1)', 'https://user:pass@evil.example']) assert.throws(() => authCallbackUrl(value))
})

test('new phone/password operations are held unless phone auto-confirm is explicitly enabled', () => {
  const ready = {external: {phone: true, google: true}, phone_autoconfirm: true, disable_signup: false}
  assert.deepEqual(authProviderStatus(ready), {available: true, google: true, mobileSignup: true, mobilePassword: true})
  for (const value of [null, {}, {...ready, phone_autoconfirm: false}, {...ready, phone_autoconfirm: 'true'}, {...ready, external: {google: true}}, {...ready, disable_signup: true}]) assert.equal(authProviderStatus(value).mobileSignup, false)
  assert.equal(authProviderStatus({...ready, disable_signup: true}).mobilePassword, true)
  assert.equal(authProviderStatus({external: {google: 'true'}}).google, false)
})
