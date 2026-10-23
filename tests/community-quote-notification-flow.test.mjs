import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('closed community round notifications show authenticated customer quote amount and next step',()=>{
 const page=readFileSync('app/notifications/page.tsx','utf8')
 assert.match(page,/\.eq\('customer_id',user\.id\)/)
 assert.match(page,/community_quote\|shared_quote_ready/)
 assert.match(page,/Your locked product amount is/)
 assert.match(page,/Select delivery now/)
 assert.match(page,/Review and explicitly accept the total/)
 assert.match(page,/Accepted total:/)
 assert.match(page,/Transfer submitted/)
 assert.match(page,/No confirmed order has been created yet/)
 assert.match(page,/stage\?\.body\?\?note\.body/)
 assert.match(page,/action=\{openNotification\}/)
})
test('customer commitments explain deadline with no tier and show progressive consent gates',()=>{
 const page=readFileSync('app/account/commitments/page.tsx','utf8')
 assert.match(page,/starting price applies if no discount tier was reached/)
 assert.match(page,/No discount tier unlocked: starting product price applies/)
 assert.match(page,/choose your delivery now/)
 assert.match(page,/Complete final quote ready/)
 assert.match(page,/Do not make payment yet/)
 assert.match(page,/Only independently verified payment creates an order/)
})
