import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {browseCatalogOffers} from '../lib/catalog-discovery.mjs'

const demo=readFileSync(new URL('../lib/public-demo-products.ts',import.meta.url),'utf8')
const market=readFileSync(new URL('../components/public-marketplace.tsx',import.meta.url),'utf8')
const mk=(product_id,community_id,offer_kind='GROUP_DEAL',category='Rice')=>({
 offer_id:community_id+product_id,product_id,community_id,offer_kind,category,
 product_name:'Sample '+product_id,product_name_bn:'নমুনা',
 brand:'2TBR Demo',offer_title:'Preview only'
})
test('preview catalog contains nine explicitly demo-only distinct product illustrations',()=>{
 const ids=[...demo.matchAll(/id:'00000000-0000-4000-8000-0000000001\d\d'/g)]
 assert.equal(ids.length,9)
 assert.match(demo,/is_demo:true/)
 assert.match(demo,/DEMO_AREAS\[i%DEMO_AREAS.length\]/)
 for(const img of ['salt','milk','tea']){
  assert.ok(existsSync(new URL('../public/demo-products/'+img+'.svg',import.meta.url)))
 }
})
test('selected community sorts its products first without hiding other communities',()=>{
 const offers=[
  mk('rice','DOHS'),mk('sugar','AMT'),mk('oil','NIR'),mk('lentils','AMT'),
  mk('sugar','DOHS'),
 ]
 const found=browseCatalogOffers(offers,{area:'AMT'})
 assert.deepEqual(found.map(o=>o.product_id),['sugar','lentils','rice','oil'])
 assert.equal(found.filter(o=>o.community_id==='AMT').length,2)
 assert.equal(found.length,4)
})
test('mode, category and search operate across all areas, not only selected community',()=>{
 const offers=[
  mk('rice','AMT','GROUP_DEAL','Rice'),
  mk('flour','DOHS','COMMUNITY_POOL','Flour'),
  mk('sugar','NIR','GROUP_DEAL','Sugar'),
 ]
 assert.deepEqual(browseCatalogOffers(offers,{area:'AMT',mode:'pool'}).map(o=>o.product_id),['flour'])
 assert.deepEqual(browseCatalogOffers(offers,{area:'AMT',category:'Sugar'}).map(o=>o.product_id),['sugar'])
 assert.deepEqual(browseCatalogOffers(offers,{area:'AMT',search:'SUGAR'}).map(o=>o.product_id),['sugar'])
 assert.deepEqual(browseCatalogOffers(offers,{area:'AMT',search:'no-results'}),[])
})
test('other-community cards cannot directly submit Buy Alone cart or Group Deal commitment',()=>{
 assert.match(market,/const isOutsideArea=Boolean\(area&&offer.community_id!==area\)/)
 assert.match(market,/isOutsideArea\?<div className="market-product-actions/)
 assert.match(market,/onClick=\{\(\)=>selectArea\(offer.community_id\)\}/)
 assert.match(market,/Your community offers appear first/)
 assert.match(market,/browseCatalogOffers\(offers,\{area,mode,category,search\}\)/)
 assert.match(market,/commerce_solo_id\?<form action=\{setCommerceCartItem\}/)
 assert.match(market,/commerce_group_id\?<form action=\{setCommerceCartItem\}/)
})
