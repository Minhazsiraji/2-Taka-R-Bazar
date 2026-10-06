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
  assert.match(workflow,/2-TBR gross contribution/)
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

test('pool creation reports failures on the originating form and highlights a confirmed insert',()=>{
  const action=readFileSync(new URL('../app/actions/pools.ts',import.meta.url),'utf8')
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  const createPage=readFileSync(new URL('../app/admin/pools/new/page.tsx',import.meta.url),'utf8')
  assert.match(action,/createReturnTo/)
  assert.match(action,/insert\(payload\)\.select\('id'\)\.single\(\)/)
  assert.match(action,/created\(payload\.title,data\.id\)/)
  assert.match(workflow,/name="return_to" value="\/admin\/pools\/workflow"/)
  assert.match(workflow,/Just created/)
  assert.match(workflow,/ring-2 ring-emerald-500/)
  assert.match(createPage,/<Flash \{\.\.\.sp\}\/\>/)
  assert.match(createPage,/name="return_to" value="\/admin\/pools\/new"/)
})

test('advanced workflow actions stay in workflow and return to the active pool card',()=>{
  const pools=readFileSync(new URL('../app/actions/pools.ts',import.meta.url),'utf8')
  const pilot=readFileSync(new URL('../app/actions/pilot.ts',import.meta.url),'utf8')
  const admin=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  assert.match(pools,/workflowPath=\(poolId:string\)=>`\/admin\/pools\/workflow#pool-/)
  assert.match(pilot,/\/admin\/pools\/workflow\?notice=/)
  assert.match(pilot,/#pool-\$\{encodeURIComponent\(poolId\)\}/)
  assert.match(admin,/function workflowDone/)
  assert.match(admin,/function workflowFail/)
  assert.match(workflow,/action=\{enterPlanningTier\}[^\n]+name="pool_id" value=\{p\.id\}/)
  assert.match(workflow,/action=\{finalizePoolItem\}[^\n]+name="pool_id" value=\{p\.id\}/)
  assert.match(workflow,/action=\{recordSupplierReceipt\}[^\n]+name="pool_id" value=\{p\.id\}/)
})


test('draft pool own products can be repriced and removed without deleting master inventory',()=>{
  const action=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  const sql=readFileSync(new URL('../supabase/migrations/20261005115228_pool_draft_controls.sql',import.meta.url),'utf8')
  assert.match(sql,/select id into v_item from public\.pool_items where pool_id=p_pool_id and product_id=p_product_id/)
  assert.match(sql,/delete from public\.own_product_price_tiers where pool_item_id=v_item/)
  assert.match(sql,/admin_remove_draft_pool_item/)
  assert.match(sql,/Products can only be removed while the pool is Draft/)
  assert.match(sql,/Every tier price must be between landed cost/)
  assert.match(action,/Own-product pricing saved/)
  assert.match(workflow,/Own-product Pool pricing/)
  assert.match(workflow,/Remove from pool/)
})

test('open pools support audited pause resume and reasoned cancellation',()=>{
  const action=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  const customer=readFileSync(new URL('../app/pool/page.tsx',import.meta.url),'utf8')
  const sql=readFileSync(new URL('../supabase/migrations/20261005115228_pool_draft_controls.sql',import.meta.url),'utf8')
  assert.match(sql,/admin_set_pool_pause/)
  assert.match(sql,/admin_cancel_pool/)
  assert.match(sql,/if v_pool_paused then raise exception 'Pool is temporarily paused/)
  assert.match(sql,/pool_cancelled_with_reason/)
  assert.match(action,/Cancellation reason required/)
  assert.match(workflow,/Pause pool/)
  assert.match(workflow,/Resume pool/)
  assert.match(workflow,/Cancellation reason/)
  assert.match(customer,/pool\.status==='open'&&!pool\.is_paused/)
})


test('own-product economics use the common pool-item reporting contract without double counting',()=>{
  const workflow=readFileSync(new URL('../app/admin/pools/workflow/page.tsx',import.meta.url),'utf8')
  const owner=readFileSync(new URL('../app/super-admin/page.tsx',import.meta.url),'utf8')
  const sql=readFileSync(new URL('../supabase/migrations/20261006090000_own_product_economics_alignment.sql',import.meta.url),'utf8')
  assert.match(sql,/sync_own_pool_item_economics/)
  assert.match(sql,/new\.effective_cost_per_unit:=round\(v_landed,2\)/)
  assert.match(sql,/new\.platform_margin_per_unit:=round\(new\.final_customer_price-v_landed,2\)/)
  assert.match(sql,/new\.customer_saving_per_unit:=round\(new\.benchmark_price_snapshot-new\.final_customer_price,2\)/)
  assert.match(workflow,/Own landed cost/)
  assert.match(workflow,/2-TBR gross contribution/)
  assert.match(workflow,/Verified market benchmark/)
  assert.match(owner,/admin_own_product_performance/)
  assert.match(owner,/source_type==='SUPPLIER_POOL'/)
  assert.match(owner,/const realizedSupplierContribution = orderItems\.filter/)
  assert.match(owner,/const productContribution = realizedSupplierContribution \+ ownProductContribution/)
})
