import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {loadSource} from './helpers/load-tsx.mjs'

const data=await loadSource('lib/approved-live-detail-data.ts')
const totals=await loadSource('lib/whole-pool-tier-totals.ts')
const view=await loadSource('lib/approved-card-view.ts',{'./approved-live-detail-data':data,'./whole-pool-tier-totals':totals})
const simple=await loadSource('lib/simple-offers.ts')
const productId='8905c604-e7e0-4539-9ab4-74b13ceec2e1'
const offerId='89c05ee5-0a5f-4400-b24b-42029e879644'
const amt='a43f1829-3c09-4a59-9f12-bf81b9089b68'
const dohs='83bc642f-9e8b-4cad-9729-40b16a41934b'
const cy='72f63b1d-c689-4e68-b07d-02d703bf7165'
const fakeOffer={
 id:offerId,kind:'GROUP_DEAL',community_id:amt,community_ids:[amt,dohs],
 community_name:'Amin Model Town',title:'Butter Group Deal-001',
 closes_at:null,buyer_count:1,
 community_progress:[
  {community_id:amt,cycle_id:cy,buyer_count:1,closes_at:'2026-10-30T06:13:25.000Z'},
  {community_id:dohs,cycle_id:'0cadb01f-a648-4450-b56d-628d9a440b03',buyer_count:0,closes_at:'2026-10-30T06:13:25.000Z'}
 ],
 items:[{product_id:productId,name:'Pure Butter',brand:null,category:'Grocery',package_size:'1 kg',unit:'kg',
 image_url:'https://res.cloudinary.com/demo/image/upload/butter.webp',price:1230,old_price:1250,
 base_price:1230,available_quantity:47,next_threshold:3,next_price:1200,tiers:[{minimum:3,price:1200},{minimum:5,price:1180}]}]
}
let nominee=''
const fakeClient={
 rpc:async(name)=>{
  if(name==='get_public_simple_offers')return {data:[fakeOffer],error:null}
  if(name==='get_my_community_summary')return {data:nominee?[{community_id:nominee}]:[],error:null}
  if(name==='get_public_launch_catalog')return {data:[],error:null}
  if(name==='get_public_own_product_showcase')return {data:[],error:null}
  if(name==='get_public_storefront_offers')return {data:[],error:null}
  if(name==='get_public_featured_pools')return {data:[],error:null}
  if(name==='get_public_product_seo_slug_for_id')return {data:'',error:null}
  throw Error('Unexpected RPC '+name)
 }
}
const server=await loadSource('lib/approved-live-detail-server.ts',{
 'server-only':{},
 './simple-offers':simple,'@/lib/simple-offers':simple,
 './approved-card-view':view,'@/lib/approved-card-view':view,
 './approved-live-detail-data':data,'@/lib/approved-live-detail-data':data,
 '@/lib/supabase/server':{createClient:async()=>fakeClient},
 '@/lib/commerce/storefront':{withCommerceOffers:async xs=>xs},
 '@/lib/showcase-media':{publicShowcaseImageUrl:()=>true}
})

test('public chosen community progress persists from homepage to product details without onboarding',async()=>{
 nominee=''
 const product=await server.loadLivePublishedProduct(productId,amt)
 assert.equal(product.offers[0].buyer_count,1)
 assert.equal(product.offers[0].cycle_id,cy)
 assert.equal(product.offers[0].next_threshold,3)
 assert.equal(product.offers[0].upcoming_price,1200)
})
test('signed-in members retain nominated community scope, even with another area URL',async()=>{
 nominee=dohs
 const product=await server.loadLivePublishedProduct(productId,amt)
 assert.equal(product.offers[0].buyer_count,0)
 assert.equal(product.offers[0].cycle_id,'0cadb01f-a648-4450-b56d-628d9a440b03')
})
test('public area cannot be invented to spoof a cycle',async()=>{
 nominee=''
 for(const selected of ['00000000-0000-4000-8000-000000000111','not-uuid']){
  const product=await server.loadLivePublishedProduct(productId,selected)
  assert.equal(product.offers[0].buyer_count,0)
  assert.equal(product.offers[0].cycle_id,null)
 }
})
test('Pool detail uses the selected public community for the same offer cycles',async()=>{
 nominee=''
 const pool={...fakeOffer,kind:'COMMUNITY_POOL'}
 fakeClient.rpc=async name=>{
  if(name==='get_public_simple_offers')return {data:[pool],error:null}
  if(name==='get_my_community_summary')return {data:[],error:null}
  if(name==='get_public_featured_pools')return {data:[],error:null}
  return {data:[],error:null}
 }
 const rendered=await server.loadLivePublishedPool(offerId,amt)
 assert.equal(rendered.bundle[0].offer.buyer_count,1)
 assert.equal(rendered.sampleHouseholds,1)
})
test('onboarding never returns a raw duplicate-key error or treats zero updated profiles as success',()=>{
 const whole=readFileSync('app/actions/auth.ts','utf8')
 const auth=whole.split('export async function completeOnboarding')[1].split('export async function updateProfile')[0]
 assert.match(auth,/error\.code==='23505'/)
 assert.match(auth,/mobile number is already registered to another account/i)
 assert.match(auth,/\.select\('id'\)\.maybeSingle\(\)/)
 assert.match(auth,/if \(!updatedProfile\)/)
 assert.doesNotMatch(auth,/encodeURIComponent\(error\.message\)/)
})
