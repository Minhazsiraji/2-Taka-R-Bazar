import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const {financeUatLoginEnabled}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('lib/finance/uat-access.ts','utf8'),{mode:'strip'})).toString('base64'))
const keys=['VERCEL_ENV','FINANCE_UAT_LOGIN_ENABLED','FINANCE_WRITES_ENABLED','NEXT_PUBLIC_SUPABASE_URL','FINANCE_PREVIEW_SUPABASE_URL','FINANCE_SHARED_DB_UAT_ENABLED']
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
function scenario(overrides){
 const base={VERCEL_ENV:'preview',FINANCE_UAT_LOGIN_ENABLED:'true',FINANCE_WRITES_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',FINANCE_PREVIEW_SUPABASE_URL:'http://127.0.0.1:54321',FINANCE_SHARED_DB_UAT_ENABLED:'false'}
 for(const k of keys)process.env[k]=({...base,...overrides})[k]
 return financeUatLoginEnabled()
}
test('reviewer sign-in remains closed in Production and mismatched databases',()=>{
 try{
  assert.equal(scenario({}),true)
  for(const overrides of [{VERCEL_ENV:'production'},{FINANCE_UAT_LOGIN_ENABLED:'false'},{FINANCE_WRITES_ENABLED:'false'},{FINANCE_PREVIEW_SUPABASE_URL:'https://different.supabase.co'},{NEXT_PUBLIC_SUPABASE_URL:''}])assert.equal(scenario(overrides),false)
 }finally{for(const k of keys)saved[k]===undefined?delete process.env[k]:process.env[k]=saved[k]}
})
test('shared database reviewer sign-in requires explicit scoped opt-in',()=>{
 try{
  const url='https://sukabonfjcnaavjgjyuy.supabase.co'
  assert.equal(scenario({NEXT_PUBLIC_SUPABASE_URL:url,FINANCE_PREVIEW_SUPABASE_URL:url}),false)
  assert.equal(scenario({NEXT_PUBLIC_SUPABASE_URL:url,FINANCE_PREVIEW_SUPABASE_URL:url,FINANCE_SHARED_DB_UAT_ENABLED:'true'}),true)
 }finally{for(const k of keys)saved[k]===undefined?delete process.env[k]:process.env[k]=saved[k]}
})
