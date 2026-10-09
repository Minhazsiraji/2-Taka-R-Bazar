import Link from 'next/link'
import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import {calculateProfit,type ProfitInput,type ProfitScope,type SaleLine} from '@/lib/finance/profit-trace'
import {demoProfitInput,demoSelection} from '@/lib/finance/demo-profit-scenario'

export const dynamic='force-dynamic'
const money=(v:number|null)=>v===null?'Not verified':(v<0?'−':'')+'৳'+Math.abs(v).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})
const datekey=(v:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v)?v:''
const validId=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)?v:undefined
const classes="finance-panel rounded-[22px] p-5"
function DisplayMetric({name,value,detail}:{name:string;value:string;detail:string}){
 return <div className={classes}><p className="text-[11px] font-extrabold tracking-wider text-slate-600 uppercase">{name}</p><p className="mt-2 text-xl font-black text-slate-900 tabular-nums">{value}</p><p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p></div>
}
function Formula({step,name,source,value,formula}:{step:number;name:string;source:string;value:number|null;formula:string}){
 return <tr className="border-b border-slate-200/70 align-top last:border-0">
  <td className="px-3 py-3 text-xs font-bold text-slate-600">{step.toString().padStart(2,'0')}</td>
  <td className="px-3 py-3"><b className="text-sm text-slate-900">{name}</b><p className="mt-1 text-[11px] text-slate-600">{source}</p></td>
  <td className="px-3 py-3 text-xs text-slate-700">{formula}</td>
  <td className="px-3 py-3 text-right text-sm font-black tabular-nums whitespace-nowrap text-slate-900">{money(value)}</td>
 </tr>
}
export default async function ProfitBreakdown({searchParams}:{searchParams:Promise<{month?:string;community?:string;pool?:string;product?:string;demo?:string}>}){
 const {supabase}=await requireSuperAdmin()
 const q=await searchParams
 const preview=process.env.VERCEL_ENV==='preview'
 const isolated=preview&&process.env.FINANCE_WRITES_ENABLED==='true'&&Boolean(process.env.FINANCE_PREVIEW_SUPABASE_URL)
  &&process.env.NEXT_PUBLIC_SUPABASE_URL===process.env.FINANCE_PREVIEW_SUPABASE_URL
  &&!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('sukabonfjcnaavjgjyuy')
 const demo=q.demo==='1'||(preview&&!isolated&&q.demo!=='0')
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'}).slice(0,7)
 const month=datekey(q.month??'')||(demo?'2026-10':today)
 let source:ProfitInput|null=null
 let fetchError=''
 if(demo){source={...demoProfitInput,month,lines:month==='2026-10'?demoProfitInput.lines:[],operatingExpenses:month==='2026-10'?demoProfitInput.operatingExpenses:[],deliveryRevenue:month==='2026-10'?demoProfitInput.deliveryRevenue:0,deliveryActualCost:month==='2026-10'?demoProfitInput.deliveryActualCost:0,financeCosts:month==='2026-10'?demoProfitInput.financeCosts:0}}
 else {
  const {data,error}=await supabase.rpc('finance_profit_source',{p_month:month+'-01',p_community_id:null,p_product_id:null})
  if(error){fetchError='The approved read-only profit source is not installed or cannot be queried in this environment.'}
  else if(data&&typeof data==='object'){
   const x=data as Partial<ProfitInput>
   source={
    month,lines:(x.lines??[]).map(z=>({...z,benchmarkUnit:Number(z.benchmarkUnit),customerUnit:Number(z.customerUnit),
      acceptedInvoiceQuantity:Number(z.acceptedInvoiceQuantity),verifiedLandedUnit:z.verifiedLandedUnit===null?null:Number(z.verifiedLandedUnit),
      recordedSaleRevenue:(z as SaleLine).recordedSaleRevenue,recordedCustomerSaving:(z as SaleLine).recordedCustomerSaving})),
    operatingExpenses:(x.operatingExpenses??[]).map(z=>({...z,amount:Number(z.amount)})),
    deliveryRevenue:Number(x.deliveryRevenue??0),deliveryActualCost:x.deliveryActualCost===null?null:Number(x.deliveryActualCost??0),
    financeCosts:Number(x.financeCosts??0),taxRate:null,expensesFullyAllocated:false,journalSalesPosted:false,
    bankCollectionsMatched:false,inventoryLedgerMatched:false,taxPolicyVerified:false,isSynthetic:false
   }
  }
 }
 const rows=source?.lines??[]
 const communities=demo?demoSelection.communities:[...new Map(rows.map(x=>[x.communityId,{id:x.communityId,name:x.communityName}])).values()]
 const pools=demo?demoSelection.pools:[...new Map(rows.map(x=>[x.poolId,{id:x.poolId,name:x.poolName,communityId:x.communityId}])).values()]
 const products=demo?demoSelection.products:[...new Map(rows.map(x=>[x.productId,{id:x.productId,name:x.productName}])).values()]
 const valid=(id:string|undefined,ids:string[])=>id&&ids.includes(id)?id:undefined
 const scope:ProfitScope={
  communityId:valid(q.community,communities.map(c=>c.id)),
  poolId:valid(q.pool,pools.map(c=>c.id)),
  productId:valid(q.product,products.map(c=>c.id))
 }
 // When pool belongs to a different community, narrow to zero rather than
 // silently displaying another community as an unscoped company total.
 const result=source?calculateProfit(source,scope):null
 const noScope=!(scope.communityId||scope.poolId||scope.productId)
 const op=result?.operatingExpenses??null
 const delivery=result?.deliveryRevenue??null
 const deliveryCost=result?.deliveryCost??null
 const eb= result?.grossProfit===null||result?.grossProfit===undefined||delivery===null||deliveryCost===null||op===null
  ?null:Math.round((result.grossProfit+delivery-deliveryCost-op)*100)/100
 const samePreview=(path:string)=>path+(demo?'?demo=1':'')
 return <SuperAdminShell><main className="finance-ops-surface grid min-w-0 gap-4">
  <section className="finance-ops-hero rounded-[23px] p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">2-TAKA-R-BAZAR · OWNER FINANCE</p>
     <h1 className="mt-2 text-3xl font-black text-slate-900">Profit calculation breakdown</h1>
     <p className="mt-2 max-w-3xl text-sm text-slate-700">One transparent chain from supplier cost and customer savings through recognized sales, inventory COGS, delivery, operating cost and tax. Cash is reported separately.</p>
    </div>
    <span className="finance-hero-badge rounded-full p-2 text-[11px] font-black">{demo?'READ-ONLY SYNTHETIC EXAMPLE':'NOT CERTIFIED · RECONCILIATION REQUIRED'}</span>
   </div>
   <nav aria-label="Finance reporting navigation" className="finance-hero-actions mt-4 flex flex-wrap gap-2">
    <Link className="rounded-lg px-3 py-2 text-xs font-bold" href={samePreview('/super-admin/finance')}>← Finance Control</Link>
    <Link className="rounded-lg px-3 py-2 text-xs font-bold" href={samePreview('/super-admin/cash-bridge')}>Cash bridge →</Link>
    <Link className="rounded-lg px-3 py-2 text-xs font-bold" href={samePreview('/admin/procurement')}>Supplier procurement →</Link>
   </nav>
  </section>
  <div role="status" className="finance-glass-gate rounded-xl p-4 text-sm font-semibold">
   {demo?'SYNTHETIC — AMT-01: the cost of 95 accepted oil bottles is ৳950 each, and the selling price is also ৳950. The current supplier invoice does NOT support the alternative ৳900 negotiation example. Profit figures below are an illustrative loss, not a certified tax return.':'LIVE READ-ONLY DIAGNOSTIC — no new sales or COGS journals are posted by this page. Missing source evidence keeps final company profit unavailable.'}
  </div>
  <form method="GET" className={classes+" grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
   {demo&&<input type="hidden" name="demo" value="1"/>}
   <label className="grid gap-1 text-xs font-bold text-slate-700">Accounting month<input name="month" type="month" defaultValue={month} required className="rounded-xl border border-slate-200 p-2.5 text-sm"/></label>
   <label className="grid gap-1 text-xs font-bold text-slate-700">Community<select name="community" defaultValue={scope.communityId??''} className="rounded-xl border border-slate-200 p-2.5 text-sm"><option value="">All communities (company)</option>{communities.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label className="grid gap-1 text-xs font-bold text-slate-700">Community pool<select name="pool" defaultValue={scope.poolId??''} className="rounded-xl border border-slate-200 p-2.5 text-sm"><option value="">All pools</option>{pools.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label className="grid gap-1 text-xs font-bold text-slate-700">Product<select name="product" defaultValue={scope.productId??''} className="rounded-xl border border-slate-200 p-2.5 text-sm"><option value="">All products</option>{products.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <button className="rounded-xl bg-teal-700 px-4 py-2.5 font-black text-white lg:col-span-4" type="submit">Apply period / community / pool / product filters</button>
  </form>
  {fetchError&&<div className="finance-gate-notice rounded-xl p-4 text-sm font-bold" role="alert">{fetchError} <Link href="/super-admin/profit-breakdown?month=2026-10&demo=1" className="underline">View synthetic formula demo</Link></div>}
  {result&&<>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <DisplayMetric name="Completed product revenue" value={money(result.productRevenue)} detail={result.quantity+' fulfilled product units · not bank cash'} />
    <DisplayMetric name="Customer savings" value={money(result.customerSaving)} detail="Benchmark × quantity less customer selling price. Customer benefit, not an expense."/>
    <DisplayMetric name="Product COGS" value={money(result.cogs)} detail="Verified accepted goods and independent supplier invoice; not a cash payment."/>
    <DisplayMetric name={demo?'Illustrative result after assumed tax':'Certified Net Profit'} value={demo?money(result.illustrativeNetProfit):'NOT CERTIFIED'} detail={demo?'15% demonstration tax assumption; zero tax on a loss':'Blocked until revenue, stock, refunds, allocation and tax evidence pass.'}/>
   </div>
   <section className={classes}>
    <h2 className="text-lg font-black text-slate-900">Formula-by-formula profit bridge</h2>
    <p className="mt-1 text-xs text-slate-600">All figures BDT; an unavailable amount stays unavailable rather than being silently treated as zero.</p>
    <div className="mt-3 overflow-x-auto">
     <table className="w-full min-w-[660px] text-left"><thead><tr className="bg-slate-100 text-[11px] font-black uppercase text-slate-700"><th className="px-3 py-3">Step</th><th className="px-3 py-3">Accounting line</th><th className="px-3 py-3">Formula / source</th><th className="px-3 py-3 text-right">BDT</th></tr></thead>
      <tbody>
       <Formula step={1} name="Customer benchmark value" value={result.lines.reduce((a,l)=>a+l.benchmarkValue,0)} source="Recorded benchmark at order confirmation" formula="Σ(market benchmark × sold quantity)"/>
       <Formula step={2} name="Product sales revenue" value={result.productRevenue} source="Completed order items · excluding delivery" formula="Σ(customer selling price × completed quantity)"/>
       <Formula step={3} name="Customer savings (separate KPI)" value={result.customerSaving} source="Customer benefit; do NOT deduct again" formula="Benchmark value − product sales revenue"/>
       <Formula step={4} name="COGS — sold stock only" value={result.cogs===null?null:-result.cogs} source="Approved PO → accepted goods → posted supplier invoices" formula="Σ(verified invoiced landed unit cost × sold quantity)"/>
       <Formula step={5} name="Product gross profit" value={result.grossProfit} source="Gross sales profit, not Cash and not Final Net Profit" formula="Product sales revenue − COGS"/>
       <Formula step={6} name="Earned home-delivery revenue" value={delivery} source="Completed fulfilled orders · no pickup fee" formula="Σ(delivery fee billed for completed orders)"/>
       <Formula step={7} name="Actual direct delivery costs" value={deliveryCost===null?null:-deliveryCost} source="Delivery costs, removed from overhead to prevent double counting" formula="− Σ(actual completed delivery costs)"/>
       <Formula step={8} name="Operating overhead and marketing" value={op===null?null:-op} source="Posted accrued expenses; excluded pending approvals" formula="− Marketing − Logistics other than direct delivery − Technology − Staff"/>
       <Formula step={9} name="Operating profit" value={eb} source="Before loan interest and tax" formula="Gross profit + delivery revenue − delivery cost − operating overhead"/>
       <Formula step={10} name="Finance interest and fees" value={result.financeCosts===null?null:-result.financeCosts} source="Loan principal repayment itself is NOT an expense" formula="− Interest and recognized finance fees"/>
       <Formula step={11} name="Profit before tax" value={result.profitBeforeTax} source="Management illustration only until ledger posting and reconciliation" formula="Operating profit − finance costs"/>
       <Formula step={12} name="Illustrative income tax" value={result.tax===null?null:-result.tax} source={demo?'15% ASSUMPTION, not a Bangladesh tax assessment':'No approved tax calculation'} formula="− max(profit before tax, 0) × applicable rate"/>
       <Formula step={13} name="Illustrative after-tax result" value={result.illustrativeNetProfit} source="NOT certified company Net Profit" formula="Profit before tax − illustrative income tax"/>
      </tbody>
     </table>
    </div>
   </section>
   <section className={classes}>
    <h2 className="text-lg font-black text-slate-900">Product and procurement evidence</h2>
    <p className="mt-1 text-xs text-slate-600">Buying a product creates inventory/payables; only the quantity sold moves to COGS.</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs">
     <thead><tr className="bg-slate-100 text-slate-700"><th className="p-3">Community / pool / SKU</th><th>Sold / approved invoice units</th><th>Selling / invoiced cost per unit</th><th className="text-right">Gross margin</th></tr></thead>
     <tbody>{result.lines.map(l=><tr key={l.id} className="border-b border-slate-200/70">
      <td className="p-3"><b>{l.productName}</b><div>{l.communityName} · {l.poolName}</div><div className="text-slate-600">{l.invoiceRef}</div></td>
      <td>{l.quantity} / {l.acceptedInvoiceQuantity}</td><td>{money(l.customerUnit)} / {money(l.verifiedLandedUnit)}</td><td className="text-right font-bold">{money(l.grossProfit)}</td>
     </tr>)}{!result.lines.length&&<tr><td colSpan={4} className="p-4 text-slate-600">No verified completed orders for this selected scope.</td></tr>}</tbody>
    </table></div>
   </section>
   <section className={classes}>
    <h2 className="text-lg font-black">Final profit closing gate</h2>
    <p className="mt-1 text-sm font-bold text-amber-800">{result.certifiedNetProfit===null?'FINAL COMPANY NET PROFIT: BLOCKED — never confuse this demo estimate with certified profit.':'Final net profit certified'}</p>
    <ul className="mt-3 grid gap-2 text-xs text-slate-700">{result.blockers.map((x,i)=><li key={i} className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-3 py-2">• {x}</li>)}</ul>
    {!noScope&&<p className="mt-3 rounded-xl bg-teal-50 p-3 text-xs text-teal-900">Pool/product scope shows unit economics only. Delivery, shared office costs, financing, and tax are not allocated without an approved policy. Switch to All communities / pools / products for whole-company illustration.</p>}
    <div className="mt-4 flex flex-wrap gap-2"><Link href={samePreview('/super-admin/cash-bridge')} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-bold text-white">See why Cash ≠ Profit →</Link><Link href={samePreview('/super-admin/finance')} className="rounded-lg border border-teal-500 px-3 py-2 text-xs font-bold text-teal-900">Back to expense approvals →</Link></div>
   </section>
  </>}
 </main></SuperAdminShell>
}
