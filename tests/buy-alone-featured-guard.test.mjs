import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const featured=source('components/featured-products-carousel.tsx')
const storefront=source('components/public-marketplace.tsx')
const commerce=source('lib/commerce/server.ts')
const actions=source('app/actions/commerce.ts')

test('featured own/exclusive products show SOLO actions only for canonical approved offers',()=>{
 assert.match(featured,/import \{setCommerceCartItem\} from '@\/app\/actions\/commerce'/)
 assert.match(featured,/eligibleOffers\.find\(o=>Boolean\(o\.commerce_solo_id\)\)/)
 assert.match(featured,/canBuyAlone=Boolean\(selectedArea\)&&!item\.is_demo&&Boolean\(soloOffer\?\.commerce_solo_id&&soloOffer\.commerce_solo_available\)/)
 assert.match(featured,/canBuyAlone\?<form action=\{setCommerceCartItem\}/)
 assert.match(featured,/name="offer_id" value=\{soloOffer!\.commerce_solo_id\}/)
 assert.match(featured,/name="quantity" value="1"/)
 assert.match(featured,/soldOut/)
 assert.match(featured,/type="button" disabled aria-disabled="true"/)
 assert.doesNotMatch(featured,/commerceProof|COMMERCE_PREVIEW_SECRET|service_role/)
})

test('live production remains blocked until independently qualified, not toggled by CTA',()=>{
 assert.match(commerce,/process\.env\.VERCEL_ENV==='preview'/)
 assert.match(commerce,/process\.env\.COMMERCE_PREVIEW_SECRET/)
 assert.match(commerce,/if\(!commerceEnabled\(\)\)return \[\]/)
 assert.match(actions,/commerceProof\(\)/)
 assert.match(storefront,/offer\.commerce_solo_id/)
 assert.doesNotMatch(featured,/href="\/checkout"/)
})

test('storefront structure and design remains unchanged',()=>{
 assert.match(featured,/market-showcase-compact/)
 assert.match(featured,/market-showcase-cards/)
 assert.match(featured,/market-product-prices/)
 assert.match(featured,/market-product-actions/)
 assert.match(featured,/btn-secondary/)
 assert.match(featured,/chooseText\(language,en,bn\)/)
 assert.match(featured,/Choose area/)
 assert.match(featured,/Buy Alone · Soon/)
})
