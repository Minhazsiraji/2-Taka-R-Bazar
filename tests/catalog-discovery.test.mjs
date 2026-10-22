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
test('first arrival shows all products; community selection filters to only eligible offers',()=>{
 const offers=[
  mk('rice','DOHS'),mk('sugar','AMT'),mk('oil','NIR'),mk('lentils','AMT'),
  mk('sugar','DOHS'),
 ]
 assert.deepEqual(browseCatalogOffers(offers).map(o=>o.product_id),['rice','sugar','oil','lentils'])
 const found=browseCatalogOffers(offers,{area:'AMT'})
 assert.deepEqual(found.map(o=>o.product_id),['sugar','lentils'])
 assert.equal(found.length,2)
 assert.equal(found.every(o=>o.community_id==='AMT'),true)
 assert.equal(browseCatalogOffers(offers,{area:'UNKNOWN'}).length,0)
})
test('category, mode and search always respect the selected community',()=>{
 const offers=[
  mk('rice','AMT','GROUP_DEAL','Rice'),
  mk('flour','DOHS','COMMUNITY_POOL','Flour'),
  mk('sugar','NIR','GROUP_DEAL','Sugar'),
  mk('oil','AMT','COMMUNITY_POOL','Oil'),
 ]
 assert.deepEqual(browseCatalogOffers(offers,{mode:'pool'}).map(o=>o.product_id),['flour','oil'])
 assert.deepEqual(browseCatalogOffers(offers,{area:'AMT',mode:'pool'}).map(o=>o.product_id),['oil'])
 assert.deepEqual(browseCatalogOffers(offers,{area:'AMT',category:'Sugar'}),[])
 assert.deepEqual(browseCatalogOffers(offers,{area:'NIR',search:'SUGAR'}).map(o=>o.product_id),['sugar'])
 assert.deepEqual(browseCatalogOffers(offers,{area:'AMT',search:'no-results'}),[])
})
test('unselected shoppers can discover, but cannot add cart items before choosing a community',()=>{
 assert.match(market,/!area\?<div className="market-product-actions/)
 assert.match(market,/onClick=\{\(\)=>\{selectArea\(offer.community_id\)/)
 assert.match(market,/Browse all communities freely/)
 assert.match(market,/browseCatalogOffers\(offers,\{area,mode,category,search\}\)/)
 assert.match(market,/commerce_solo_id\?<form action=\{setCommerceCartItem\}/)
 assert.match(market,/commerce_group_id\?<form action=\{setCommerceCartItem\}/)
})

test('a multi-community offer is discoverable once in every selected area',()=>{
 const offer={...mk('rice','DOHS'),community_ids:['DOHS','AMT']}
 for(const area of ['','DOHS','AMT'])assert.deepEqual(browseCatalogOffers([offer],{area}).map(o=>o.product_id),['rice'])
 assert.deepEqual(browseCatalogOffers([offer],{area:'NIR'}),[])
})
