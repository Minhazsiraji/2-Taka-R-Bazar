import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('Preview review mode is synthetic, no-SMS, and hard-gated to Vercel Preview',()=>{
  const page=read('app/preview-demo/page.tsx')
  const login=read('app/login/page.tsx')

  assert.match(page,/process\.env\.VERCEL_ENV!=='preview'/)
  assert.match(page,/Preview-only synthetic UAT/)
  assert.match(page,/no SMS\/OTP used/)
  assert.match(page,/no Production customer data shown/)
  assert.doesNotMatch(page,/signInAnonymously/)
  assert.doesNotMatch(page,/requestLoginOtp/)
  assert.match(login,/process\.env\.VERCEL_ENV === 'preview'/)
  assert.match(login,/Open Preview without OTP/)
  assert.match(login,/No SMS or OTP credit is used/)
})
