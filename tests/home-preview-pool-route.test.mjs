import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSource} from './helpers/load-tsx.mjs'

const fixtures=await loadSource('lib/home-card-preview-fixtures.ts')
const link=({href,children,...props})=>React.createElement('a',{href,...props},children)
const {PreviewHomeCards}=await loadSource('components/home-card-preview.tsx',{
 '@/lib/launch-cart':{addLaunchItem:()=>{},readLaunchCart:()=>[]},
 'next/navigation':{useRouter:()=>({refresh:()=>{},push:()=>{}})},
 '@/app/actions/simple-offer-joins':{joinSimpleSaleDeal:async()=>({ok:false})},
 'next/link':link,
 '@/lib/home-card-preview-fixtures':fixtures,
 './home-card-preview.css':{},
})
const parity=await loadSource('lib/preview-native-detail-data.ts',{'@/lib/home-card-preview-fixtures':fixtures})
const {HomePreviewPoolDetails}=await loadSource('components/home-preview-pool-details.tsx',{
 '@/lib/launch-cart':{addLaunchItem:()=>{},addLaunchItems:()=>true,readLaunchCart:()=>[]},
 'next/navigation':{useRouter:()=>({refresh:()=>{},push:()=>{}})},
 '@/app/actions/simple-offer-joins':{joinSimpleSalePool:async()=>({ok:false})},
 'next/link':link,
 '@/components/public-header':{PublicHeader:()=>null},
 '@/components/public-footer':{PublicFooter:()=>null},
 '@/lib/use-storefront-language':{useStorefrontLanguage:language=>[language,()=>{}]},
 '@/lib/home-card-preview-fixtures':fixtures,
 '@/lib/preview-native-detail-data':parity,
 './home-preview-pool-details.css':{},'./home-preview-native-details.css':{},
})

test('each homepage Pool CTA is a real detail-page link; no Pool modal path remains',()=>{
 const bn=renderToStaticMarkup(React.createElement(PreviewHomeCards,{section:'pools',language:'bn',search:''}))
 const en=renderToStaticMarkup(React.createElement(PreviewHomeCards,{section:'pools',language:'en',search:''}))
 for(const pool of fixtures.previewPools){
  const link='href="/demo-pool/'+pool.id+'?source=home"'
  assert.ok(bn.includes(link),link)
  assert.ok(en.includes(link),link)
 }
 assert.equal((bn.match(/href="\/demo-pool\/(weekly|monthly)\?source=home"/g)||[]).length,2)
 assert.ok(!bn.includes('<dialog'))
 const source=readFileSync('components/home-card-preview.tsx','utf8')
 assert.doesNotMatch(source,/setSelection\(\{kind:'pool'/)
 assert.doesNotMatch(source,/selection\.kind==='pool'/)
 assert.match(readFileSync('components/home-card-preview.css','utf8'),/\.app-card-preview-pool-bottom>a/)
})

test('Pool preview routing matches the selected homepage fixture and blocks Production',async()=>{
 let enabled=true
 const Page=(await loadSource('app/demo-pool/[slug]/page.tsx',{
  '@/app/pool-detail-refinement.css':{},
  'next/headers':{cookies:async()=>({get:()=>({value:'bn'})})},
  'next/navigation':{notFound:()=>{throw Error('NOT_FOUND')}},
  '@/lib/storefront-language':{
   languageFromPreference:()=> 'bn',isValidLanguagePreference:()=>true,STOREFRONT_LANGUAGE_COOKIE:'language'},
  '@/lib/public-demo-products':{demoStorefrontEnabled:()=>enabled,DEMO_AREAS:[],DEMO_OFFERS:[]},
  '@/lib/featured-pools':{getCommunityDemoFeaturedPools:()=>[{slug:'weekly',id:'legacy'}]},
  '@/lib/home-card-preview-fixtures':fixtures,
  '@/components/demo-pool-detail':{DemoPoolDetail:()=>null},
  '@/components/home-preview-pool-details':{HomePreviewPoolDetails:()=>null},
 })).default
 const open=(slug,source='home')=>Page({params:Promise.resolve({slug}),searchParams:Promise.resolve({source})})
 for(const pool of fixtures.previewPools){
  const page=await open(pool.id)
  assert.equal(page.props.pool.id,pool.id)
  assert.equal(page.props.pool.joined,pool.joined)
  assert.equal(page.props.pool.target,pool.target)
  assert.equal(page.props.initialLanguage,'bn')
 }
 assert.equal((await open('weekly','legacy')).props.pool.id,'legacy')
 await assert.rejects(open('unknown'),/NOT_FOUND/)
 enabled=false
 for(const pool of fixtures.previewPools)await assert.rejects(open(pool.id),/NOT_FOUND/)
})

test('Pool details match the locked Expo cards, unbounded progress, products and zero-selection basket',()=>{
 for(const pool of fixtures.previewPools){
  for(const language of ['en','bn']){
   const html=renderToStaticMarkup(React.createElement(HomePreviewPoolDetails,{
    pool,initialLanguage:language,hasLanguageCookie:true}))
   assert.ok(html.includes(language==='bn'?pool.nameBn:pool.name))
   const num=n=>new Intl.NumberFormat(language==='bn'?'bn-BD':'en-US').format(n)
   assert.ok(html.includes(num(pool.joined)))
   assert.ok(html.includes(num(pool.target)))
   assert.ok(html.includes('aria-valuenow="'+pool.joined+'"'))
   assert.ok(html.includes('aria-valuemax="'+pool.target+'"'))
   assert.equal((html.match(/class="home-preview-pool-product native-preview-pool-item/g)||[]).length,3)
   assert.equal((html.match(/aria-label="Increase /g)||[]).length,3)
   for(const id of pool.products){
    assert.ok(html.includes('href="/demo-product/'+id+'?kind=retail&amp;from=pool&amp;pool='+pool.id+'"'))
    const product=fixtures.previewProducts.find(p=>p.id===id)
    assert.ok(html.includes(language==='bn'?product.nameBn:product.name))
   }
   for(const label of [language==='bn'?'পুলের দাম কীভাবে কমে':'How Pool prices unlock',
    language==='bn'?'আপনার পুলের বাজার':'Your Pool basket'])assert.ok(html.includes(label),label)
   assert.equal((html.match(/<strong>—<\/strong>/g)||[]).length,3,'Zero selection has three dash totals')
   assert.ok(html.includes('disabled=""'))
   assert.ok(html.includes('0')||html.includes('০'))
   assert.ok(!html.includes('<dialog'))
   assert.ok(!html.includes('<form'))
  }
 }
 const source=readFileSync('components/home-preview-pool-details.tsx','utf8')
 for(const forbidden of ['fetch(', 'setCommerceCartItem', 'supabase', '<form'])assert.ok(!source.includes(forbidden),forbidden)
 assert.match(source,/changeQty/)
 assert.match(source,/Review Join Pool/)
})
test('Pool price math agrees exactly with approved native reference scenarios',()=>{
 const weekly=parity.previewPoolItems('weekly')
 const monthly=parity.previewPoolItems('monthly')
 const total=(items,qty,key)=>items.reduce((n,x)=>n+x.tiers[key]*(qty[x.product.id]??0),0)
 assert.equal(total(weekly,{butter:2,rice:1},'opening'),2475)
 assert.equal(total(weekly,{butter:2,rice:1},'current'),2340)
 assert.equal(total(weekly,{butter:2,rice:1},'next'),2230)
 assert.equal(total(monthly,{rice:2,ghee:1},'opening'),1030)
 assert.equal(total(monthly,{rice:2,ghee:1},'current'),970)
 assert.equal(total(monthly,{rice:2,ghee:1},'next'),920)
})
