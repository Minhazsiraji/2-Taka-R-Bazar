import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(rel)=>readFileSync(new URL(`../${rel}`,import.meta.url),'utf8')

test('customer confirmation requires current policy acceptance',()=>{
  const page=read('app/orders/page.tsx')
  const action=read('app/actions/customer.ts')
  assert.match(page,/policy_accepted/)
  assert.match(page,/CURRENT_POLICY_VERSION/)
  assert.match(page,/Terms & Conditions \/ ব্যবহারের শর্তাবলি/)
  assert.match(page,/Return Policy \/ রিটার্ন নীতি/)
  assert.match(page,/Refund Policy \/ রিফান্ড নীতি/)
  assert.match(action,/policyAccepted/)
  assert.match(action,/policyVersion !== CURRENT_POLICY_VERSION/)
})

test('bilingual legal pages and footer links exist',()=>{
  for(const file of ['app/terms/page.tsx','app/return-policy/page.tsx','app/refund-policy/page.tsx']){
    const content=read(file)
    assert.match(content,/titleBn/)
    assert.match(content,/summaryBn/)
  }
  const links=read('lib/legal.ts')
  assert.match(links,/\/terms/);assert.match(links,/\/return-policy/);assert.match(links,/\/refund-policy/)
})

test('public SEO AEO GEO discovery assets are present',()=>{
  assert.match(read('app/layout.tsx'),/metadataBase/)
  assert.match(read('app/page.tsx'),/application\/ld\+json/)
  assert.match(read('app/faq/page.tsx'),/FAQPage/)
  assert.match(read('app/robots.ts'),/sitemap\.xml/)
  assert.match(read('app/sitemap.ts'),/refund-policy/)
  assert.match(read('public/llms.txt'),/community grocery-pooling service/i)
})
