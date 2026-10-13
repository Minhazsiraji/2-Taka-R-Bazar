import test from 'node:test'
import assert from 'node:assert/strict'
import {commerceError} from '../lib/commerce/errors.mjs'
test('expired private Preview authorization explains why refreshing cannot help',()=>{
 assert.equal(commerceError('Commerce purchases are disabled outside authorized synthetic Preview'),'Preview test access has expired. Contact the test coordinator to reopen the session.')
})
test('recognized customer business failures retain actionable messages',()=>{
 for(const value of ['Promotion limit reached for this account (1 item total)','Quote expired or cart changed; review a fresh quote','Cancellation is unavailable after dispatch'])assert.equal(commerceError(value),value)
})
test('internal and unrecognized database failures stay private',()=>{
 for(const value of ['duplicate key value violates unique constraint internal_ledger_key','Order not accessible','Commerce purchases are disabled outside authorized synthetic Preview: secret=private-value'])assert.equal(commerceError(value),'This action could not be completed. Refresh and try again, or contact support.')
})
