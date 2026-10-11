import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const lower=read('components/public-marketplace-lower.tsx')
const storefront=read('components/public-marketplace.tsx')
const css=read('app/marketplace-story.css')
const doc=read('docs/public-marketplace-dual-mode-contract.md')
test('public homepage contains distinct lower sections and verified area data',()=>{
 for(const section of ['popular-nearby','how-it-works','our-communities','why-2tbr','customer-experiences','supplier-network','marketplace-faq'])assert.match(lower,new RegExp(section))
 assert.match(lower,/offers\.filter\(/)
 assert.match(lower,/buyer_count/)
 assert.match(lower,/quantity_joined/)
 assert.match(lower,/onChooseArea/)
 assert.match(storefront,/PublicMarketplaceLower/)
 assert.match(storefront,/Filter product category/)
})
test('reviews are never represented as real without explicit publication consent',()=>{
 assert.match(lower,/haven.t published any customer testimonials yet/)
 assert.match(lower,/specific publication consent/)
 assert.match(doc,/NOT publication permission/)
 assert.doesNotMatch(lower,/Rahima Akter|1,00,000\+|35%|1,840/)
})
test('delivery copy and dual-source solo proposal are accurate',()=>{
 for(const token of ['৳20','৳30','৳1,000','Community-point pickup'])assert.match(lower,new RegExp(token))
 assert.match(lower,/2TBR-stocked products/)
 assert.match(lower,/Verified supplier-listed products/)
 assert.match(doc,/both 2TBR stocked products AND authorized supplier-listed products/i)
 assert.match(lower,/Individual checkout is not open yet/)
})
test('responsive accessible section layouts are preserved',()=>{
 assert.match(css,/@media\(max-width:640px\)/)
 assert.match(css, /\.market-faq/)
 assert.match(lower,/<details/)
 assert.match(lower,/aria-pressed=/)
})
