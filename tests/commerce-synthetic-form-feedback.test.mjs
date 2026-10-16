import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const commerce=read('app/commerce/page.tsx')
const action=read('app/actions/commerce.ts')
const server=read('lib/commerce/server.ts')
test('production commerce is visibly unavailable, never a misleading submit button',()=>{
 assert.match(commerce,/w\.can_admin&&\(!commerceEnabled\(\)\?/)
 assert.match(commerce,/Buy Alone offer requests are not active on Production/)
 assert.match(commerce,/This form creates synthetic Preview-only offers/)
 assert.match(commerce,/No request was submitted or approved/)
 assert.match(commerce,/Production checkout and Finance release must all pass/)
 assert.match(commerce,/role="status"/)
 assert.match(commerce,/Request a synthetic offer \(Preview test only\)/)
 assert.match(commerce,/Submit synthetic offer for independent approval/)
 assert.doesNotMatch(commerce,/disabled=\{!commerceEnabled\(\)\}>Submit for independent approval/)
})
test('irrelevant Pool Item and Group Deal IDs are never included for Buy Alone',()=>{
 assert.match(action,/p_pool_item:value\(fd,'mode'\)==='POOL'\?\(value\(fd,'pool_item_id'\)\|\|null\):null/)
 assert.match(action,/p_group:value\(fd,'mode'\)==='GROUP_DEAL'\?\(value\(fd,'group_deal_id'\)\|\|null\):null/)
 assert.match(commerce,/For Buy Alone, leave Pool Item ID and Group Deal ID blank/)
})
test('UI feedback does not weaken production checkout/Finance controls',()=>{
 assert.match(server,/process\.env\.VERCEL_ENV==='preview'/)
 assert.match(server,/COMMERCE_PREVIEW_SECRET/)
 assert.match(action,/commerceProof\(\)/)
 assert.match(action,/commerce_request_offer/)
 assert.match(action,/commerce_review_offer/)
 assert.doesNotMatch(action,/COMMERCE_PREVIEW_SECRET\s*=/)
 assert.doesNotMatch(commerce,/enableCheckout|allowProductionCommerce|service_role/)
})
