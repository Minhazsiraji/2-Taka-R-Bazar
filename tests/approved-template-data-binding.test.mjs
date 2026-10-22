import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSource} from './helpers/load-tsx.mjs'
const data=await loadSource('lib/approved-live-detail-data.ts')
const wholePool=await loadSource('lib/whole-pool-tier-totals.ts')
const view=await loadSource('lib/approved-card-view.ts',{'./approved-live-detail-data':data,'./whole-pool-tier-totals':wholePool})
const fixtures=await loadSource('lib/home-card-preview-fixtures.ts')
const {PreviewHomeCards}=await loadSource('components/home-card-preview.tsx',{
 '@/lib/launch-cart':{addLaunchItem:()=>{},readLaunchCart:()=>[]},
 'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
 'next/navigation':{useRouter:()=>({refresh:()=>{},push:()=>{}})},
 '@/app/actions/simple-offer-joins':{joinSimpleSaleDeal:async()=>({ok:false})},
 '@/lib/home-card-preview-fixtures':fixtures,
})
const vendor={product_id:'00000000-0000-4000-8000-000000000821',name:'Published rice',category:'Grocery',package_size:'1 kg',image_url:'https://example.test/rice.webp',approved_unit_price:120,supplier_name:'Public supplier',supplier_handover_days:1}
const empty={offers:[],pools:[],catalog:[],products:[]}
const render=(section,model)=>renderToStaticMarkup(React.createElement(PreviewHomeCards,{section,language:'en',search:'',view:model}))
test('approved styles, header, footer, layout imports, colors and image holders are byte-identical to owner reference',()=>{
 const contract=JSON.parse(readFileSync('docs/approved-template-data-contract.json'))
 for(const [path,hash] of Object.entries(contract.sha256))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,path)
})
test('public vendor data fills the exact approved card fields, without invented savings or availability',()=>{
 const rows=view.approvedHomeView({...empty,vendorProducts:[vendor]})
 assert.equal(rows.products[0].price,120)
 assert.equal(rows.products[0].oldPrice,null)
 assert.equal(rows.products[0].stock,null)
 const html=render('exclusive',rows)
 for(const text of ['Published rice','৳120','app-card-preview-product-image','Add to cart','View details','In stock · 0 available'])assert.ok(html.includes(text),text)
 for(const forbidden of ['Request booking','Vendor-held','Subject to confirmation','PUBLISHED','Stock not confirmed','Price pending'])assert.ok(!html.includes(forbidden),forbidden)
 assert.ok(html.includes('class="app-card-preview-stock" data-empty="true"'))
 assert.ok(html.includes('href="/preview-live/product/'+vendor.product_id+'"'))
 assert.equal((html.match(/<button/g)||[]).length,1)
 assert.ok(html.includes('disabled=""'))
})
test('empty feeds preserve approved shells with zeroes and blur, without fabricated records or actionable links',()=>{
 const rows=view.approvedHomeView(empty)
 assert.equal(rows.products.length,4);assert.equal(rows.deals.length,2);assert.equal(rows.pools.length,2)
 for(const section of ['deals','exclusive','pools']){
  const html=render(section,rows)
  assert.ok(html.includes('data-empty="true"'))
  assert.ok(html.includes('inert=""'))
  assert.ok(!html.includes('No published'))
  assert.ok(!html.includes('/demo-product/'))
 }
})
test('vendor prices require a valid public record and never create a fake commerce offer',()=>{
 const rows=view.approvedHomeView({...empty,vendorProducts:[{...vendor,product_id:'bad'},{...vendor,approved_unit_price:-1},vendor]})
 assert.equal(rows.products.length,1)
 assert.equal(rows.products[0].stock,null)
 const product={id:vendor.product_id,name:vendor.name,nameBn:vendor.name,unit:'1 kg',sku:null,category:'Grocery',brand:null,image:vendor.image_url,alt:vendor.name,retail:null,listingPrice:120,description:'',descriptionBn:'',seo:null,offers:[]}
 const details=view.approvedProductView(product)
 assert.equal(details.product.price,120)
 assert.equal(details.source.offers.length,0)
 assert.equal(details.offers[0].empty,true)
 assert.equal(details.product.oldPrice,null)
 const withGroup=view.approvedProductView({...product,offers:[{offer_id:'group',offer_kind:'GROUP_DEAL',product_id:product.id,price_status:'unlocked',confirmed_price:100}]})
 assert.equal(withGroup.product.price,120,'A different Group Deal price cannot replace the vendor listing price')
 assert.equal(withGroup.offers.find(o=>o.kind==='solo').empty,true)
 assert.equal(withGroup.offers.find(o=>o.kind==='solo').price,120)
})
test('live detail components delegate to the locked templates rather than alternative layouts',()=>{
 assert.match(readFileSync('components/live-approved-product-details.tsx','utf8'),/<HomePreviewProductDetails/)
 assert.match(readFileSync('components/live-approved-pool-details.tsx','utf8'),/<HomePreviewPoolDetails/)
 assert.match(readFileSync('components/live-preview-home-cards.tsx','utf8'),/<PreviewHomeCards/)
})

 test('owner-authorized launch availability and optional zero old price use the existing card fields',()=>{
 const rows=view.approvedHomeView({...empty,vendorProducts:[{...vendor,available_quantity:100,old_price:0,launch_enabled:true}]})
 assert.equal(rows.products[0].stock,100)
 assert.equal(rows.products[0].oldPrice,0)
 assert.equal(rows.products[0].purchasable,true)
 const html=render('exclusive',rows)
 assert.ok(html.includes('In stock · 100 available'))
 assert.ok(html.includes('<s>৳0</s>'))
 assert.ok(!html.includes('disabled=""'))
 assert.equal((html.match(/<button/g)||[]).length,1)
 const soldOut=view.approvedHomeView({...empty,vendorProducts:[{...vendor,available_quantity:0,old_price:0,launch_enabled:true}]})
 assert.equal(soldOut.products[0].purchasable,false)
 })
