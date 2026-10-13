import test from 'node:test'
import assert from 'node:assert/strict'
import {commerceUatLoginEnabled} from '../lib/commerce/uat-access.mjs'
test('temporary commerce email sign-in is only available in explicitly configured Preview',()=>{
 assert.equal(commerceUatLoginEnabled({VERCEL_ENV:'preview',COMMERCE_UAT_LOGIN_ENABLED:'true'}),true)
 for(const VERCEL_ENV of ['production','development',undefined])assert.equal(commerceUatLoginEnabled({VERCEL_ENV,COMMERCE_UAT_LOGIN_ENABLED:'true'}),false)
 for(const COMMERCE_UAT_LOGIN_ENABLED of ['false','TRUE',undefined])assert.equal(commerceUatLoginEnabled({VERCEL_ENV:'preview',COMMERCE_UAT_LOGIN_ENABLED}),false)
})
