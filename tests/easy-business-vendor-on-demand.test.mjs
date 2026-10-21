import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/admin/easy-business/page.tsx','utf8')

test('Easy Business accepts active real Quick Upload masters without mandatory SEO enrichment',()=>{
 assert.match(source,/\.eq\('active',true\)\.eq\('is_demo',false\)/)
 assert.match(source,/\{products\.length\} active masters/)
 assert.match(source,/SEO optional \/ later/)
 assert.match(source,/not published selling offers/)
 assert.doesNotMatch(source,/products\.filter\(p=>publishedIds\.has\(p\.id\)\)\.slice/)
 assert.doesNotMatch(source,/benchmarkByProduct\.has\(p\.id\)&&publishedIds\.has\(p\.id\)/)
})
test('Vendor-held on-demand products must be linked to real supplier before Pool placement',()=>{
 assert.match(source,/supplier_products'\)\.select\('product_id,supplier_id'\)\.eq\('active',true\)/)
 assert.match(source,/linkedVendors\.get\(p\.id\)\?\.size/)
 assert.match(source,/p\.source_type!=='SUPPLIER_POOL'/)
 assert.match(source,/Vendor not linked · on-demand supply not verified/)
 assert.match(source,/do not enter fictitious 2TBR stock/)
 assert.match(source,/Verify a local market price/)
})
test('No prices, inventory, orders, supplier links, approval or checkout are fabricated by Easy Business listing',()=>{
 for(const bad of ["from('own_product_inventory').insert","from('commerce_offers').insert","from('commerce_supplier_stock').insert","from('supplier_products').insert","service_role","enablePurchase","updateLedger"]){
  assert.ok(!source.includes(bad),bad)
 }
 assert.match(source,/addPoolItem/)
 assert.match(source,/poolLaunchChecklist/)
 assert.match(source,/The database still performs all final security and commercial validation/)
})
