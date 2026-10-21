import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSource} from './helpers/load-tsx.mjs'
const Link=({href,children,...props})=>React.createElement('a',{href,...props},children)
const chooseText=(language,en,bn)=>language==='bn'?bn:en
const formatPrice=n=>n>0?'৳'+Number(n).toLocaleString('en-BD'):'Price pending'
const {VendorProductCard}=await loadSource('components/vendor-product-card.tsx',{'next/link':Link,'./home-card-preview.css':{}})
const {MobileMarketplaceHome}=await loadSource('components/mobile-marketplace-home.tsx',{
 '@/components/vendor-product-card':{VendorProductCard},
 '@/components/home-card-preview':{PreviewHomeCards:()=>null},
 '@/components/live-preview-home-cards':{LivePreviewHomeCards:()=>null},
 '@/lib/approved-live-detail-data':{hasPublishedLiveContent:()=>false},
 'next/link':Link,'@/app/actions/commerce':{setCommerceCartItem:()=>{}},
 '@/lib/storefront':{formatPrice},'@/lib/storefront-language':{chooseText},
})
const base={areas:[],selectedArea:'area',onChooseArea:()=>{},onDetectArea:()=>{},detectingArea:false,
 offers:[],products:[],publishedProducts:{items:[],hasMore:false,nextOffset:0},pools:[],language:'en',demoMode:false,search:'',
 savings:{verified:false,thisMonth:null,previousMonth:null,lifetime:null,community:null}}
const offer={offer_id:'deal',offer_kind:'GROUP_DEAL',community_id:'area',product_id:'product',product_name:'Real rice',
 package_size:'5 kg',reference_price:1240,confirmed_price:null,upcoming_price:1075,price_status:'awaiting_threshold',
 buyer_count:2,next_threshold:10,closes_at:null,image_url:null}
const render=props=>renderToStaticMarkup(React.createElement(MobileMarketplaceHome,{...base,...props}))
test('pending deal never presents upcoming price as a confirmed selling price or a saving',()=>{
 const html=render({offers:[offer]})
 assert.ok(html.includes('Price pending'))
 assert.ok(html.includes('Price unlock pending'))
 assert.ok(!html.includes('1,075'))
 assert.ok(!html.includes('Save ৳'))
 assert.ok(html.includes('Join Deal'))
})
test('unlocked authoritative deal shows both prices and verified difference',()=>{
 const html=render({offers:[{...offer,confirmed_price:1075,price_status:'unlocked'}]})
 assert.ok(html.includes('৳1,075'))
 assert.ok(html.includes('<s>৳1,240</s>'))
 assert.ok(html.includes('৳165'))
})
test('synthetic deal does not claim verified saving or expose an active join',()=>{
 const html=render({offers:[{...offer,confirmed_price:1075,price_status:'unlocked',commerce_synthetic:true,commerce_group_id:'id',commerce_group_phase:'ready'}]})
 assert.ok(!html.includes('<s>৳1,240</s>'))
 assert.ok(html.includes('Joining unavailable'))
})
test('unknown Pool minimum remains unavailable instead of a fabricated target of one',()=>{
 const html=render({pools:[{id:'pool',slug:'weekly',title:{en:'Weekly pool',bn:'পুল'},subtitle:{en:'Area',bn:'এলাকা'},
 featuredProductIds:[],bundle:[],minHouseholds:null,sampleHouseholds:0,isDemo:false,image:null}]})
 assert.ok(html.includes('Target not published'))
 assert.ok(!html.includes('aria-valuemax="1"'))
})
test('only eligible priced in-stock SOLO offers render a cart form, alongside product details',()=>{
 const solo={...offer,offer_kind:'SOLO',solo_price:100,commerce_solo_id:'solo',commerce_solo_available:true,commerce_available_quantity:2}
 const ready=render({offers:[solo]})
 assert.ok(ready.includes('name="offer_id" value="solo"'))
 assert.ok(ready.includes('mhome-details-btn'))
 for(const variant of [{solo_price:null,confirmed_price:null},{commerce_available_quantity:0},{commerce_synthetic:true},{commerce_solo_available:false}]){
  const html=render({offers:[{...solo,...variant}]})
  assert.ok(!html.includes('name="offer_id" value="solo"'))
 }
})
const {PublicHeader}=await loadSource('components/public-header.tsx',{
 'next/link':Link,'next/navigation':{usePathname:()=>'/login'},'@/app/actions/auth':{signOut:()=>{}},
 '@/components/brand-logo':{BrandLogo:()=>null},'@/components/notification-bell':{NotificationBell:()=>React.createElement('a',{className:'customer-notification-bell',href:'/notifications'},'Notifications')},
 '@/components/header-action-icon':{HeaderActionIcon:()=>null},'@/components/theme-toggle':{ThemeToggle:()=>React.createElement('button',{className:'theme-toggle'},'Theme')},
 '@/lib/site':{SITE_TAGLINE_EN:'Smart shopping. Real savings!',SITE_TAGLINE_BN:'একসাথে কিনি, কম দামে পাই!'},
 '@/lib/storefront-language':{chooseText},
})
test('guest and member Account menus have appropriate destinations; login has no secondary nav',()=>{
 const guest=renderToStaticMarkup(React.createElement(PublicHeader,{storefront:true,authenticated:false}))
 assert.ok(guest.includes('Join the pool'))
 assert.ok(guest.includes('href="/login"'))
 assert.ok(!guest.includes('href="/money"'))
 assert.ok(!guest.includes('market-desktop-nav'))
 const member=renderToStaticMarkup(React.createElement(PublicHeader,{storefront:true,authenticated:true}))
 assert.ok(member.includes('href="/money"'))
 assert.ok(member.includes('href="/account/savings"'))
 assert.ok(member.includes('Sign out'))
 assert.ok(!member.includes('market-header-quick-money'))
})

test('public header DOM and keyboard order is Cart, language, theme, notifications, Account, Menu',()=>{
 const html=renderToStaticMarkup(React.createElement(PublicHeader,{storefront:true,authenticated:true}))
 const controls=['market-header-quick-cart','market-language-toggle','class="theme-toggle"','class="customer-notification-bell"','class="public-account-menu"','class="market-mobile-menu-button"']
 const positions=controls.map(control=>html.indexOf(control))
 assert.ok(positions.every(position=>position>=0))
 assert.deepEqual([...positions].sort((a,b)=>a-b),positions)
 assert.match(html,/<\/details><button type="button" class="market-mobile-menu-button"/)
})
test('join uses short bilingual copy while restricted deals retain their disabled state',()=>{
 const en=render({offers:[offer]})
 const bn=render({offers:[offer],language:'bn'})
 assert.match(en,/href="\/group-deals" class="mhome-join-deal">Join Deal /)
 assert.match(bn,/href="\/group-deals" class="mhome-join-deal">ডিলে যোগ দিন /)
 assert.ok(!en.includes('Join Group Deal'))
 for(const restricted of [{is_demo:true},{commerce_synthetic:true},{commerce_group_id:'closed',commerce_group_phase:'closed'}]){
  const html=render({offers:[{...offer,...restricted}]})
  assert.ok(!html.includes('mhome-join-deal'))
  assert.ok(html.includes('aria-disabled="true"'))
 }
})

test('legacy theme declarations remain identical for protected non-public interfaces',()=>{
 const source18=readFileSync('app/site-theme.css','utf8').replaceAll('main:not(.public-marketplace-flat) ','main ')
 assert.equal(createHash('sha256').update(source18).digest('hex'),'c108bf52a5a48f27523e46216570ded73e94760bc1564f70d7a657ea9b32e7fa')
 const source30=readFileSync('app/site-theme-surface-fix.css','utf8').replaceAll('main:not(.public-marketplace-flat) ','main ')
 assert.equal(createHash('sha256').update(source30).digest('hex'),'9b1c95bfab066299354875c602e12556556322a2fb73eafa9b7c1b88235aa6fe')
})

test('gloss highlight retains AA contrast for normal-size white primary labels',()=>{
 const css=readFileSync('app/public-app-design.css','utf8')
 const alpha=Number(css.match(/--public-button-fill:linear-gradient\(180deg,rgb\(255 255 255 \/ ([\d.]+)%\)/)[1])/100
 const linear=n=>(n/=255)<=.04045?n/12.92:((n+.055)/1.055)**2.4
 const luminance=[0,127,131].map(n=>255*alpha+n*(1-alpha)).reduce((v,n,i)=>v+linear(n)*[.2126,.7152,.0722][i],0)
 assert.ok(1.05/(luminance+.05)>=4.5,'The glossy highlight must not wash out white primary text')
})

test('real vendor products retain approved card presentation in Preview without fake checkout or stock',()=>{
 const vendorProducts=Array.from({length:6},(_,i)=>({product_id:'vendor-'+i,name:'Real product '+i,category:'Rice',package_size:'1 kg',image_url:'/real-photo.jpg',approved_unit_price:120+i,supplier_name:'Public vendor',supplier_handover_days:1}))
 for(const language of ['en','bn']){
  const html=render({vendorProducts,previewCards:true,language})
  assert.equal((html.match(/vendor-product-card/g)||[]).length,6)
  assert.ok(html.includes('app-card-preview-product-main'))
  assert.ok(html.includes('href="/vendor-products/vendor-0"'))
  assert.ok(html.includes('href="/pilot-book?product=vendor-0"'))
  assert.ok(html.includes('৳120'))
  assert.ok(!html.includes('name="offer_id"'))
  assert.ok(!html.includes('app-card-preview-save'))
  assert.ok(!html.includes('In stock'))
 }
})
