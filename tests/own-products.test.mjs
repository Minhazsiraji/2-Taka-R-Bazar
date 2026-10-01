import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { landedCost,customerSaving,grossContribution,selectOwnTier,nextOwnTier,resolveOwnPrice } from '../lib/own-products.mjs'

const tiers=[{min_quantity:1,unit_price:160},{min_quantity:50,unit_price:155},{min_quantity:100,unit_price:149},{min_quantity:200,unit_price:145}]

test('landed cost sums server-side components correctly',()=>assert.equal(landedCost({purchase_cost:100,packaging_cost:5,inbound_transport:7,handling_cost:3,other_landed_cost:3}),118))
test('customer saving and business contribution stay distinct',()=>{
  assert.equal(customerSaving({benchmark:180,price:149,quantity:2}),62)
  assert.equal(grossContribution({price:149,landed:118,quantity:2}),62)
})
test('quantity tier boundaries are exact',()=>{
  assert.equal(selectOwnTier(tiers,49).unit_price,160)
  assert.equal(selectOwnTier(tiers,50).unit_price,155)
  assert.equal(selectOwnTier(tiers,99).unit_price,155)
  assert.equal(selectOwnTier(tiers,100).unit_price,149)
  assert.equal(nextOwnTier(tiers,177).min_quantity,200)
})
test('fixed and target price modes resolve without misleading target price',()=>{
  assert.equal(resolveOwnPrice({mode:'FIXED_POOL_PRICE',fixedPrice:149},23),149)
  assert.equal(resolveOwnPrice({mode:'TARGET_PRICE',fixedPrice:160,targetQuantity:200,targetPrice:145},199),160)
  assert.equal(resolveOwnPrice({mode:'TARGET_PRICE',fixedPrice:160,targetQuantity:200,targetPrice:145},200),145)
})

test('migration owns inventory reservation, release, fulfilment and supplier regression guards',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610010001_own_products_pool.sql',import.meta.url),'utf8')
  assert.match(sql,/source_type in \('SUPPLIER_POOL','DIRECT_PRODUCT','PRIVATE_LABEL','EXCLUSIVE_PARTNER'\)/)
  assert.match(sql,/generated always as/)
  assert.match(sql,/reserved_quantity <= stock_on_hand/)
  assert.match(sql,/event_key text not null unique/)
  assert.match(sql,/reservation:'\|\|p_order_item_id/)
  assert.match(sql,/release:'\|\|p_order_item_id/)
  assert.match(sql,/fulfilment:'\|\|p_order_item_id/)
  assert.match(sql,/pr\.source_type='SUPPLIER_POOL'/)
  assert.match(sql,/pr\.source_type<>'SUPPLIER_POOL'/)
})

test('own-product image upload is constrained to admin storage policy and safe formats',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610010001_own_products_pool.sql',import.meta.url),'utf8')
  const action=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  const validator=readFileSync(new URL('../lib/product-image.mjs',import.meta.url),'utf8')
  const page=readFileSync(new URL('../app/admin/own-products/page.tsx',import.meta.url),'utf8')
  assert.match(sql,/product-images/)
  assert.match(sql,/file_size_limit,allowed_mime_types/)
  assert.match(sql,/private\.has_role\(\(select auth\.uid\(\)\),'admin'\)/)
  assert.match(sql,/own_product_images_admin_insert/)
  assert.match(sql,/own_product_images_admin_select/)
  assert.match(sql,/own_product_images_admin_delete/)
  assert.match(validator,/MAX_PRODUCT_IMAGE_BYTES = 5 \* 1024 \* 1024/)
  assert.match(validator,/image\/jpeg/)
  assert.match(validator,/image\/png/)
  assert.match(validator,/image\/webp/)
  assert.match(validator,/hasValidProductImageSignature/)
  assert.match(action,/validateProductImage/)
  assert.match(action,/requireAdmin\(\)/)
  assert.match(page,/name="image_file"/)
  assert.match(page,/accept="image\/jpeg,image\/png,image\/webp"/)
})

test('own-product preview UX has clean encoding, readiness messaging and readable admin navigation',()=>{
  const page=readFileSync(new URL('../app/admin/own-products/page.tsx',import.meta.url),'utf8')
  const action=readFileSync(new URL('../app/actions/admin.ts',import.meta.url),'utf8')
  const shell=readFileSync(new URL('../components/admin-shell.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(page,/Â/)
  assert.match(page,/JPEG, PNG or WebP — max 5 MB/)
  assert.match(page,/Own Product storage is not configured in this environment/)
  assert.match(action,/Own Product storage is not configured in this environment/)
  assert.match(action,/bucket not found/i)
  assert.match(shell,/lg:grid-cols-\[250px_minmax\(0,1fr\)\]/)
  assert.match(shell,/lg:whitespace-normal/)
})
