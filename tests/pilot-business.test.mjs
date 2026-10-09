import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectUnlockedTier, nextImprovingTier, preserveBestUnlockedTier, validateFinalPrice, receiptAllowsPickup, shouldRewardReferral } from '../lib/pilot-domain.mjs'

const tiers=[
  {threshold_quantity:50,customer_ceiling_price:128},
  {threshold_quantity:100,customer_ceiling_price:125},
  {threshold_quantity:150,customer_ceiling_price:122},
]

test('below first threshold has no fake unlocked price',()=>assert.equal(selectUnlockedTier(tiers,49),null))
test('highest eligible tier is selected',()=>assert.equal(selectUnlockedTier(tiers,137).customer_ceiling_price,125))
test('once a better tier unlocks the customer ceiling never worsens after demand falls',()=>{
  const prior=selectUnlockedTier(tiers,112)
  const preserved=preserveBestUnlockedTier(tiers,71,prior)
  assert.equal(preserved.threshold_quantity,100)
  assert.equal(preserved.customer_ceiling_price,125)
})
test('next improving tier and units needed are deterministic',()=>{
  const next=nextImprovingTier(tiers,72,128)
  assert.equal(next.threshold_quantity,100)
  assert.equal(next.threshold_quantity-72,28)
})
test('38 of 50 units leaves 12 to unlock a 955 target against 1000 market retail',()=>{
  const oilTiers=[{threshold_quantity:50,customer_ceiling_price:955}]
  const next=nextImprovingTier(oilTiers,38,null)
  assert.equal(next.threshold_quantity,50)
  assert.equal(next.customer_ceiling_price,955)
  assert.equal(next.threshold_quantity-38,12)
  assert.equal(1000-next.customer_ceiling_price,45)
})
test('final price can fall but cannot exceed frozen ceiling or go below delivered cost',()=>{
  assert.equal(validateFinalPrice({landedCost:119.5,finalPrice:121,frozenCeiling:125}),true)
  assert.equal(validateFinalPrice({landedCost:119.5,finalPrice:127,frozenCeiling:125}),false)
  assert.equal(validateFinalPrice({landedCost:119.5,finalPrice:118,frozenCeiling:125}),false)
})
test('supplier receipt must cover expected quantity before pickup',()=>{
  assert.equal(receiptAllowsPickup({expected:137,received:136}),false)
  assert.equal(receiptAllowsPickup({expected:137,received:137}),true)
})
test('referral only rewards first genuine completed order',()=>{
  assert.equal(shouldRewardReferral({referralStatus:'pending',completedGenuineOrders:0}),false)
  assert.equal(shouldRewardReferral({referralStatus:'pending',completedGenuineOrders:1}),true)
  assert.equal(shouldRewardReferral({referralStatus:'rewarded',completedGenuineOrders:1}),false)
  assert.equal(shouldRewardReferral({referralStatus:'pending',completedGenuineOrders:2}),false)
})

test('migration contains database-owned pilot guards and idempotency',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202609280001_pilot_business_mechanism.sql',import.meta.url),'utf8')
  assert.match(sql,/frozen_committed_quantity/)
  assert.match(sql,/final customer price cannot exceed the unlocked ceiling/i)
  assert.match(sql,/Final customer price cannot be below delivered supplier cost/i)
  assert.match(sql,/Required supplier deliveries must be fully received/i)
  assert.match(sql,/referred_user_id uuid not null unique/)
  assert.match(sql,/referral_id uuid not null unique/)
  assert.match(sql,/private\.is_pilot_mode\(\)/)
  assert.match(sql,/You earned 10 Coins/)
})

test('referral attribution is carried through the OTP/onboarding flow',()=>{
  const auth=readFileSync(new URL('../app/actions/auth.ts',import.meta.url),'utf8')
  assert.match(auth,/cookieStore\.set\('bp_ref_code'/)
  assert.match(auth,/supabase\.rpc\('apply_referral_code'/)
  assert.match(auth,/cookieStore\.delete\('bp_ref_code'\)/)
})
test('invalid and self referral are non-blocking outcomes',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202609280001_pilot_business_mechanism.sql',import.meta.url),'utf8')
  assert.match(sql,/return 'invalid'/)
  assert.match(sql,/return 'self_rejected'/)
  assert.match(sql,/return 'already_attributed'/)
})

test('subscription is retired from commerce and customer navigation',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261005054015_no_subscription_margin_delivery.sql',import.meta.url),'utf8')
  const shell=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8')
  const footer=readFileSync(new URL('../components/site-footer.tsx',import.meta.url),'utf8')
  const subscriptionPage=readFileSync(new URL('../app/subscription/page.tsx',import.meta.url),'utf8')
  assert.match(sql,/set enforcement_enabled=false/)
  assert.match(sql,/Membership billing is retired/)
  assert.doesNotMatch(shell,/\/subscription/)
  assert.match(subscriptionPage,/No subscription fee/)
})

test('unlocked customer ceiling is monotonic and frozen from the best reached tier',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202609280001_pilot_business_mechanism.sql',import.meta.url),'utf8')
  assert.match(sql,/best_unlocked_customer_ceiling_price/)
  assert.match(sql,/price_tier_unlocked/)
  assert.match(sql,/perform private\.refresh_pool_item_unlock\(p_pool_item_id\)/)
  assert.match(sql,/frozen_customer_ceiling_price=v_best_ceiling/)
})

test('supplier quote lifecycle and benchmark guards are database owned',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202609280001_pilot_business_mechanism.sql',import.meta.url),'utf8')
  assert.match(sql,/Planning tiers can only be entered while the pool is Draft/)
  assert.match(sql,/Planning customer ceiling cannot exceed the approved market benchmark/)
  assert.match(sql,/Final supplier quotes require frozen demand in Pricing/)
  assert.match(sql,/Final supplier quote quantity must match frozen demand/)
})
test('pilot blocks direct invoice creation and rejects old-customer referral attribution',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202609280001_pilot_business_mechanism.sql',import.meta.url),'utf8')
  assert.match(sql,/Membership billing is dormant during Pilot Mode/)
  assert.match(sql,/return 'ineligible_existing_customer'/)
})

test('planning tiers do not by themselves prevent a safe return to Draft',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202609280001_pilot_business_mechanism.sql',import.meta.url),'utf8')
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  assert.match(sql,/q\.quote_phase='final'/)
  assert.match(workflow,/hasFinalQuotes=poolQuotes\.some/)
})


test('supplier-backed pools require a 2 to 3 tier ladder before opening',()=>{
  const policy=readFileSync(new URL('../supabase/migrations/20261007174500_pool_two_three_tier_policy.sql',import.meta.url),'utf8')
  const action=readFileSync(new URL('../app/actions/pilot.ts',import.meta.url),'utf8')
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  assert.match(policy,/not between 2 and 3/i)
  assert.match(policy,/at most 3 planning price tiers/i)
  assert.match(policy,/quantity threshold already exists/i)
  assert.match(action,/existingTiers/)
  assert.match(action,/length>=3/)
  assert.match(workflow,/planningQuotes\.length<3/)
  assert.match(workflow,/Configure 2–3 quantity tiers before opening/i)
})

test('customer Pool UI advances compactly from an unlocked tier to the next better tier',()=>{
  const page=readFileSync(new URL('../app/pool/page.tsx',import.meta.url),'utf8')
  const progress=readFileSync(new URL('../components/price-target-progress.tsx',import.meta.url),'utf8')
  assert.match(page,/unlockedThreshold=Number\(unlock\.unlocked_threshold/)
  assert.match(page,/unlockedThreshold=\{unlockedThreshold\}/)
  assert.match(progress,/Next price tier/i)
  assert.match(progress,/more →/i)
  assert.match(progress,/save .*\/unit/i)
  assert.match(page,/Share target/i)
})

test('mobile customer nav returns to the clean attached first-style treatment',()=>{
  const css=readFileSync(new URL('../app/site-customer-experience.css',import.meta.url),'utf8')
  assert.match(css,/Restore the original clean mobile navigation/i)
  assert.match(css,/inset-inline:0/)
  assert.match(css,/bottom:0/)
  assert.match(css,/border-radius:12px 12px 0 0/)
  assert.match(css,/app-mobile-nav-link\.is-active/)
  assert.match(css,/box-shadow:none/)
  assert.doesNotMatch(css,/left:8px/)
})


test('Pool cancellation cannot bypass the reasoned audit path',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261007183000_pool_cancellation_reason_hardening.sql',import.meta.url),'utf8')
  const actions=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  assert.match(sql,/Use admin_cancel_pool with a cancellation reason/i)
  assert.match(sql,/Cancellation reason required/i)
  assert.match(sql,/pool_cancelled_with_reason/i)
  assert.match(sql,/pool_cancellation_reason_backfilled/i)
  assert.match(sql,/status='cancelled'/i)
  assert.match(actions,/supabase\.rpc\('admin_cancel_pool'/)
})


test('final customer UX prioritizes savings pulse, compact cards and honest delivery-separated savings',()=>{
  const home=readFileSync(new URL('../app/home/page.tsx',import.meta.url),'utf8')
  const pool=readFileSync(new URL('../app/pool/page.tsx',import.meta.url),'utf8')
  const orders=readFileSync(new URL('../app/orders/page.tsx',import.meta.url),'utf8')
  const savings=readFileSync(new URL('../app/savings/page.tsx',import.meta.url),'utf8')
  const shell=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8')
  const footer=readFileSync(new URL('../components/site-footer.tsx',import.meta.url),'utf8')
  assert.match(home,/Savings pulse/i)
  assert.match(home,/Best next saving move/i)
  assert.match(pool,/Choose essentials, watch the price fall/i)
  assert.match(orders,/Community pickup FREE/i)
  assert.match(orders,/Home delivery ৳20 up to ৳1,000/i)
  assert.match(savings,/Net saving this month/i)
  assert.match(savings,/Product saving .* delivery/i)
  assert.match(shell,/<MobileCustomerNav\/>/)
  assert.match(shell,/SiteFooter withMobileNavOffset/)
  assert.match(footer,/aria-label="Legal and help"/)
  assert.match(footer,/env\(safe-area-inset-bottom\)/)
})
