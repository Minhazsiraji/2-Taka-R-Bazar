import test from 'node:test'
import assert from 'node:assert/strict'
import { median, verifiedSaving } from '../lib/domain.mjs'

test('verified saving is benchmark minus final price times fulfilled quantity', () => {
  assert.equal(verifiedSaving(505, 465, 2), 80)
})

test('negative savings never appear', () => {
  assert.equal(verifiedSaving(465, 505, 2), 0)
})

test('invalid or zero quantity does not create savings', () => {
  assert.equal(verifiedSaving(505, 465, 0), 0)
})

test('median benchmark works for odd and even observations', () => {
  assert.equal(median([510, 500, 505]), 505)
  assert.equal(median([500, 510]), 505)
})
