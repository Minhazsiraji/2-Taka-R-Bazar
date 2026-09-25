import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBdLocalPhone, sanitizeBdPhoneInput, toBdE164Phone } from '../lib/bd-phone.mjs'

const cases = [
  '01404385101',
  '01404 385101',
  '01404-385101',
  '(01404) 385-101',
  '+8801404385101',
  '8801404385101',
  '008801404385101',
  '1404385101',
  '০১৪০৪৩৮৫১০১',
]

for (const input of cases) {
  test(`normalizes ${input} to the local Bangladesh format`, () => {
    assert.equal(normalizeBdLocalPhone(input), '01404385101')
    assert.equal(toBdE164Phone(input), '+8801404385101')
  })
}

test('sanitizes pasted formatted input for the visible field', () => {
  assert.equal(sanitizeBdPhoneInput('+88 01404-385101'), '01404385101')
})

test('rejects invalid Bangladesh mobile numbers', () => {
  assert.equal(normalizeBdLocalPhone('01234567890'), null)
  assert.equal(normalizeBdLocalPhone('0140438510'), null)
  assert.equal(normalizeBdLocalPhone('not-a-phone'), null)
})
