import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSource} from './helpers/load-tsx.mjs'
const data=await loadSource('lib/approved-live-detail-data.ts')
const fixtures=await loadSource('lib/home-card-preview-fixtures.ts')
const parity=await loadSource('lib/preview-native-detail-data.ts',{'@/lib/home-card-preview-fixtures':fixtures})
const viewData=await loadSource('lib/approved-card-view.ts',{'./approved-live-detail-data':data})
const detailMocks={
 'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
 '@/components/public-header':{PublicHeader:()=>null},'@/components/public-footer':{PublicFooter:()=>null},
 '@/lib/use-storefront-language':{useStorefrontLanguage:lang=>[lang,()=>{}]},
 '@/lib/home-card-preview-fixtures':fixtures,'@/lib/preview-native-detail-data':parity,
}
const approvedCards=await loadSource('components/home-card-preview.tsx',detailMocks)
const approvedProduct=await loadSource('components/home-preview-product-details.tsx',detailMocks)
const approvedPool=await loadSource('components/home-preview-pool-details.tsx',detailMocks)
const id='84f4f885-2247-483e-8b05-25ca8d47a168'
const area='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const base={offer_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',product_id:id,community_id:area,
 product_name:'Real Rice',product_name_bn:'আসল চাল',brand:null,category:'Rice',package_size:'1 kg',
 unit:'kg',image_url:'https://res.cloudinary.com/demo/image/upload/rice.png',
 offer_title:'Community A',reference_price:165,confirmed_price:140,upcoming_price:null,
 buyer_count:6,quantity_joined:7,next_threshold:null,closes_at:null,price_status:'final',
 offer_kind:'COMMUNITY_POOL'}
const solo={...base,offer_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',offer_kind:'SOLO',
 solo_price:145,confirmed_price:145,commerce_solo_available:true,commerce_available_quantity:8}
const waiting={...base,offer_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',offer_kind:'GROUP_DEAL',
 confirmed_price:null,upcoming_price:135,next_threshold:10,price_status:'awaiting_threshold'}
const livePool={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slug:'weekly',isDemo:false,
 title:{en:'Real Weekly Pool',bn:'সাপ্তাহিক বাজার'},subtitle:{en:'Community A',bn:'কমিউনিটি'},
 featuredProductIds:[id],bundle:[{offer:base,qty:1}],sampleHouseholds:6,minHouseholds:null}
const product=data.productFromPublicSources(id,[solo,base,waiting],{
 product_id:id,title_en:'Real Rice',title_bn:'আসল চাল',sku:'RICE-101',
 description_en:'Published factual text',description_bn:'প্রকাশিত বিবরণ',
 brand:'Brand Name',brand_type:'UNBRANDED_LOOSE',
 image_url:base.image_url,alt_en:'Real rice',package_size:'1 kg',category:'Rice',
 specs:{storage:'Keep dry'},faqs:[{question_en:'FAQ?',answer_en:'Answer',question_bn:'প্রশ্ন?',answer_bn:'উত্তর'}]
},null)

test('public detail adapter never promotes draft, synthetic or upcoming prices',()=>{
 assert.equal(data.confirmedOfferPrice(waiting),null)
 assert.equal(data.confirmedOfferPrice({...waiting,price_status:'unlocked',confirmed_price:1120}),1120)
 assert.equal(data.confirmedOfferPrice(solo),145)
 assert.deepEqual(data.publishedLiveOffers([base,waiting,{...base,is_demo:true},{...base,commerce_synthetic:true}]).length,2)
 assert.equal(data.publishedLivePools([livePool,{...livePool,isDemo:true}]).length,1)
 assert.equal(data.publishedLivePools([{...livePool,id:'weekly'}]).length,0)
 assert.equal(product.sku,'RICE-101')
 assert.equal(product.brand,null,'Explicitly unbranded product is never rebranded from image')
 assert.equal(data.productFromPublicSources('wrong',[],null,null),null)
 assert.equal(data.hasPublishedLiveContent({offers:[],pools:[],catalog:[],products:[]}),false)
 assert.equal(data.hasPublishedLiveContent({offers:[base],pools:[],catalog:[],products:[]}),true)
})
test('Pool basket does not invent starting or next tier prices and does not count pending revenue',()=>{
 const confirmed=data.poolBasketTotals([base,solo],{[id]:2})
 assert.equal(confirmed.units,2,'Two same-product offers must never be counted twice')
});
test('Pool basket correct with actual unique products, quantities, confirmed and pending prices',()=>{
 const secondId='22222222-2222-4222-8222-222222222222'
 const second={...base,offer_id:'22222222-2222-4222-8222-222222222223',product_id:secondId,
  reference_price:1240,confirmed_price:1100}
 const basket=data.poolBasketTotals([base,second],{[id]:2,[secondId]:1})
 assert.equal(basket.units,3)
 assert.equal(basket.retail,1570)
 assert.equal(basket.current,1380)
 assert.equal(basket.saving,190)
 assert.equal(basket.opening,null)
 assert.equal(basket.next,null)
 assert.equal(data.poolBasketTotals([base,{...second,price_status:'pending_final_price',confirmed_price:null}],{[id]:2,[secondId]:1}).current,null)
 assert.equal(data.poolBasketTotals([base],{}).current,0)
})
test('real preview cards use published UUID detail paths without redrawing accepted card classes',async()=>{
 const {LivePreviewHomeCards}=await loadSource('components/live-preview-home-cards.tsx',{
  './home-card-preview':approvedCards,'@/lib/approved-card-view':viewData,
  'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
  '@/lib/approved-live-detail-data':data,
  '@/lib/showcase-media':{publicShowcaseImageUrl:()=>true},
  './home-card-preview.css':{},
 })
 const props={language:'en',search:'',selectedArea:'',data:{offers:[base,solo,waiting],pools:[livePool],
  products:[],catalog:[]}}
 const deal=renderToStaticMarkup(React.createElement(LivePreviewHomeCards,{...props,section:'deals'}))
 const exclusive=renderToStaticMarkup(React.createElement(LivePreviewHomeCards,{...props,section:'exclusive'}))
 const pool=renderToStaticMarkup(React.createElement(LivePreviewHomeCards,{...props,section:'pools'}))
 assert.ok(deal.includes('href="/preview-live/product/'+id+'?kind=deal'))
 assert.ok(!deal.includes('৳135'),'Pending price must not masquerade as confirmed')
 assert.ok(exclusive.includes('href="/preview-live/product/'+id+'"'))
 assert.ok(pool.includes('href="/preview-live/pool/'+livePool.id+'"'))
 assert.ok(deal.includes('app-card-preview-deal')&&exclusive.includes('app-card-preview-product')&&pool.includes('app-card-preview-pool'))
})
test('published client detail pages show the correct sections and no real writes',async()=>{
 const opts={
  './home-preview-product-details':approvedProduct,'./home-preview-pool-details':approvedPool,'@/lib/approved-card-view':viewData,
  'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
  '@/components/public-header':{PublicHeader:()=>null},
  '@/components/public-footer':{PublicFooter:()=>null},
  '@/lib/use-storefront-language':{useStorefrontLanguage:lang=>[lang,()=>{}]},
  '@/lib/approved-live-detail-data':data,
  './home-preview-native-details.css':{},'./home-preview-pool-details.css':{},
 }
 const {LiveApprovedProductDetails}=await loadSource('components/live-approved-product-details.tsx',opts)
 for(const kind of ['deal','exclusive','retail']){
  const html=renderToStaticMarkup(React.createElement(LiveApprovedProductDetails,{
   product,kind,initialLanguage:'en',hasLanguageCookie:true}))
  assert.ok(html.includes(product.name))
  assert.ok(html.includes('href="/preview-live/product/'+id))
  if(kind==='deal')assert.ok(html.includes('&amp;offer='+waiting.offer_id),'Keep the selected deal when opening product information')
  if(kind==='retail')for(const section of ['SEO','AEO','GEO','RICE-101','Published factual text'])assert.ok(html.includes(section))
 }
 const {LiveApprovedPoolDetails}=await loadSource('components/live-approved-pool-details.tsx',opts)
 const pool=renderToStaticMarkup(React.createElement(LiveApprovedPoolDetails,{
  pool:livePool,initialLanguage:'en',hasLanguageCookie:true}))
 assert.ok(pool.includes('Real Weekly Pool'))
 assert.ok(pool.includes('Increase Real Rice'))
 assert.ok(pool.includes('data-empty="true"'))
 assert.ok(!pool.includes('Next milestone not published'))
 assert.ok(pool.includes('Review Join Pool'))
 for(const path of ['components/live-approved-product-details.tsx','components/live-approved-pool-details.tsx','lib/approved-live-detail-server.ts']){
  const source=readFileSync(path,'utf8')
  for(const forbidden of ['service_role','setCommerceCartItem','insert(','delete(','update(','<form'])assert.ok(!source.includes(forbidden),path+' contains '+forbidden)
 }
})

test('real-data preview routes reject invalid IDs and remain unavailable in Production',async()=>{
 let enabled=true
 const mocks={
  'next/headers':{cookies:async()=>({get:()=>({value:'en'})})},
  'next/navigation':{notFound:()=>{throw Error('NOT_FOUND')}},
  '@/lib/public-demo-products':{demoStorefrontEnabled:()=>enabled},
  '@/lib/approved-live-detail-server':{
   loadLivePublishedProduct:async id=>id===product.id?product:null,
   loadLivePublishedPool:async id=>id===livePool.id?livePool:null,
  },
  '@/lib/approved-live-detail-data':data,
  '@/lib/storefront-language':{
   STOREFRONT_LANGUAGE_COOKIE:'language',languageFromPreference:()=> 'en',
   isValidLanguagePreference:()=>true,
  },
  '@/components/live-approved-product-details':{LiveApprovedProductDetails:()=>null},
  '@/components/live-approved-pool-details':{LiveApprovedPoolDetails:()=>null},
 }
 const ProductPage=(await loadSource('app/preview-live/product/[id]/page.tsx',mocks)).default
 const PoolPage=(await loadSource('app/preview-live/pool/[id]/page.tsx',mocks)).default
 const pp=id=>ProductPage({params:Promise.resolve({id}),searchParams:Promise.resolve({kind:'deal'})})
 const pool=id=>PoolPage({params:Promise.resolve({id})})
 assert.equal((await pp(product.id)).props.product.id,product.id)
 assert.equal((await pool(livePool.id)).props.pool.id,livePool.id)
 await assert.rejects(pp('rice'),/NOT_FOUND/)
 await assert.rejects(pool('weekly'),/NOT_FOUND/)
 enabled=false
 await assert.rejects(pp(product.id),/NOT_FOUND/)
 await assert.rejects(pool(livePool.id),/NOT_FOUND/)
})
test('conflicting community retail benchmarks do not become a fabricated single market price',()=>{
 assert.equal(data.productFromPublicSources(id,[base,{...base,reference_price:170}],null,null).retail,null)
})
