import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUY_MODE, COMMITMENT_STATUS, classifyShoppingEntry,
  requirePayableEntry, summarizeVerifiedQuote,
} from '../lib/commerce-lifecycle.mjs';

test('solo basket line is ready but still requires server quote', () => {
  assert.deepEqual(classifyShoppingEntry({ mode: BUY_MODE.SOLO }), {
    tab: 'ready', checkoutAllowed: true, requiresServerQuote: true,
  });
});
test('joining Pool or Group Deal does not permit checkout', () => {
  for (const mode of [BUY_MODE.POOL, BUY_MODE.GROUP_DEAL]) {
    assert.equal(classifyShoppingEntry({ mode, status: COMMITMENT_STATUS.WAITING }).tab, 'waiting');
    assert.throws(() => requirePayableEntry({ mode, status: COMMITMENT_STATUS.WAITING }));
  }
});
test('only locked group offers are ready, and expired/cancelled are not', () => {
  for (const mode of [BUY_MODE.POOL, BUY_MODE.GROUP_DEAL]) {
    assert.equal(requirePayableEntry({ mode, status: COMMITMENT_STATUS.PRICE_LOCKED }).checkoutAllowed, true);
    for (const status of [COMMITMENT_STATUS.EXPIRED, COMMITMENT_STATUS.CANCELLED, COMMITMENT_STATUS.CONFIRMED]) {
      assert.equal(classifyShoppingEntry({ mode, status }).checkoutAllowed, false);
    }
  }
});
test('rejects unknown modes and statuses', () => {
  assert.throws(() => classifyShoppingEntry({ mode: 'INSTANT' }));
  assert.throws(() => classifyShoppingEntry({ mode: BUY_MODE.POOL, status: 'PAID' }));
});
test('summarizes only server-verified integer currency units', () => {
  assert.deepEqual(summarizeVerifiedQuote({
    lines: [{ quantity: 2, unitPriceMinor: 65000, serverVerified: true }],
    deliveryMinor: 4000, adjustmentMinor: 1000,
  }), { subtotalMinor: 130000, deliveryMinor: 4000, adjustmentMinor: 1000, totalMinor: 133000 });
  assert.throws(() => summarizeVerifiedQuote({ lines: [{ quantity: 1, unitPriceMinor: 100, serverVerified: false }] }));
  assert.throws(() => summarizeVerifiedQuote({ lines: [{ quantity: 0, unitPriceMinor: 100, serverVerified: true }] }));
  assert.throws(() => summarizeVerifiedQuote({ lines: [{ quantity: 1, unitPriceMinor: 100, serverVerified: true }], adjustmentMinor: 101 }));
});
