import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('security hardening revokes anonymous SECURITY DEFINER execution', () => {
  const sql = fs.readFileSync('supabase/migrations/202610020010_security_gate_hardening.sql', 'utf8')
  const expected = [
    'admin_broadcast_notification',
    'get_pool_participation',
    'get_push_public_key',
    'has_push_subscription',
    'mark_all_notifications_read',
    'mark_notification_read',
    'remove_push_subscription',
    'save_push_subscription',
  ]
  for (const fn of expected) assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}`))
  assert.doesNotMatch(sql, /money_summary_sharing\s+boolean\s+not\s+null\s+default\s+false/i)
})

test('OTP verification does not expose raw upstream error text', () => {
  const auth = fs.readFileSync('app/actions/auth.ts', 'utf8')
  assert.doesNotMatch(auth, /verify-otp\?error=\$\{encodeURIComponent\(error\.message\)\}/)
  assert.match(auth, /OTP\+is\+invalid\+or\+expired/)
})
