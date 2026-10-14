import test from 'node:test'
import assert from 'node:assert/strict'
import {hasRecentAuthentication,passwordSetupError} from '../lib/password-setup.mjs'

test('password setup requires recent verified authentication, not refreshed or editable claims',()=>{
  const now=2000000
  assert.equal(hasRecentAuthentication({amr:[{method:'otp',timestamp:now-60}]},now),true)
  assert.equal(hasRecentAuthentication({amr:[{method:'password',timestamp:now-900}]},now),true)
  for(const claims of [{iat:now,amr:[{method:'otp',timestamp:now-901}]},{user_metadata:{recent_login:now}},{amr:[{method:'anonymous',timestamp:now}]},{amr:[{method:'otp',timestamp:now+100}]},{amr:[{method:'otp',timestamp:String(now)}]},null])
    assert.equal(hasRecentAuthentication(claims,now),false)
})

test('password confirmation preserves literal bytes and rejects missing, short or mismatched values',()=>{
  assert.equal(passwordSetupError('  longer passphrase  ','  longer passphrase  '),null)
  assert.equal(passwordSetupError('  longer passphrase  ','longer passphrase'), 'The two passwords do not match.')
  for(const password of [null,'short','x'.repeat(129)])assert.equal(passwordSetupError(password,password),'Use a password between 12 and 128 characters.')
})
