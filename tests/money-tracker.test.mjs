import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accountBalances, categoryTotals, monthBounds, monthlySeries, shiftMoneyMonth, summarizeBudget, summarizeMoney } from '../lib/money.mjs'

test('money month helpers cross year boundaries correctly',()=>{
  assert.deepEqual(monthBounds('2026-12'),{start:'2026-12-01',next:'2027-01-01'})
  assert.equal(shiftMoneyMonth('2026-01',-1),'2025-12')
  assert.equal(shiftMoneyMonth('2026-12',1),'2027-01')
})

test('money summary keeps income expense and category budgets distinct',()=>{
  const transactions=[{transaction_type:'income',amount:'10000',category_id:'income'},{transaction_type:'expense',amount:'1200',category_id:'groceries'},{transaction_type:'expense',amount:300,category_id:'transport'}]
  const budgets=[{amount:'5000',category_id:'groceries'},{amount:2000,category_id:'rent'}]
  assert.deepEqual(summarizeMoney(transactions,budgets),{income:10000,expense:1500,net:8500,budget:7000})
  assert.deepEqual(summarizeBudget(transactions,budgets),{budget:7000,budgetSpent:1200,budgetLeft:5800})
})

test('account balances include income expense and transfers without double counting',()=>{
  const accounts=[{id:'cash',opening_balance:1000},{id:'bank',opening_balance:5000}]
  const tx=[{account_id:'cash',transaction_type:'expense',amount:200},{account_id:'bank',transaction_type:'income',amount:1000}]
  const transfers=[{from_account_id:'bank',to_account_id:'cash',amount:500}]
  const rows=accountBalances(accounts,tx,transfers)
  assert.equal(rows.find(r=>r.id==='cash').balance,1300)
  assert.equal(rows.find(r=>r.id==='bank').balance,5500)
})

test('report helpers group categories and build monthly trend',()=>{
  const tx=[{transaction_type:'expense',amount:100,category_id:'g',transaction_date:'2026-09-02'},{transaction_type:'expense',amount:250,category_id:'g',transaction_date:'2026-10-01'},{transaction_type:'income',amount:1000,category_id:'salary',transaction_date:'2026-10-01'}]
  assert.equal(categoryTotals(tx).get('g'),350)
  const trend=monthlySeries(tx,'2026-10',2)
  assert.deepEqual(trend.map(r=>r.month),['2026-09','2026-10'])
  assert.equal(trend[1].income,1000);assert.equal(trend[1].expense,250)
})

test('base money tracker migration is private-by-default and user scoped',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610020003_family_money_tracker.sql',import.meta.url),'utf8')
  for(const table of ['money_categories','money_transactions','money_budgets']) assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`))
  assert.match(sql,/foreign key \(category_id, user_id\) references public\.money_categories\(id, user_id\)/)
  assert.match(sql,/profiles_seed_money_categories/)
})

test('full money suite adds private accounts people transfers recurring and goals',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610020004_family_money_full_suite.sql',import.meta.url),'utf8')
  for(const table of ['money_accounts','money_people','money_transfers','money_recurring','money_goals']){
    assert.match(sql,new RegExp(`create table public\\.${table}`));assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`))
  }
  assert.match(sql,/foreign key \(account_id,user_id\) references public\.money_accounts\(id,user_id\)/)
  assert.match(sql,/foreign key \(person_id,user_id\) references public\.money_people\(id,user_id\)/)
  assert.match(sql,/p_user_id,'Cash','cash'/);assert.match(sql,/p_user_id,'Me',true/);assert.match(sql,/p_user_id,'Shared',true/)
  assert.match(sql,/p_user_id,'Gifts','expense'/);assert.match(sql,/p_user_id,'Insurance','expense'/);assert.match(sql,/p_user_id,'Subscriptions','expense'/)
})

test('money actions derive ownership from authenticated user',()=>{
  const actions=readFileSync(new URL('../app/actions/money.ts',import.meta.url),'utf8')
  assert.match(actions,/requireOnboardedUser\(\)/);assert.match(actions,/user_id:user\.id/);assert.match(actions,/\.eq\('user_id',user\.id\)/)
  assert.match(actions,/saveMoneyAccount/);assert.match(actions,/saveMoneyTransfer/);assert.match(actions,/saveMoneyRecurring/);assert.match(actions,/saveMoneyGoal/)
})

test('My Money is a single header action and Home stays focused on BazarPool',()=>{
  const shell=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8')
  const home=readFileSync(new URL('../app/home/page.tsx',import.meta.url),'utf8')
  assert.match(shell,/href="\/money"/);assert.match(shell,/Open My Money dashboard/);assert.match(shell,/💰/)
  assert.doesNotMatch(home,/MoneyEntryForm/);assert.doesNotMatch(home,/My Money · FREE/);assert.doesNotMatch(home,/Track today&apos;s cost in seconds/)
})

test('My Money exposes the complete requested module navigation',()=>{
  const nav=readFileSync(new URL('../components/money-nav.tsx',import.meta.url),'utf8')
  for(const label of ['Dashboard','Transactions','Accounts','Transfers','Budgets','Categories','Recurring','Reports']) assert.match(nav,new RegExp(label))
  for(const path of ['transactions','accounts','transfers','budgets','categories','recurring','reports']) assert.doesNotThrow(()=>readFileSync(new URL(`../app/money/${path}/page.tsx`,import.meta.url),'utf8'))
})


test('My Money summary sharing defaults on and supports customer opt-out',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610020007_money_summary_sharing.sql',import.meta.url),'utf8')
  const actions=readFileSync(new URL('../app/actions/money.ts',import.meta.url),'utf8')
  const page=readFileSync(new URL('../app/money/page.tsx',import.meta.url),'utf8')
  assert.match(sql,/money_summary_sharing boolean not null default true/)
  assert.match(sql,/set_my_money_summary_sharing/)
  assert.match(sql,/coalesce\(p\.money_summary_sharing,true\)=true/)
  assert.match(actions,/setMoneySummarySharing/)
  assert.match(page,/Monthly summary sharing is/)
})

test('Super Admin family financials are read-only summary data with top five categories',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610020006_super_admin_money_family_financials.sql',import.meta.url),'utf8')
  const page=readFileSync(new URL('../app/super-admin/money-analytics/page.tsx',import.meta.url),'utf8')
  assert.match(sql,/super_admin_money_family_financials/)
  assert.match(sql,/ct\.rn<=5/)
  assert.match(page,/Private family financials/)
  assert.match(page,/Net savings/)
  assert.match(page,/Top \{i\}/)
})
