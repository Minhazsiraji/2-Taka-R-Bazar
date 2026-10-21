import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSource} from './helpers/load-tsx.mjs'
const fixtures=await loadSource('lib/home-card-preview-fixtures.ts')
const {PreviewHomeCards}=await loadSource('components/home-card-preview.tsx',{
 '@/lib/home-card-preview-fixtures':fixtures,'./home-card-preview.css':{},
})
const render=(section,language='bn',search='')=>renderToStaticMarkup(React.createElement(PreviewHomeCards,{section,language,search}))
test('approved fixture values and labels render without pending price placeholders',()=>{
 const deal=render('deals')
 for(const value of ['GROUP DEAL','BUY TOGETHER • SAVE MORE','চিনিগুড়া চাল','৳135','৳165','৳30','4/5 joined','Ends in 2 days','বিস্তারিত','গ্রুপে যোগ দিন'])assert.ok(deal.includes(value),value)
 for(const value of ['Price pending','unlock pending','<form','offer_id'])assert.ok(!deal.includes(value),value)
 const exclusive=render('exclusive','en')
 for(const value of ['Premium Butter','Pure Cow Ghee','Chinigura Rice','Farm Fresh Eggs','৳1,160','৳1,240','৳680','৳780','৳145','In stock · 45 available','In stock · 24 available'])assert.ok(exclusive.includes(value),value)
 assert.equal((exclusive.match(/>View details<\/button>/g)||[]).length,4)
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
