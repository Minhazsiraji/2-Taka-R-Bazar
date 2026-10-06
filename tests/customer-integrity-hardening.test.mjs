import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20261006045000_customer_integrity_hardening.sql','utf8')
const config = fs.readFileSync('next.config.ts','utf8')
const customerActions = fs.readFileSync('app/actions/customer.ts','utf8')
const pickupActions = fs.readFileSync('app/actions/pickup.ts','utf8')

test('customer profile system-owned identity fields cannot be tampered through direct Data API updates',()=>{
  assert.match(migration,/new\.phone is distinct from v_auth_phone/i)
  assert.match(migration,/new\.referral_code is distinct from old\.referral_code/i)
  assert.match(migration,/new\.created_at is distinct from old\.created_at/i)
  assert.match(migration,/Community cannot be changed after onboarding/i)
  assert.match(migration,/Choose an active community/i)
  assert.match(migration,/Map URL must use HTTPS/i)
})

test('customer feedback cannot self-approve or forge moderation audit fields',()=>{
  assert.match(migration,/validate_feedback_customer_write/i)
  assert.match(migration,/new\.review_status <> 'pending'/i)
  assert.match(migration,/new\.review_status is distinct from old\.review_status/i)
  assert.match(migration,/new\.created_at is distinct from old\.created_at/i)
  assert.match(customerActions,/comment\.length > 2000/i)
})

test('issue reporting exposes only safe insert columns and restores admin resolution policy',()=>{
  assert.match(migration,/revoke insert on public\.operational_issues from anon, authenticated/i)
  assert.match(migration,/grant insert \(order_id, reported_by, issue_type, description\) on public\.operational_issues to authenticated/i)
  assert.match(migration,/create policy issues_admin_update/i)
  assert.match(migration,/operational_issues_description_length/i)
  assert.match(customerActions,/description\.length > 2000/i)
  assert.match(pickupActions,/description\.length>2000/i)
})

test('browser hardening restores long HSTS and adds a restrictive CSP baseline',()=>{
  assert.match(config,/max-age=63072000; includeSubDomains; preload/)
  assert.match(config,/Content-Security-Policy/)
  assert.match(config,/default-src 'self'/)
  assert.match(config,/object-src 'none'/)
  assert.match(config,/frame-ancestors 'none'/)
  assert.match(config,/script-src-attr 'none'/)
})
