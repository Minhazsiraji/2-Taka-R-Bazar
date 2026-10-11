import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration=readFileSync(new URL('../supabase/migrations/20261009183000_finance_preview_foundation.sql',import.meta.url),'utf8')
const actions=readFileSync(new URL('../app/actions/finance.ts',import.meta.url),'utf8')
const page=readFileSync(new URL('../app/super-admin/finance/page.tsx',import.meta.url),'utf8')

test('finance data is private and only authorized RPCs can mutate',()=>{
 for(const table of ['finance_accounts','finance_periods','finance_expenses','finance_journals','finance_journal_lines','finance_settlement_requests']){
  assert.match(migration,new RegExp('alter table public\\.'+table+' enable row level security','i'))
 }
 assert.match(migration,/revoke all on public\.finance_accounts,public\.finance_periods/)
 assert.match(migration,/private\.finance_authorized\(v_actor\)/)
 assert.match(migration,/private\.finance_super\(auth\.uid\(\)\)/)
 assert.doesNotMatch(migration,/grant (insert|update|delete) on public\.finance_/i)
})

test('preview mutating server actions fail closed on production or unapproved database',()=>{
 assert.match(actions,/process\.env\.VERCEL_ENV !== 'preview'/)
 assert.match(actions,/process\.env\.FINANCE_WRITES_ENABLED !== 'true'/)
 assert.match(actions,/endpoint !== approved/)
 assert.match(actions,/sukabonfjcnaavjgjyuy/)
 for(const action of ['createFinanceExpense','reviewFinanceExpense','requestFinanceSettlement','reviewFinanceSettlement']){
  const section=actions.slice(actions.indexOf('export async function '+action))
  assert.match(section,/assertIsolatedFinancePreview\(\)/)
 }
})

test('expense creation and approval enforce maker checker, evidence metadata and ledger posting',()=>{
 assert.match(migration,/finance_expenses_vendor_document_unique/)
 assert.match(migration,/document_reference text not null check/)
 assert.match(migration,/finance-evidence/)
 assert.match(migration,/evidence_sha256 text not null check/)
 assert.match(migration,/storage\.objects where bucket_id='finance-evidence'/)
 assert.match(migration,/if e\.created_by=v_actor then raise exception 'Maker may not approve their own expense'/)
 assert.match(migration,/if e\.status<>'submitted' then raise exception/)
 assert.match(migration,/finance:accrual:/)
 assert.match(migration,/expense_accrual/)
 assert.match(migration,/when 'marketing_offline' then '6200'/)
 assert.match(migration,/when 'marketing_online' then '6210'/)
})

test('balanced journal primitives are idempotent and enforce exact debit and credit',()=>{
 assert.match(migration,/event_key text not null unique/)
 assert.match(migration,/p_debit=p_credit/)
 assert.match(migration,/p_amount is null or p_amount<=0/)
 assert.match(migration,/values\(v_id,p_debit,p_amount,0,p_community\),\(v_id,p_credit,0,p_amount,p_community\)/)
 assert.match(migration,/check\(debit>=0\)/)
 assert.match(migration,/check\(credit>=0\)/)
})

test('settlement verification requires independent reviewer and proof before crediting cash',()=>{
 assert.match(migration,/if s\.requested_by=v_actor then raise exception/)
 assert.match(migration,/payment_reference text not null check/)
 assert.match(migration,/finance_settlement_one_live/)
 assert.match(migration,/finance_settlement_reference_live/)
 assert.match(migration,/payment_method,payment_reference/)
 assert.match(migration,/if e\.status<>'settlement_requested' then/)
 assert.match(migration,/finance:settlement:/)
 assert.match(migration,/finance_payment_verified/)
})

test('accounting periods reject writes after close',()=>{
 assert.match(migration,/finance_require_open\(p_date\)/)
 assert.match(migration,/state='locked'/)
 assert.match(migration,/perform private\.finance_require_open\(p_incurred_on\)/)
 assert.match(migration,/perform private\.finance_require_open\(p_payment_date\)/)
})

test('expense dashboard never misrepresents GMV or estimated contributions as net profit',()=>{
 assert.match(migration,/UNAVAILABLE_UNTIL_REVENUE_COGS_RECONCILED/)
 assert.match(page,/Final net profit/)
 assert.match(page,/Not certified yet/)
 assert.match(page,/SYNTHETIC DEMO/)
 assert.match(page,/No customer, supplier, expense, revenue or profit data is being read or changed/)
 assert.doesNotMatch(page,/GMV.*net profit|projectedPoolContribution/)
})
