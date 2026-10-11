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

test('weekly monthly special Pool modes and real tab interaction are present',()=>{
 for(const slug of ['weekly','monthly','special']){
  assert.match(data,new RegExp("slug:'"+slug+"'"))
  assert.match(showcase,new RegExp("'"+slug+"'"))
 }
 assert.match(showcase,/setKind\(value\)/)
 assert.match(showcase,/aria-pressed=\{kind===value\}/)
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
