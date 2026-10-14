import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const migration=readFileSync(new URL('../supabase/migrations/202610110002_public_guest_storefront.sql',import.meta.url),'utf8')
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8')
const component=readFileSync(new URL('../components/public-marketplace.tsx',import.meta.url),'utf8')
const auth=readFileSync(new URL('../app/actions/auth.ts',import.meta.url),'utf8')

test('guest catalog uses narrow read-only RPCs with safe active offers',()=>{
 assert.match(migration,/security definer/)
 assert.match(migration,/p\.active and not p\.is_demo/)
 assert.match(migration,/d\.status='open'/)
 assert.match(migration,/now\(\)>=d\.opens_at/)
 assert.match(migration,/private\.group_deal_price/)
 assert.match(migration,/pi\.final_customer_price/)
 assert.match(migration,/grant execute on function public\.get_public_storefront_offers\(uuid\) to anon,authenticated/)
 assert.doesNotMatch(migration,/grant select on public\.group_deals to anon/)
})
test('visitors can browse without login and cannot place anonymous orders',()=>{
 assert.doesNotMatch(page,/redirect\('\/home'\)/)
 assert.match(page,/PublicMarketplace/)
 assert.match(component,/disabled aria-disabled="true"/)
 assert.match(component,/getCurrentPosition/)
 assert.match(component,/chooseAreaByLocation/)
 assert.match(component,/Sign in to join/)
})
test('existing OTP flow remains the only authenticated entry point',()=>{
 assert.match(auth,/requestLoginOtp/)
 assert.match(auth,/verifyPhoneOtp/)
})
