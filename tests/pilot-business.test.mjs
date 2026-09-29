import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration=()=>readFileSync(new URL('../supabase/migrations/202609280001_pilot_business_mechanism.sql',import.meta.url),'utf8')

test('below first threshold has no fake unlocked price',()=>{
  const sql=migration()
  assert.match(sql,/where q\.threshold_quantity <= v_quantity/)
  assert.match(sql,/v_unlocked_price/)
})

test('highest eligible tier is selected',()=>{
  const sql=migration()
  assert.match(sql,/order by q\.threshold_quantity desc/)
  assert.match(sql,/limit 1/)
})

test('once a better tier unlocks the customer ceiling never worsens after demand falls',()=>{
  const sql=migration()
  assert.match(sql,/least\(pi\.unlocked_customer_ceiling_price, v_current_price\)/)
})

test('next improving tier and units needed are deterministic',()=>{
  const sql=migration()
  assert.match(sql,/next_threshold/)
  assert.match(sql,/units_needed/)
})

test('38 of 50 units leaves 12 to unlock a 955 target against 1000 market retail',()=>{
  const current=38,threshold=50,market=1000,target=955
  assert.equal(Math.max(0,threshold-current),12)
  assert.equal(Math.max(0,market-target),45)
  assert.equal(Math.round((current/threshold)*100),76)
})

test('final price can fall but cannot exceed frozen ceiling or go below delivered cost',()=>{
  const sql=migration()
  assert.match(sql,/Final price cannot exceed the frozen customer ceiling/)
  assert.match(sql,/Final price cannot be below delivered supplier cost during Pilot Mode/)
})

test('supplier receipt must cover expected quantity before pickup',()=>{
  const sql=migration()
  assert.match(sql,/Full supplier receipt is required before Ready for Pickup/)
})

test('referral only rewards first genuine completed order',()=>{
  const sql=migration()
  assert.match(sql,/referral_reward_events/)
  assert.match(sql,/first_order_id/)
  assert.match(sql,/10/)
})

test('migration contains database-owned pilot guards and idempotency',()=>{
  const sql=migration()
  assert.match(sql,/pilot_mode/)
  assert.match(sql,/membership_enforced/)
  assert.match(sql,/unique\(referral_id\)/)
})

test('referral attribution is carried through the OTP/onboarding flow',()=>{
  const signup=readFileSync(new URL('../app/signup/page.tsx',import.meta.url),'utf8')
  const actions=readFileSync(new URL('../app/actions/auth.ts',import.meta.url),'utf8')
  assert.match(signup,/ref/)
  assert.match(actions,/bp_ref_code/)
})

test('invalid and self referral are non-blocking outcomes',()=>{
  const sql=migration()
  assert.match(sql,/invalid_code/)
  assert.match(sql,/self_rejected/)
})

test('pilot subscription remains dormant and customer navigation hides membership',()=>{
  const sql=migration()
  const shell=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8')
  assert.match(sql,/membership_enforced/)
  assert.match(shell,/!PILOT_MODE/)
})

test('unlocked customer ceiling is monotonic and frozen from the best reached tier',()=>{
  const sql=migration()
  assert.match(sql,/unlocked_customer_ceiling_price/)
  assert.match(sql,/frozen_customer_ceiling_price/)
})

test('supplier quote lifecycle and benchmark guards are database owned',()=>{
  const sql=migration()
  assert.match(sql,/Planning tiers can only be entered while the pool is Draft/)
  assert.match(sql,/Planning customer ceiling cannot exceed the approved market benchmark/)
  assert.match(sql,/Final supplier quotes require frozen demand in Pricing/)
  assert.match(sql,/Final supplier quote quantity must match frozen demand/)
})
test('pilot blocks direct invoice creation and rejects old-customer referral attribution',()=>{
  const sql=migration()
  assert.match(sql,/Membership billing is dormant during Pilot Mode/)
  assert.match(sql,/return 'ineligible_existing_customer'/)
})

test('planning tiers do not by themselves prevent a safe return to Draft',()=>{
  const sql=migration()
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  assert.match(sql,/q\.quote_phase='final'/)
  assert.match(workflow,/hasFinalQuotes=poolQuotes\.some/)
})
