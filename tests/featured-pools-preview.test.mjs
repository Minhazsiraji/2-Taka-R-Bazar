import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const data=read('lib/featured-pools.ts')
const fixture=read('lib/public-demo-products.ts')
const showcase=read('components/featured-pool-showcase.tsx')
const detail=read('components/demo-pool-detail.tsx')
const route=read('app/demo-pool/[slug]/page.tsx')
const home=read('components/public-marketplace.tsx')
const css=read('app/marketplace-flat.css')

test('weekly monthly special Pools auto rotate and retain manual navigation',()=>{
 for(const slug of ['weekly','monthly','special']){
  assert.match(data,new RegExp("slug:'"+slug+"'"))
 }
 assert.match(showcase,/ROTATION_MS=6500/)
 assert.match(showcase,/window\.setInterval\(/)
 assert.match(showcase,/window\.clearInterval\(/)
 assert.match(showcase,/document\.visibilityState==='visible'/)
 assert.match(showcase,/prefers-reduced-motion: reduce/)
 assert.match(showcase,/onMouseEnter=\{\(\)=>setPaused\(true\)\}/)
 assert.match(showcase,/onFocusCapture/)
 assert.match(showcase,/advance\(-1\)/)
 assert.match(showcase,/advance\(1\)/)
 assert.doesNotMatch(showcase,/market-pool-tabs/)
 assert.match(showcase,/\/demo-pool\/\$\{pool.slug\}/)
 assert.match(home,/getDemoFeaturedPools\(offers\)/)
})
test('Preview-only sample pools cannot be bought or published',()=>{
 assert.match(route,/demoStorefrontEnabled\(\)/)
 assert.match(route,/notFound\(\)/)
 assert.match(route,/index:false/)
 assert.match(fixture,/VERCEL_ENV === 'preview'/)
 assert.match(fixture,/process.env.VERCEL_ENV !== 'production'/)
 assert.match(detail,/disabled aria-disabled="true"/)
 assert.match(detail,/demo-product/)
 assert.match(detail,/No live promotion|prices and participation counts|DEMO POOL/)
 assert.doesNotMatch(showcase,/\.insert\(|\.update\(|\.from\(/)
 assert.doesNotMatch(detail,/\.insert\(|\.update\(|\.from\(/)
})
test('Pool full details include product breakdown, sample totals and delivery disclosure',()=>{
 for(const needle of ['featuredPoolTotals(pool)','pool.bundle.map','minHouseholds','৳20','৳30','৳1,000']){
  assert.ok(detail.includes(needle)||data.includes(needle),needle)
 }
 assert.match(detail,/market-pool-detail-items/)
 assert.match(css,/@media\(max-width:640px\)/)
 assert.match(css,/market-pool-detail-intro/)
 assert.match(css,/market-pool-tabs/)
})

test('one seamless background, transparent sections, hover details and demo review/supplier cards',()=>{
 const unified=read('app/marketplace-unified.css')
 const layout=read('app/layout.tsx')
 const lower=read('components/public-marketplace-lower.tsx')
 assert.match(layout,/marketplace-unified.css/)
 assert.match(unified,/background:transparent!important;background-image:none!important/)
 assert.match(unified,/market-band:not\(\.market-hero-band\)/)
 assert.match(unified,/market-product-overlay-link/)
 assert.match(unified,/translateY\(-5px\)/)
 assert.match(unified,/html\[data-theme="dark"\]/)
 assert.match(home,/market-product-overlay-link/)
 assert.match(lower,/demoMode\?<div className="market-demo-reviews">/)
 assert.match(lower,/NOT A CUSTOMER REVIEW/)
 assert.match(lower,/NOT AN APPROVED SUPPLIER/)
 assert.match(lower,/market-demo-suppliers/)
});
