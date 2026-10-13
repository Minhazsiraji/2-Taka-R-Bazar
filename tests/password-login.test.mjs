import test from 'node:test'
import assert from 'node:assert/strict'
import {passwordCredentials} from '../lib/password-login.mjs'
const form = values => ({get: key => values[key] ?? null})
test('existing BD mobile password authentication normalizes identifiers and preserves password bytes', () => {
  assert.deepEqual(passwordCredentials(form({phone:'01404 385101',password:'  private value  '})), {phone:'+8801404385101',password:'  private value  '})
})
test('password authentication rejects ambiguous identifiers, missing passwords and invalid mobile numbers', () => {
  for (const values of [{phone:'123',password:'value'},{phone:'01404385101'},{phone:'01404385101',email:'test@example.invalid',password:'value'},{phone:'01404385101',password:'x'.repeat(257)}]) assert.equal(passwordCredentials(form(values),true),null)
})
test('email credentials are restricted to the explicit reviewer entry point', () => {
  const values={email:'test@example.invalid',password:'private value'}
  assert.equal(passwordCredentials(form(values)),null)
  assert.deepEqual(passwordCredentials(form(values),true),values)
})
