import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('closed community notifications show the current customer-owned quote and next step',()=>{
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
 assert.match(page,/href=\{safeNotificationHref\(note\.href\)\}/)
 assert.match(page,/action=\{markNotificationRead\}/)
 assert.doesNotMatch(page,/action=\{openNotification\}/)
})
test('customer commitments explain no-tier closure and enforce payment after delivery',()=>{
 const page=readFileSync('app/account/commitments/page.tsx','utf8')
 assert.match(page,/starting price applies if no discount tier was reached/)
 assert.match(page,/No discount tier unlocked: starting product price applies/)
 assert.match(page,/choose your delivery now/)
 assert.match(page,/Complete final quote ready/)
 assert.match(page,/do not make payment yet/i)
 assert.match(page,/Only independently verified payment creates an order/)
})
