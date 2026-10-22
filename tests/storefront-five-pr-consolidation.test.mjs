import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const site=read('lib/site.ts')
const home=read('app/page.tsx')
const footer=read('components/storefront-footer.tsx')
const dev=read('components/site-footer.tsx')
const showcase=read('app/actions/own-product-showcase.ts')
const showcaseRoute=read('app/products/[id]/page.tsx')
const pool=read('components/featured-pool-showcase.tsx')
const pub=read('supabase/migrations/20261012071531_storefront_home_integration.sql')
const productPub=read('supabase/migrations/202610110001_exclusive_product_showcase.sql')
const header=read('components/public-header.tsx')

test('verified 2TBR contacts are separate from developer contact and secrets',()=>{
 assert.ok(site.includes("BUSINESS_CONTACT_EMAIL = 'business@2takarbazar.com'"))
 assert.ok(site.includes("SUPPORT_CONTACT_EMAIL = 'support@2takarbazar.com'"))
 assert.ok(site.includes('PUBLIC_CONTACT_EMAIL = SUPPORT_CONTACT_EMAIL'))
 assert.ok(footer.includes('mailto:business@2takarbazar.com'))
 assert.ok(footer.includes('mailto:support@2takarbazar.com'))
 assert.ok(footer.includes('business@agentsiraji.com'))
 assert.ok(dev.includes('business@agentsiraji.com'))
 assert.ok(!site.includes('smtp-relay.brevo.com'))
})

test('structured metadata uses business contact while customer service uses support',()=>{
 assert.ok(home.includes('email:BUSINESS_CONTACT_EMAIL'))
 assert.ok(home.includes("contactType:'customer service',email:SUPPORT_CONTACT_EMAIL"))
 assert.ok(!home.includes('email:PUBLIC_CONTACT_EMAIL'))
})

test('all five storefront PR scopes are represented with safe publication gates',()=>{
 // #56 product details/videos and administrator content publishing
 assert.ok(showcase.includes('saveOwnProductShowcase'))
 assert.ok(showcase.includes('requireAdmin()'))
 assert.ok(showcaseRoute.includes('ShowcaseProductGallery'))
 assert.ok(productPub.includes('get_public_own_product_showcase'))
 // #59 guest-first menu, #60 featured slider and design-locked gallery
 assert.ok(header.includes('market-mobile-navigation'))
 assert.ok(pool.includes('market-featured-pool-body'))
 // #61 real, narrow public Pool projection
 assert.ok(home.includes('get_public_featured_pools'))
 assert.ok(pub.includes('get_public_featured_pools'))
 // Do not turn on unaudited checkout or add real data from UI fixtures.
 assert.ok(home.includes('const demoMode=false'))
 assert.ok(site.includes('Smart shopping. Real savings!'))
 assert.ok(site.includes('একসাথে কিনি, কম দামে পাই!'))
})
