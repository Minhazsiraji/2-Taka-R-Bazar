import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const finance=readFileSync('app/super-admin/finance/page.tsx','utf8')
const treasury=readFileSync('app/super-admin/treasury/page.tsx','utf8')
const procurement=readFileSync('app/admin/procurement/page.tsx','utf8')

test('all three dashboards support safe, clearly labeled, read-only preview demo mode',()=>{
 for(const [name,content] of [['Finance',finance],['Treasury',treasury],['Procurement',procurement]]){
  assert.match(content,/VERCEL_ENV==='preview'/,`${name} must detect Preview environment`)
  assert.match(content,/demo=1/,`${name} needs accessible example-data link`)
  assert.match(content,/SYNTHETIC/,`${name} must visibly distinguish examples from real records`)
 }
 assert.match(finance,/No customer, supplier, expense, revenue or profit data is being read or changed/)
 assert.match(treasury,/!demo&&<form action={treasuryReviewTransaction}/)
 assert.match(procurement,/disabled={!isolated\|\|demoMode}/)
})

test('Treasury demo cash, operating reserve, supplier payable and deployable liquidity reconcile',()=>{
 const vals=Object.fromEntries(
  ['cash_total','unrestricted_cash','minimum_reserve','contractual_outflows_14d','deployable_cash',
   'loan_and_private_borrowing_outstanding','card_outstanding','unmatched_statement_lines',
   'pending_treasury_requests'].map(key=>{
    const regex=new RegExp('\\b'+key+':(\\d+)')
    const found=treasury.match(regex)
    assert.ok(found,'Missing numeric demo field '+key)
    return [key,Number(found[1])]
   })
 )
 assert.equal(vals.cash_total,193200)
 assert.equal(vals.unrestricted_cash,vals.cash_total)
 assert.equal(vals.deployable_cash,vals.unrestricted_cash-vals.minimum_reserve-vals.contractual_outflows_14d)
 assert.equal(vals.unmatched_statement_lines,2)
 assert.equal(vals.pending_treasury_requests,2)
 assert.equal(vals.loan_and_private_borrowing_outstanding+vals.card_outstanding,59000)
 const acct=treasury.slice(treasury.indexOf(' accounts:['),treasury.indexOf(' facilities:['))
 const balances=[...acct.matchAll(/balance:(\d+),restricted:/g)].map(x=>Number(x[1]))
 assert.equal(balances.length,6)
 assert.equal(balances.slice(0,5).reduce((a,b)=>a+b,0),vals.cash_total)
})

test('supplier goods accepted, matched invoices and pending treasury payment are consistent',()=>{
 assert.match(procurement,/quantity:100,unit_cost:950,value:95000,received_quantity:95/)
 assert.match(procurement,/quantity:70,amount:66500,status:'settled'/)
 assert.match(procurement,/quantity:25,amount:23750,status:'posted'/)
 assert.match(treasury,/id:'demo-4',kind:'supplier_payment',amount:66500/)
 assert.match(treasury,/id:'demo-6',kind:'supplier_payment',amount:23750/)
 assert.match(treasury,/id:'demo-f1',due_date:'2026-10-16',expected_cash_change:-23750/)
 const sum=70*950+25*950
 assert.equal(sum,95*950)
})
