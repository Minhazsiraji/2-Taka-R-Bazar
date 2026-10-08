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
  assert.match(links,/\/about/);assert.match(links,/\/terms/);assert.match(links,/\/return-policy/);assert.match(links,/\/refund-policy/)
})

test('public SEO AEO GEO discovery assets are present',()=>{
  const layout=read('app/layout.tsx')
  const home=read('app/page.tsx')
  const site=read('lib/site.ts')
  const robots=read('app/robots.ts')
  const sitemap=read('app/sitemap.ts')
  const llms=read('app/llms.txt/route.ts')
  const proxy=read('proxy.ts')

  assert.match(layout,/metadataBase/)
  assert.match(site,/SITE_TAGLINE_EN = 'Smart shopping\. Real savings!'/)
  assert.match(site,/SITE_TAGLINE_BN = 'একসাথে কিনি, কম দামে পাই!'/)
  assert.match(layout,/title: \{ default: \`\$\{SITE_NAME\} \| \$\{SITE_TAGLINE_EN\}\`/)
  assert.doesNotMatch(layout,/Community Grocery Pooling in Savar/)
  assert.doesNotMatch(layout,/alternates:\s*\{\s*canonical:/)
  assert.match(home,/alternates:\s*\{\s*canonical:\s*SITE_URL/)
  assert.match(home,/application\/ld\+json/)
  assert.match(home,/WebPage/)
  assert.match(home,/ImageObject/)
  assert.match(home,/ContactPoint/)
  assert.match(site,/https:\/\/2takarbazar\.com/)
  assert.match(read('app/about/page.tsx'),/AboutPage/)
  assert.match(read('app/about/page.tsx'),/BreadcrumbList/)
  assert.match(read('app/faq/page.tsx'),/FAQPage/)
  assert.match(read('app/faq/page.tsx'),/BreadcrumbList/)
  assert.match(robots,/OAI-SearchBot/)
  assert.match(robots,/OAI-AdsBot/)
  assert.match(robots,/sitemap\.xml/)
  assert.match(robots,/\/money/)
  assert.match(sitemap,/SEO_UPDATED_AT/)
  assert.match(sitemap,/\/about/)
  assert.match(sitemap,/refund-policy/)
  assert.match(llms,/community grocery-pooling service/i)
  assert.match(llms,/SITE_URL/)
  assert.match(proxy,/X-Robots-Tag/)
  assert.match(proxy,/noindex, nofollow, noarchive/)
  assert.match(proxy,/\/money/)
})
