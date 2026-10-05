import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deliveryFee, commercialEconomics, validateCommercialPrice } from '../lib/commerce.mjs'

test('community pickup is always free',()=>{
  assert.equal(deliveryFee({fulfillmentMethod:'pickup',productSubtotal:200}),0)
  assert.equal(deliveryFee({fulfillmentMethod:'pickup',productSubtotal:2500}),0)
})

test('home delivery is ৳20 up to 1000 and ৳30 above 1000',()=>{
  assert.equal(deliveryFee({fulfillmentMethod:'home_delivery',productSubtotal:999.99}),20)
  assert.equal(deliveryFee({fulfillmentMethod:'home_delivery',productSubtotal:1000}),20)
  assert.equal(deliveryFee({fulfillmentMethod:'home_delivery',productSubtotal:1000.01}),30)
})

test('commercial economics separates saving from platform contribution',()=>{
  const e=commercialEconomics({benchmark:1000,supplierLanded:930,variableCost:5,finalPrice:955,quantity:100})
  assert.equal(e.effectiveCost,935)
  assert.equal(e.customerSavingPerUnit,45)
  assert.equal(e.platformMarginPerUnit,20)
  assert.equal(e.projectedCustomerSaving,4500)
  assert.equal(e.projectedPlatformMargin,2000)
})

test('supplier rebate and brand support lower effective cost without changing customer saving',()=>{
  const e=commercialEconomics({benchmark:1000,supplierLanded:930,variableCost:5,supplierRebate:5,brandSupport:2,finalPrice:955})
  assert.equal(e.effectiveCost,928)
  assert.equal(e.customerSavingPerUnit,45)
  assert.equal(e.platformMarginPerUnit,27)
})

test('final customer price is protected by effective cost, benchmark and unlocked ceiling',()=>{
  assert.equal(validateCommercialPrice({benchmark:1000,effectiveCost:935,finalPrice:955,frozenCeiling:960}),true)
  assert.equal(validateCommercialPrice({benchmark:1000,effectiveCost:960,finalPrice:955,frozenCeiling:960}),false)
  assert.equal(validateCommercialPrice({benchmark:1000,effectiveCost:935,finalPrice:965,frozenCeiling:960}),false)
  assert.equal(validateCommercialPrice({benchmark:950,effectiveCost:935,finalPrice:955,frozenCeiling:960}),false)
})

test('restructure migration owns no-subscription, margin and basket-delivery invariants',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261005054015_no_subscription_margin_delivery.sql',import.meta.url),'utf8')
  assert.match(sql,/set enforcement_enabled=false/)
  assert.match(sql,/variable_cost_per_unit/)
  assert.match(sql,/supplier_rebate_per_unit/)
  assert.match(sql,/brand_support_per_unit/)
  assert.match(sql,/Final customer price cannot be below effective product cost/)
  assert.match(sql,/p_product_subtotal,0\)<=1000 then return 20/)
  assert.match(sql,/return 30/)
  assert.match(sql,/perform private\.refresh_order_totals\(v_order_id\)/)
  assert.match(sql,/fulfillment_method='home_delivery'/)
  assert.match(sql,/admin_mark_order_delivered/)
})

test('customer order UI keeps delivery separate from product savings',()=>{
  const page=readFileSync(new URL('../app/orders/page.tsx',import.meta.url),'utf8')
  const choice=readFileSync(new URL('../components/fulfillment-choice.tsx',import.meta.url),'utf8')
  assert.match(page,/Savings board/)
  assert.match(page,/Product saving/)
  assert.match(page,/Product subtotal .* delivery/)
  assert.match(choice,/Community delivery-point collection — FREE/)
  assert.match(choice,/৳20/)
  assert.match(choice,/৳30/)
})

test('operations finalization captures commercial cost layers',()=>{
  const action=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  assert.match(action,/p_variable_cost_per_unit/)
  assert.match(action,/p_supplier_rebate_per_unit/)
  assert.match(action,/p_brand_support_per_unit/)
  assert.match(workflow,/Commercial margin engine/)
  assert.match(workflow,/Platform gross contribution/)
  assert.match(workflow,/Customer saving/)
})


test('legacy confirmation and margin bypasses are fail-closed',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261005054015_no_subscription_margin_delivery.sql',import.meta.url),'utf8')
  assert.match(sql,/drop function if exists public\.confirm_commitment_order\(uuid\);/)
  assert.match(sql,/drop function if exists public\.confirm_commitment_order\(uuid,uuid\);/)
  assert.match(sql,/Legacy finalization API retired/)
})

test('pool participation has no membership query or gate',()=>{
  const page=readFileSync(new URL('../app/pool/page.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(page,/get_my_subscription_status/)
  assert.doesNotMatch(page,/membershipBlocked/)
  assert.doesNotMatch(page,/PILOT_MODE/)
})

test('pickup and notification surfaces distinguish pickup from home delivery',()=>{
  const pickup=readFileSync(new URL('../app/pickup/page.tsx',import.meta.url),'utf8')
  const notifications=readFileSync(new URL('../supabase/migrations/20261005054055_fulfillment_notifications.sql',import.meta.url),'utf8')
  const deliveries=readFileSync(new URL('../app/admin/deliveries/page.tsx',import.meta.url),'utf8')
  assert.match(pickup,/eq\('fulfillment_method','pickup'\)/)
  assert.match(notifications,/ready_for_delivery/)
  assert.match(notifications,/FREE community collection or home delivery/)
  assert.match(notifications,/Delivery charge remains separate from product savings/)
  assert.match(deliveries,/Customer delivery fees stay separate from product savings and product margin/)
  assert.match(deliveries,/delivery_actual_cost/)
})


test('retired subscription surface cannot be reactivated through legacy RPCs or cron',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261005054015_no_subscription_margin_delivery.sql',import.meta.url),'utf8')
  assert.match(sql,/revoke all on function public\.get_my_subscription_status\(\) from public,anon,authenticated/)
  assert.match(sql,/revoke all on function public\.redeem_subscription_coupon\(text\) from public,anon,authenticated/)
  assert.match(sql,/revoke all on function public\.admin_update_subscription_settings/)
  assert.match(sql,/cron\.unschedule\('2taka-subscription-billing'\)/)
})

test('home delivery completion requires actual cost for delivery economics',()=>{
  const action=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  const sql=readFileSync(new URL('../supabase/migrations/20261005054015_no_subscription_margin_delivery.sql',import.meta.url),'utf8')
  const page=readFileSync(new URL('../app/admin/deliveries/page.tsx',import.meta.url),'utf8')
  assert.match(action,/Actual delivery cost is required/)
  assert.match(action,/fail\('\/admin\/deliveries'/)
  assert.match(sql,/Actual delivery cost is required and cannot be negative/)
  assert.match(page,/actual_delivery_cost[^>]+required/)
})

test('current legal and discovery copy matches no-subscription fulfilment model',()=>{
  const legal=readFileSync(new URL('../lib/legal.ts',import.meta.url),'utf8')
  const terms=readFileSync(new URL('../app/terms/page.tsx',import.meta.url),'utf8')
  const faq=readFileSync(new URL('../app/faq/page.tsx',import.meta.url),'utf8')
  const llms=readFileSync(new URL('../app/llms.txt/route.ts',import.meta.url),'utf8')
  assert.match(legal,/CURRENT_POLICY_VERSION = '2026-10-05'/)
  assert.match(terms,/There is no subscription fee/)
  assert.match(terms,/Home delivery inside the community is ৳20/)
  assert.match(faq,/collect FREE from an enabled community point or receive optional home delivery/)
  assert.match(llms,/Community Pool access has no subscription fee/)
})

test('owner dashboard reports product and delivery contribution without calling it net profit',()=>{
  const page=readFileSync(new URL('../app/super-admin/page.tsx',import.meta.url),'utf8')
  assert.match(page,/platform_margin_per_unit/)
  assert.match(page,/delivery_actual_cost/)
  assert.match(page,/Product contribution/)
  assert.match(page,/Realized gross contribution/)
  assert.match(page,/Contribution is not net profit/)
})
