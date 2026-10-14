import test from 'node:test'
import assert from 'node:assert/strict'
import {safeNotificationHref} from '../lib/notification-links.mjs'

test('notification clicks retain internal customer destinations and action anchors',()=>{
 for(const href of ['/notifications','/account/orders/123','/pool#pool-123','/#deals','/group-deals?area=123'])assert.equal(safeNotificationHref(href),href)
})
test('notification clicks cannot escape the site or enter auth/provider flows',()=>{
 for(const href of ['https://evil.example','//evil.example','/\\evil.example','/login?next=//evil.example','/auth/callback?code=bad','/notifications\n','javascript:alert(1)',null,'/'+ 'x'.repeat(501)])assert.equal(safeNotificationHref(href),'/notifications')
})
