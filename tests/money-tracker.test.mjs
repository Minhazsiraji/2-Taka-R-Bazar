import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { monthBounds, shiftMoneyMonth, summarizeMoney } from '../lib/money.mjs'

test('money month helpers cross year boundaries correctly',()=>{
  assert.deepEqual(monthBounds('2026-12'),{start:'2026-12-01',next:'2027-01-01'})
  assert.equal(shiftMoneyMonth('2026-01',-1),'2025-12')
  assert.equal(shiftMoneyMonth('2026-12',1),'2027-01')
})

test('money summary keeps income expense and budget distinct',()=>{
  const summary=summarizeMoney([
    {transaction_type:'income',amount:'10000'},
    {transaction_type:'expense',amount:'1200'},
    {transaction_type:'expense',amount:300},
  ],[{amount:'5000'},{amount:2000}])
  assert.deepEqual(summary,{income:10000,expense:1500,net:8500,budget:7000,budgetLeft:5500})
})

test('money tracker migration is private-by-default and user scoped',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610020003_family_money_tracker.sql',import.meta.url),'utf8')
  for(const table of ['money_categories','money_transactions','money_budgets']) assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`))
  assert.match(sql,/user_id = \(select auth\.uid\(\)\)/)
  assert.match(sql,/foreign key \(category_id, user_id\) references public\.money_categories\(id, user_id\)/)
  assert.match(sql,/revoke all on public\.money_categories, public\.money_transactions, public\.money_budgets from anon/)
  assert.match(sql,/profiles_seed_money_categories/)
})

test('money actions derive ownership from authenticated user',()=>{
  const actions=readFileSync(new URL('../app/actions/money.ts',import.meta.url),'utf8')
  assert.match(actions,/requireOnboardedUser\(\)/)
  assert.match(actions,/user_id:user\.id/)
  assert.match(actions,/\.eq\('user_id',user\.id\)/)
  assert.match(actions,/category\.kind!==values\.transaction_type/)
})

test('My Money is integrated into customer navigation and home',()=>{
  const shell=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8')
  const home=readFileSync(new URL('../app/home/page.tsx',import.meta.url),'utf8')
  const page=readFileSync(new URL('../app/money/page.tsx',import.meta.url),'utf8')
  const entry=readFileSync(new URL('../components/money-entry-form.tsx',import.meta.url),'utf8')
  assert.match(shell,/\['\/money', 'My Money'\]/)
  assert.match(home,/href="\/money"/)
  assert.match(page,/Free everyday tool/)
  assert.match(page,/2-TAKA savings/)
  assert.match(entry,/saveMoneyTransaction/)
  assert.match(entry,/type==='expense'\?expenseCategories:incomeCategories/)
  assert.match(page,/saveMoneyBudget/)
})
