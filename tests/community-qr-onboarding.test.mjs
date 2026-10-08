import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('community QR migration separates scans, joins and completed buyers',()=>{
  const sql=read('supabase/migrations/20261008170000_community_qr_onboarding.sql')
  assert.match(sql,/create table if not exists public\.community_qr_codes/)
  assert.match(sql,/create table if not exists public\.community_qr_scans/)
  assert.match(sql,/create table if not exists public\.community_qr_conversions/)
  assert.match(sql,/register_community_qr_scan/)
  assert.match(sql,/complete_community_qr_conversion/)
  assert.match(sql,/get_admin_community_qr_stats/)
  assert.match(sql,/exists \(\s*select 1 from public\.orders/i)
  assert.match(sql,/o\.status='completed'/)
  assert.match(sql,/'AMT-01'/)
  assert.match(sql,/'amin-model-town'/)
  assert.match(sql,/grant execute on function public\.register_community_qr_scan\(text,text\) to anon, authenticated/)
  assert.doesNotMatch(sql,/grant .* on public\.community_qr_scans to anon/i)
})

test('scan route records attribution but does not create membership or order',()=>{
  const route=read('app/join/route.ts')
  assert.match(route,/register_community_qr_scan/)
  assert.match(route,/COMMUNITY_QR_CODE_COOKIE/)
  assert.match(route,/COMMUNITY_QR_SCAN_COOKIE/)
  assert.match(route,/community-invite/)
  assert.match(route,/existingCode===code&&existingToken/)
  assert.doesNotMatch(route,/profiles.*update/i)
  assert.doesNotMatch(route,/orders.*insert/i)
  assert.doesNotMatch(route,/commitments.*insert/i)
})

test('community invite requires mobile auth before onboarding or confirmation',()=>{
  const page=read('app/community-invite/[code]/page.tsx')
  assert.match(page,/Register with mobile/)
  assert.match(page,/I already have an account/)
  assert.match(page,/Complete profile & join/)
  assert.match(page,/Confirm & open/)
  assert.match(page,/cannot silently move your household/i)
  assert.match(page,/Active Pools/)
  assert.match(page,/Neighbour Deals/)
})

test('OTP flow preserves QR intent through signup and login',()=>{
  const auth=read('app/actions/auth.ts')
  assert.match(auth,/COMMUNITY_QR_CODE_COOKIE/)
  assert.match(auth,/if\(qrCode\) redirect\('\/community-invite\/'/)
  assert.match(auth,/forcedCommunityId/)
  assert.match(auth,/complete_community_qr_conversion/)
  assert.match(auth,/COMMUNITY_QR_SCAN_COOKIE/)
})

test('onboarding locks the scanned community and prevents client tampering',()=>{
  const page=read('app/onboarding/page.tsx')
  const auth=read('app/actions/auth.ts')
  assert.match(page,/Scanned community/)
  assert.match(page,/type="hidden" name="community_id"/)
  assert.match(auth,/community_id:forcedCommunityId\|\|getText\(formData,'community_id'\)/)
})

test('QR campaign admin report distinguishes scans, joined users and completed buyers',()=>{
  const page=read('app/admin/page.tsx')
  assert.match(page,/Community QR acquisition/)
  assert.match(page,/scan is tracked separately/i)
  assert.match(page,/Scans/)
  assert.match(page,/Joined/)
  assert.match(page,/Completed buyers/)
  assert.match(page,/get_admin_community_qr_stats/)
})

test('QR campaign pages are excluded from search indexing',()=>{
  const proxy=read('proxy.ts')
  assert.match(proxy,/'\/join'/)
  assert.match(proxy,/'\/community-invite'/)
})
