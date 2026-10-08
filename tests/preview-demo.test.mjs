import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('Preview review mode bypasses SMS only on Vercel Preview',()=>{
  const route=read('app/preview-demo/route.ts')
  const login=read('app/login/page.tsx')

  assert.match(route,/process\.env\.VERCEL_ENV !== 'preview'/)
  assert.match(route,/signInAnonymously\(\)/)
  assert.match(route,/e2e-uat-community/)
  assert.match(route,/Preview Demo Customer/)
  assert.match(route,/onboarding_completed_at/)
  assert.match(route,/NextResponse\.redirect\(new URL\('\/home'/)
  assert.match(login,/process\.env\.VERCEL_ENV === 'preview'/)
  assert.match(login,/Open Preview without OTP/)
  assert.match(login,/No SMS or OTP credit is used/)
})
