import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const product=read('components/public-seo-product-page.tsx')
const seo=read('lib/product-seo-public.ts')
const home=read('components/mobile-marketplace-home.tsx')
const commerce=read('components/commerce-content.tsx')
const cart=read('app/cart/page.tsx')

test('Product EN/Bangla UI links remain relative to the Preview host',()=>{
 assert.match(product,/localePaths=\{en:'\/p\/'\+p\.slug,bn:'\/bn\/p\/'\+p\.slug\}/)
 assert.match(product,/href=\{localePaths\.en\}/)
 assert.match(product,/href=\{localePaths\.bn\}/)
 assert.doesNotMatch(product,/href=\{urls\.(en|bn)\}/)
 assert.match(seo,/canonical:urls\[locale\]/) // Absolute canonical SEO remains intact.
 assert.match(seo,/languages:\{'en-BD':urls\.en,'bn-BD':urls\.bn/)
})

test('Search no-match is distinct from an unpublished catalog',()=>{
 assert.match(home,/query\s*\?t\('No products match your search\.'/)
 assert.match(home,/:'?/) // Branch retains the published-inventory empty state.
 assert.match(home,/t\('Products will appear as soon as they are published\.'/)
})

test('Empty cart has card shells with inset glass empty states',()=>{
 assert.match(cart,/<section className="commerce-cart-block glass-panel rounded-3xl/)
 assert.match(cart,/commerce-cart-empty glass-subpanel mt-3 rounded-2xl/)
 assert.match(cart,/ready\.length===0\?<p role="status"/)
 assert.match(cart,/waiting\.length===0\?<p role="status"/)
 assert.match(cart,/commerce-cart-block glass-panel mt-8/)
})

test('Cart renders only one language toggle through the shared public header',()=>{
 assert.match(commerce,/<PublicHeader storefront/)
 assert.match(commerce,/onLanguageChange=\{next=>\{setLanguage\(next\);router\.refresh\(\)\}\}/)
 assert.doesNotMatch(commerce,/<button[^>]*Switch to Bangla/)
 assert.doesNotMatch(commerce,/\{language==='bn'\?'EN':'BAN'\}/)
})

test('English cart displays full English messages instead of mixed Bangla',()=>{
 assert.match(cart,/কার্ট লোড হয়নি। আবার চেষ্টা করুন। \/ Your cart could not be loaded/)
 assert.match(cart,/পাইলট বুকিং চালু \/ Customer bookings open/)
 assert.match(cart,/আমার বুকিং \/ My bookings/)
 assert.match(cart,/এখন কেনার মতো পণ্য নেই। \/ No payable items yet/)
 assert.match(cart,/দাম ও স্টক আবার যাচাই হবে। \/ Prices and availability/)
 assert.match(cart,/সম্মতি দিতে হবে। \/ No charge is taken/)
 assert.match(cart,/আনলকের অপেক্ষায় কোনো পণ্য নেই। \/ No products are waiting to unlock/)
 assert.match(commerce,/copy\(error,language\)/)
})

test('Cart changes do not rewrite the approved homepage or frozen Expo source',()=>{
 assert.match(cart,/CommerceFrame title="কার্ট \/ Shopping cart"/)
 assert.match(home,/mhome-hero/)
 assert.match(home,/mhome-savings/)
})
