import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('future Data API objects are fail-closed and sensitive internal tables have explicit deny policies', () => {
  const sql = fs.readFileSync('supabase/migrations/20261006042223_future_api_default_hardening.sql', 'utf8')
  assert.match(sql, /revoke all on table public\.notification_dispatch_config from anon, authenticated/i)
  assert.match(sql, /revoke all on table public\.push_subscriptions from anon, authenticated/i)
  assert.match(sql, /notification_dispatch_config_client_deny[\s\S]*using \(false\)[\s\S]*with check \(false\)/i)
  assert.match(sql, /push_subscriptions_client_deny[\s\S]*using \(false\)[\s\S]*with check \(false\)/i)
  assert.match(sql, /revoke select, insert, update, delete on tables from anon, authenticated, service_role/i)
  assert.match(sql, /revoke usage, select on sequences from anon, authenticated, service_role/i)
  assert.match(sql, /revoke execute on functions from anon, authenticated, service_role, public/i)
})
