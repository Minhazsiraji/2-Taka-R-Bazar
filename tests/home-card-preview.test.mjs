import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSource} from './helpers/load-tsx.mjs'
const fixtures=await loadSource('lib/home-card-preview-fixtures.ts')
const {PreviewHomeCards}=await loadSource('components/home-card-preview.tsx',{
 'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
 '@/lib/home-card-preview-fixtures':fixtures,'./home-card-preview.css':{},
})
const render=(section,language='bn',search='')=>renderToStaticMarkup(React.createElement(PreviewHomeCards,{section,language,search}))
test('approved fixture values and labels render without pending price placeholders',()=>{
 const deal=render('deals')
 for(const value of ['GROUP DEAL','BUY TOGETHER • SAVE MORE','চিনিগুড়া চাল','৳135','৳165','৳30','4/5 joined','Ends in 2 days','বিস্তারিত','গ্রুপে যোগ দিন'])assert.ok(deal.includes(value),value)
 for(const value of ['Price pending','unlock pending','<form','offer_id'])assert.ok(!deal.includes(value),value)
 const exclusive=render('exclusive','en')
 for(const value of ['Premium Butter','Pure Cow Ghee','Chinigura Rice','Farm Fresh Eggs','৳1,160','৳1,240','৳680','৳780','৳145','In stock · 45 available','In stock · 24 available'])assert.ok(exclusive.includes(value),value)
 assert.equal((exclusive.match(/>View details<\/a>/g)||[]).length,4)
 assert.equal((exclusive.match(/>Add to cart<\/button>/g)||[]).length,4)
 assert.ok(!exclusive.includes('<form'))
 const pools=render('pools')
 for(const value of ['মার্কেটিং পুল','মাসিক পুল','সাপ্তাহিক পরিবারের বাজার','মাসিক বাজার পুল','ACTIVE','875','1,320','1,000','1,500','23 Oct','5 Nov'])assert.ok(pools.includes(value),value)
 assert.equal((pools.match(/<img /g)||[]).length,6)
})
test('preview search filters the approved product and deal fixtures',()=>{
 for(const section of ['deals','exclusive'])assert.ok(!render(section,'en','no-such-product').includes('<article'))
 assert.ok(render('exclusive','bn','তাজা').includes('তাজা ডিম'))
 assert.ok(!render('exclusive','bn','তাজা').includes('প্রিমিয়াম বাটার'))
})
test('Production cannot enable preview card fixtures, even with a populated real catalog',async()=>{
 for(const nodeEnv of ['production','development','test']){
  const production=await loadSource('lib/public-demo-products.ts',{}, {NODE_ENV:nodeEnv,VERCEL_ENV:'production'})
  assert.equal(production.demoStorefrontEnabled(),false)
 }
 const preview=await loadSource('lib/public-demo-products.ts',{}, {NODE_ENV:'production',VERCEL_ENV:'preview'})
 assert.equal(preview.demoStorefrontEnabled(),true)
 const page=readFileSync('app/page.tsx','utf8')
 assert.ok(page.includes('previewCards={demoStorefrontEnabled()}'))
 const home=readFileSync('components/mobile-marketplace-home.tsx','utf8')
 assert.ok(home.includes('previewCards=false'))
 const component=readFileSync('components/home-card-preview.tsx','utf8')
 assert.doesNotMatch(component,/fetch\(|localStorage|setCommerceCartItem|supabase|action=|<form/)
})

test('each preview Details action links to its matching full page, preserving deal price context',()=>{
 const exclusive=render('exclusive','en')
 for(const p of fixtures.previewProducts)assert.ok(exclusive.includes('href="/demo-product/'+p.id+'"'))
 const deals=render('deals','en')
 for(const d of fixtures.previewDeals)assert.ok(deals.includes('href="/demo-product/'+d.id+'?kind=deal"'))
 assert.ok(!exclusive.includes('<dialog'))
})
test('preview detail route resolves fixture links, preserves legacy demos and rejects Production access',async()=>{
 let enabled=true
 const Page=(await loadSource('app/demo-product/[id]/page.tsx',{
  'next/headers':{cookies:async()=>({get:()=>({value:'bn'})})},
  'next/navigation':{notFound:()=>{throw Error('NOT_FOUND')}},
  '@/lib/storefront-language':{languageFromPreference:()=> 'bn',isValidLanguagePreference:()=>true,STOREFRONT_LANGUAGE_COOKIE:'language'},
  '@/lib/public-demo-products':{demoStorefrontEnabled:()=>enabled,DEMO_OFFERS:[{product_id:'legacy-id'}]},
  '@/lib/home-card-preview-fixtures':fixtures,
  '@/components/home-preview-product-details':{HomePreviewProductDetails:()=>null},
  '@/components/demo-product-details':{DemoProductDetails:()=>null},
 })).default
 const open=(id,kind)=>Page({params:Promise.resolve({id}),searchParams:Promise.resolve({kind})})
 for(const p of fixtures.previewProducts){
  const page=await open(p.id)
  assert.equal(page.props.product.id,p.id)
  assert.equal(page.props.product.price,p.price)
  assert.equal(page.props.deal,undefined)
  assert.equal(page.props.initialLanguage,'bn')
 }
 for(const d of fixtures.previewDeals)assert.equal((await open(d.id,'deal')).props.deal.price,d.price)
 assert.equal((await open('legacy-id')).props.offer.product_id,'legacy-id')
 await assert.rejects(open('missing'),/NOT_FOUND/)
 enabled=false
 for(const id of ['butter','rice','legacy-id'])await assert.rejects(open(id),/NOT_FOUND/)
})
test('full-page preview details retain matching prices and stock in both languages without real commerce',async()=>{
 const {HomePreviewProductDetails}=await loadSource('components/home-preview-product-details.tsx',{
  'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
  '@/components/public-header':{PublicHeader:()=>null},'@/components/public-footer':{PublicFooter:()=>null},
  '@/lib/use-storefront-language':{useStorefrontLanguage:language=>[language,()=>{}]},
  '@/lib/home-card-preview-fixtures':fixtures,'./home-card-preview.css':{},
 })
 for(const language of ['en','bn'])for(const product of fixtures.previewProducts){
  const html=renderToStaticMarkup(React.createElement(HomePreviewProductDetails,{product,initialLanguage:language,hasLanguageCookie:true}))
  for(const value of [language==='bn'?product.nameBn:product.name,fixtures.previewMoney(product.price),fixtures.previewMoney(product.oldPrice),String(product.stock)])assert.ok(html.includes(value),value)
  assert.ok(!html.includes('<dialog'))
  assert.ok(html.includes('href="/#mobile-exclusive"'))
 }
 const product=fixtures.previewProducts.find(p=>p.id==='rice')
 const deal=fixtures.previewDeals.find(p=>p.id==='rice')
 const html=renderToStaticMarkup(React.createElement(HomePreviewProductDetails,{product,deal,initialLanguage:'en',hasLanguageCookie:true}))
 assert.ok(html.includes('৳135'))
 assert.ok(html.includes('4/5 joined'))
 const source=readFileSync('components/home-preview-product-details.tsx','utf8')
 assert.doesNotMatch(source,/fetch\(|setCommerceCartItem|supabase|action=|<form/)
})
