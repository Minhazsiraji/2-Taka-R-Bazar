import Link from 'next/link'
import {requireSuperAdmin} from '@/lib/auth'
import {SuperAdminShell} from '@/components/super-admin-shell'
import {calculateCashBridge,type CashBridgeInput} from '@/lib/finance/profit-trace'
import {demoCashBridge} from '@/lib/finance/demo-profit-scenario'

export const dynamic='force-dynamic'
const bdt=(n:number)=>'৳'+n.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})
const monthKey=(v:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v)?v:''
const card='finance-panel rounded-[22px] p-5'
type Source=CashBridgeInput&{grossBankDebits?:number;grossBankCredits?:number;unmatchedStatements?:number;unclassifiedOutflow?:number}
function Detail({name,amount,note}:{name:string;amount:number;note:string}){
 return <div className="flex items-start justify-between gap-3 border-b border-slate-300/50 py-3 last:border-0">
  <div><p className="font-bold text-slate-900">{name}</p><p className="mt-1 text-xs text-slate-600">{note}</p></div><b className="whitespace-nowrap tabular-nums text-slate-900">{bdt(amount)}</b>
 </div>
}
export default async function CashBridgePage({searchParams}:{searchParams:Promise<{demo?:string;month?:string}>}){
 const {supabase}=await requireSuperAdmin()
 const q=await searchParams
 const isolated=process.env.VERCEL_ENV==='preview'&&process.env.FINANCE_WRITES_ENABLED==='true'&&
  Boolean(process.env.FINANCE_PREVIEW_SUPABASE_URL)&&process.env.NEXT_PUBLIC_SUPABASE_URL===process.env.FINANCE_PREVIEW_SUPABASE_URL&&
  !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('sukabonfjcnaavjgjyuy')
 const demo=q.demo==='1'||(process.env.VERCEL_ENV==='preview'&&!isolated&&q.demo!=='0')
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'}).slice(0,7)
 const month=monthKey(q.month??'')||(demo?'2026-10':today)
 let raw:Source|null=null,dbError=''
 if(demo){
  raw=month==='2026-10'?{...demoCashBridge,unmatchedStatements:2,unclassifiedOutflow:0,
   grossBankDebits:26360,grossBankCredits:88300}:{...demoCashBridge,openingCash:0,closingCash:0,customerCod:0,deliveryCollections:0,
   supplierPayments:0,operatingCashPayments:0,loanPrincipalPaid:0,financeCashPaid:0,ownerFinancingInflows:0,otherExternalReceipts:0,internalTransfers:0,
   cashAccountsReconciled:false,unmatchedStatements:0,unclassifiedOutflow:0,grossBankDebits:0,grossBankCredits:0}
 }else{
  const {data,error}=await supabase.rpc('treasury_cash_bridge_source',{p_month:month+'-01'})
  if(error)dbError='The read-only Cash Bridge source is unavailable in this environment.'
  else if(data&&typeof data==='object'){
   const x=data as Record<string,unknown>
   raw={
    openingCash:Number(x.openingCash??0),closingCash:Number(x.closingCash??0),
    customerCod:Number(x.customerCod??0),deliveryCollections:Number(x.deliveryCollections??0),
    supplierPayments:Number(x.supplierPayments??0),operatingCashPayments:Number(x.operatingCashPayments??0),
    loanPrincipalPaid:Number(x.loanPrincipalPaid??0),financeCashPaid:Number(x.financeCashPaid??0),
    ownerFinancingInflows:Number(x.ownerFinancingInflows??0),otherExternalReceipts:Number(x.otherExternalReceipts??0),
    internalTransfers:Number(x.internalTransfers??0),cashAccountsReconciled:false,
    grossBankDebits:Number(x.grossBankDebits??0),grossBankCredits:Number(x.grossBankCredits??0),
    unclassifiedOutflow:Number(x.unclassifiedOutflow??0),unmatchedStatements:Number(x.unmatchedStatements??0)
   }
  }
 }
 const v=raw?calculateCashBridge(raw):null
 const link=(p:string)=>p+(demo?'?demo=1':'')
 return <SuperAdminShell><main className="finance-ops-surface grid min-w-0 gap-4">
  <section className="finance-ops-hero rounded-[24px] p-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <p className="text-xs font-extrabold uppercase tracking-[.2em] text-teal-700">2-TAKA-R-BAZAR · TREASURY</p>
    <h1 className="mt-2 text-3xl font-black text-slate-900">Cash Bridge — Profit is not Cash</h1>
    <p className="mt-2 max-w-3xl text-sm text-slate-700">Opening physical book cash + verified cash-in − actual cash-out = closing physical book cash. Internal transfers, loans, outstanding supplier liabilities and customer suspense are kept separate from profit.</p>
   </div><span className="finance-hero-badge rounded-full p-2 text-[11px] font-black">{demo?'READ-ONLY SYNTHETIC':'BOOK CASH · NOT BANK CERTIFIED'}</span></div>
   <nav aria-label="Treasury reporting navigation" className="finance-hero-actions mt-4 flex flex-wrap gap-2">
    <Link className="rounded-lg px-3 py-2 text-xs font-bold" href={link('/super-admin/treasury')}>← Treasury dashboard</Link>
    <Link className="rounded-lg px-3 py-2 text-xs font-bold" href={link('/super-admin/profit-breakdown')}>Profit breakdown →</Link>
   </nav>
  </section>
  <div className="finance-glass-gate rounded-xl p-4 text-sm font-bold" role="status">
   {demo?'Synthetic October 2026 company example. Illustrative money movements only; no real bank files, customers or supplier data are changed.':'This bridge is computed from treasury physical-account journal entries. It is NOT final bank certification or proof of recognized customer revenue.'}
  </div>
  <form method="GET" className={card+" flex flex-wrap items-end gap-3"}>
   {demo&&<input type="hidden" name="demo" value="1"/>}
   <label className="grid gap-1 text-xs font-bold text-slate-700">Accounting month<input name="month" type="month" defaultValue={month} className="rounded-xl border border-slate-200 p-2 text-sm" required/></label>
   <button type="submit" className="rounded-xl bg-teal-700 px-5 py-2.5 font-black text-white">Show monthly cash bridge</button>
  </form>
  {dbError&&<div className="finance-gate-notice rounded-xl p-4 text-sm font-bold" role="alert">{dbError} <Link href="/super-admin/cash-bridge?demo=1" className="underline">Open synthetic demo</Link></div>}
  {v&&<>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {[
     ['Opening book cash',v.openingCash,'Cash, banks and mobile wallets only; not credit card limit'],
     ['External cash inflows',v.externalInflow,'Customer COD, delivery fees, financing and other verified receipts'],
     ['External cash outflows',v.externalOutflow,'Suppliers, payroll/operations, loan principal, interest and fees'],
     ['Closing book cash',v.closingCash,'Opening cash + net physical cash movement']
    ].map(([title,value,desc])=><div className={card} key={String(title)}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">{String(title)}</p>
      <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">{bdt(Number(value))}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{String(desc)}</p>
    </div>)}
   </div>
   <section className={card}>
    <h2 className="text-lg font-black">Cash roll-forward, source by source</h2>
    <p className="mt-1 text-xs text-slate-600">Different from P&amp;L: supplier payments are Inventory/AP settlement, loan principal is debt settlement and COD may be a liability.</p>
    <div className="mt-3 grid gap-4 md:grid-cols-2">
     <div>
      <h3 className="text-sm font-black text-teal-800">Cash coming in</h3>
      <Detail name="Customer product COD" amount={v.customerCod} note="Physical cash received. Remains COD suspense until sales are independently recognized."/>
      <Detail name="Home delivery collections" amount={v.deliveryCollections} note="Separate delivery-fee suspense; not product savings."/>
      <Detail name="Owner capital or bank loan draws" amount={v.ownerFinancingInflows} note="Financing, not sales revenue or operating profit."/>
      <Detail name="Other external cash receipts" amount={v.otherExternalReceipts} note="Must be classified before management can rely on it."/>
     </div>
     <div>
      <h3 className="text-sm font-black text-indigo-800">Cash going out</h3>
      <Detail name="Supplier invoices settled" amount={v.supplierPayments} note="Reduces Bank and Accounts Payable; do not expense again."/>
      <Detail name="Operating cash disbursements" amount={v.operatingCashPayments} note="Cash paid for already recognized expenses; not a second cost."/>
      <Detail name="Loan principal repaid" amount={v.loanPrincipalPaid} note="Reduces debt; excludes Profit & Loss expense."/>
      <Detail name="Finance interest and fees paid" amount={v.financeCashPaid} note="Financing outflow; recognize financial cost once by approved policy."/>
     </div>
    </div>
    <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-4">
     <div className="flex flex-wrap items-center justify-between gap-2"><b>Net external cash movement</b><strong className="text-lg tabular-nums">{v.netMovement<0?'−':''}{bdt(Math.abs(v.netMovement))}</strong></div>
     <div className="mt-2 text-xs text-slate-700">Own-account transfers: {bdt(v.internalTransfers)} in each direction. Excluded from both external inflows and outflows; net impact ৳0.</div>
    </div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
      <tbody>
       <tr><td className="p-3">Opening cash balance</td><td className="p-3 text-right font-bold">{bdt(v.openingCash)}</td></tr>
       <tr><td className="p-3">+ External cash in</td><td className="p-3 text-right font-bold">{bdt(v.externalInflow)}</td></tr>
       <tr><td className="p-3">− External cash out</td><td className="p-3 text-right font-bold">−{bdt(v.externalOutflow)}</td></tr>
       <tr className="border-t border-slate-300 font-black"><td className="p-3">Calculated closing cash</td><td className="p-3 text-right">{bdt(v.computedClosing)}</td></tr>
       <tr><td className="p-3">Reported book closing cash</td><td className="p-3 text-right font-bold">{bdt(v.closingCash)}</td></tr>
       <tr><td className="p-3">Difference (must be exactly zero)</td><td className="p-3 text-right font-black">{v.difference<0?'−':''}{bdt(Math.abs(v.difference))}</td></tr>
      </tbody></table>
    </div>
   </section>
   <section className={card}>
    <h2 className="text-lg font-black">Cash close and release controls</h2>
    <p className="mt-2 font-bold text-amber-800">{v.reconciles?'BOOK BRIDGE ARITHMETIC: PASS':'BOOK BRIDGE ARITHMETIC: MISMATCH'} · BANK VERIFICATION: NOT CERTIFIED</p>
    <p className="mt-2 text-sm text-slate-700">Monthly bank statements, independent matching, COD-to-order allocation, unclassified cash and card repayments must be reconciled separately. A zero arithmetic difference does not prove money reached the bank.</p>
    {raw?.unmatchedStatements!==undefined&&<p className="mt-2 text-sm font-bold">Unmatched independent bank statement lines: {raw.unmatchedStatements}</p>}
    {raw?.unclassifiedOutflow!==undefined&&<p className="mt-1 text-sm font-bold">Unclassified outgoing cash: {bdt(raw.unclassifiedOutflow)}</p>}
    <div className="mt-4 rounded-xl border border-slate-200 bg-white/50 p-4 text-sm">
     <b>Why this is not Net Profit</b>
     <p className="mt-2 text-slate-700">Inventory purchase does not become COGS until sale; collections may be customer liabilities; loan principal is financing. For Revenue − COGS − Expenses − Tax, use the separate Profit Calculation Breakdown.</p>
    </div>
    <Link href={link('/super-admin/profit-breakdown')} className="mt-4 inline-flex rounded-xl bg-teal-800 px-4 py-3 text-xs font-black text-white">Open profit calculation →</Link>
   </section>
  </>}
 </main></SuperAdminShell>
}
