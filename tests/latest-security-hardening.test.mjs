import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('private SECURITY DEFINER execution is explicit and default function exposure is disabled', () => {
  const sql = fs.readFileSync('supabase/migrations/20261006041049_latest_external_hardening.sql', 'utf8')
  assert.match(sql, /revoke execute on all functions in schema private from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function private\.has_role\(uuid,text\) to authenticated/i)
  assert.match(sql, /alter default privileges for role postgres in schema public[\s\S]*revoke execute on functions from public/i)
  assert.match(sql, /admin_finalize_pool_item\(uuid,uuid,numeric,text\).*authenticated/i)
})

test('push dispatcher rejects obvious unauthenticated scans before privileged database access', () => {
  const source = fs.readFileSync('supabase/functions/notification-push-dispatch/index.ts', 'utf8')
  const guard = source.indexOf('presentedSecret.length < 32')
  const privilegedClient = source.indexOf('createClient(url, serviceKey')
  assert.ok(guard >= 0)
  assert.ok(privilegedClient > guard)
  assert.match(source, /constantTimeEqual\(presentedSecret, config\.dispatch_secret\)/)
})

test('baseline web and CI external-threat controls stay enabled', () => {
  const config = fs.readFileSync('next.config.ts', 'utf8')
  const ci = fs.readFileSync('.github/workflows/step1-ci.yml', 'utf8')
  assert.match(config, /Strict-Transport-Security/)
  assert.match(config, /Cross-Origin-Opener-Policy/)
  assert.match(ci, /npm audit --omit=dev --audit-level=high/)
})
