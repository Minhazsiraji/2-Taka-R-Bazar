import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'

async function tsModule(path){
 const src=readFileSync(path,'utf8')
 const out=stripTypeScriptTypes(src,{mode:'strip'})
 return import('data:text/javascript;base64,'+Buffer.from(out).toString('base64'))
}
const {calculateProfit,calculateCashBridge}=await tsModule('lib/finance/profit-trace.ts')
const {demoProfitInput,demoCashBridge,DEMO_PO_FACTS}=await tsModule('lib/finance/demo-profit-scenario.ts')
const c=structuredClone(demoProfitInput)

test('approved PO → 95 verified accepted units → two posted invoice amounts = actual COGS',()=>{
 assert.equal(DEMO_PO_FACTS.ordered,100)
 assert.equal(DEMO_PO_FACTS.accepted,95)
 assert.equal(DEMO_PO_FACTS.firstBilledQty+DEMO_PO_FACTS.secondBilledQty,95)
 assert.equal(DEMO_PO_FACTS.firstBilledAmount+DEMO_PO_FACTS.secondBilledAmount,90250)
 const v=calculateProfit(c)
 assert.equal(v.quantity,95)
 assert.equal(v.productRevenue,90250)
 assert.equal(v.cogs,90250)
 assert.equal(v.customerSaving,4750)
 assert.equal(v.grossProfit,0,'Market savings is not company gross profit')
 assert.equal(v.operatingExpenses,2480,'Marketing 1200 + logistics excluding direct delivery 580 + IT 700')
 assert.equal(v.deliveryRevenue,400)
 assert.equal(v.deliveryCost,300)
 assert.equal(v.financeCosts,600)
 assert.equal(v.profitBeforeTax,-2980,'Expense + direct delivery must not double count')
 assert.equal(v.tax,0,'Loss has no positive assumed income tax')
 assert.equal(v.illustrativeNetProfit,-2980)
 assert.equal(v.certifiedNetProfit,null,'Never present demo net result as certified')
 assert.ok(v.blockers.some(x=>x.includes('Revenue and COGS')))
})

test('scoped pool/product displays product unit margin but never allocates company overhead silently',()=>{
 for(const scope of [{poolId:'syn-pool-amt-01'},{communityId:'syn-amt-01'},{productId:'syn-oil-5l'}]){
  const x=calculateProfit(c,scope)
  assert.equal(x.productRevenue,90250)
  assert.equal(x.cogs,90250)
  assert.equal(x.illustrativeNetProfit,null)
  assert.equal(x.deliveryRevenue,null)
  assert.equal(x.operatingExpenses,null)
  assert.ok(x.blockers.some(y=>y.includes('approved allocations')))
 }
 const empty=calculateProfit(c,{communityId:'syn-dohs'})
 assert.equal(empty.lines.length,0); assert.equal(empty.grossProfit,null)
 assert.ok(empty.blockers.some(x=>x.includes('No fulfilled product')))
})

test('inventory shortfall/refund prevents COGS and hypothetical final figure',()=>{
 const d=structuredClone(c);d.lines[0].acceptedInvoiceQuantity=94
 assert.equal(calculateProfit(d).cogs,null)
 assert.equal(calculateProfit(d).illustrativeNetProfit,null)
 const e=structuredClone(c);e.lines[0].isRefundClear=false
 assert.equal(calculateProfit(e).illustrativeNetProfit,null)
})

test('correct signed loss, no fake profit from loan principal or procurement cash',()=>{
 const v=calculateProfit(c)
 const profitBeforeLoanPrincipal=v.profitBeforeTax
 assert.equal(profitBeforeLoanPrincipal,-2980)
 const altered=structuredClone(c);altered.financeCosts=100
 assert.equal(calculateProfit(altered).profitBeforeTax,-2480)
 assert.throws(()=>calculateProfit({...c,operatingExpenses:[{category:'fake',amount:-10,source:'bad'}]}),/Nonnegative/)
})

test('cash book roll forward closes; transfers ignored, customer COD is not profit',()=>{
 const v=calculateCashBridge(demoCashBridge)
 assert.equal(v.openingCash,255140)
 assert.equal(v.externalInflow,16360)
 assert.equal(v.externalOutflow,78300)
 assert.equal(v.netMovement,-61940)
 assert.equal(v.computedClosing,193200)
 assert.equal(v.closingCash,193200)
 assert.equal(v.difference,0)
 assert.equal(v.reconciles,true)
 assert.equal(v.cashStatus,'RECONCILIATION_REQUIRED','Arithmetic equality does not mean bank certification')
 assert.equal(v.internalTransfers,10000)
 const altered=calculateCashBridge({...demoCashBridge,closingCash:193199})
 assert.equal(altered.difference,-1)
 assert.equal(altered.reconciles,false)
})

test('partial collection and bank unclassified cash are distinct from earned profit',()=>{
 const c2={...demoCashBridge,otherExternalOutflows:450,closingCash:192750}
 const v=calculateCashBridge(c2)
 assert.equal(v.externalOutflow,78750)
 assert.equal(v.difference,0)
 assert.equal(calculateProfit(c).certifiedNetProfit,null)
})

test('no new write endpoints and Super Admin RPCs must be authenticated',()=>{
 const sql=readFileSync('supabase/migrations/20261009218000_finance_profit_and_cash_bridge_read_models.sql','utf8')
 assert.match(sql,/private\.finance_super\(auth\.uid\(\)\)/)
 assert.match(sql,/revoke all on function public\.finance_profit_source/)
 assert.match(sql,/revoke all on function public\.treasury_cash_bridge_source/)
 assert.doesNotMatch(sql,/\binsert into\b/i)
 assert.doesNotMatch(sql,/\bupdate public\./i)
 const profitPage=readFileSync('app/super-admin/profit-breakdown/page.tsx','utf8')
 const cashPage=readFileSync('app/super-admin/cash-bridge/page.tsx','utf8')
 assert.match(profitPage,/requireSuperAdmin/)
 assert.match(cashPage,/requireSuperAdmin/)
 assert.match(profitPage,/certifiedNetProfit/)
 assert.match(cashPage,/Cash Bridge/)
})
