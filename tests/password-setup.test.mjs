import test from 'node:test'
import assert from 'node:assert/strict'
import {passwordSetupError} from '../lib/password-setup.mjs'

test('password confirmation preserves literal bytes and rejects missing, short or mismatched values',()=>{
  assert.equal(passwordSetupError('  longer passphrase  ','  longer passphrase  '),null)
  assert.equal(passwordSetupError('  longer passphrase  ','longer passphrase'), 'The two passwords do not match.')
  for(const password of [null,'short','x'.repeat(129)])assert.equal(passwordSetupError(password,password),'Use a password between 12 and 128 characters.')
})
