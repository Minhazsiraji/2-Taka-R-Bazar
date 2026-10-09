import Link from 'next/link'
import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { TreasuryCashMovementChart } from '@/components/treasury-cash-movement-chart'
import { treasuryAddAccount, treasuryAddFacility, treasuryReviewTransaction, treasuryMatchStatement, treasuryAddForecast, treasurySetReserve } from '@/app/actions/treasury'

export const dynamic='force-dynamic'

type Account={id:string;name:string;kind:string;institution:string;last_four:string|null;balance:number|string;restricted:number|string;credit_limit:number|string|null;active:boolean}
type Facility={id:string;lender:string;kind:string;outstanding:number|string;original_principal:number|string;apr:number|string;due_day:number|null;maturity_date:string|null}
type Summary={
 cash_total:number|string;restricted_cash:number|string;unrestricted_cash:number|string;
 minimum_reserve:number|string;contractual_outflows_14d:number|string;contractual_inflows_14d:number|string;
 deployable_cash:number|string;card_outstanding:number|string;card_unused_limit:number|string;
 loan_and_private_borrowing_outstanding:number|string;total_financing_liabilities:number|string;
 pending_treasury_requests:number|string;unmatched_statement_lines:number;
 accounts:Account[];facilities:Facility[];cashflow_status:string
}
type Tx={id:string;kind:string;source_account_id:string|null;target_account_id:string|null;
 facility_id:string|null;expense_id:string|null;amount:number|string;interest_amount:number|string;fee_amount:number|string;
 business_date:string;external_reference:string;memo:string;status:string;
 requested_by:string;approved_by:string|null;created_at:string;matched_source:boolean;matched_target:boolean}
type Statement={id:string;account_id:string;external_line_id:string;statement_date:string;signed_amount:number|string;
 reference:string;matched_transaction_id:string|null;imported_by:string;matched_by:string|null}
type Forecast={id:string;due_date:string;expected_cash_change:number|string;event_kind:string;confidence:string;description:string;source_reference:string;status:string}
type Trend={month_start:string;operating_inflow?:number|string;operating_outflow:number|string;financing_inflow:number|string;financing_outflow:number|string;unallocated_card_bill:number|string;other_unallocated_interest:number|string;net_cash_movement:number|string}
const n=(x:unknown)=>Number(x??0)||0
const taka=(v:unknown)=>'৳'+n(v).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmt=(v:string)=>new Date(v+'T12:00:00Z').toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})
const input='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
const label='grid min-w-0 gap-1 text-xs font-bold text-slate-600'
const txLabel=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase())
function Card({children,className=''}:{children:React.ReactNode;className?:string}) {
 return <section className={'finance-panel rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(2,6,23,.035)] '+className}>{children}</section>
}
function Metric({name,value,description,color='text-slate-950'}:{name:string;value:string;description:string;color?:string}){
 return <Card><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">{name}</p><p className={'mt-3 break-words text-2xl font-black tracking-tight '+color}>{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p></Card>
}
function Movements({data}:{data:Trend[]}){
 return <Card>
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-lg font-black">Cash movements</h2><p className="mt-1 text-xs text-slate-500">Six-month posted cash activity · management reporting</p></div>
   <span className="finance-verified-badge rounded-lg px-3 py-1.5 text-xs font-bold">Ledger-backed</span>
  </div>
  <TreasuryCashMovementChart data={data}/>
  <p className="mt-3 text-xs leading-5 text-slate-500">Transfers between company accounts and non-cash card charges are excluded. Card-bill cash movements and loan interest require final IAS 7 classification.</p>
 </Card>
}
const demoSummary:Summary={
 cash_total:193200,restricted_cash:0,unrestricted_cash:193200,minimum_reserve:100000,
 contractual_outflows_14d:20000,contractual_inflows_14d:0,deployable_cash:73200,
 card_outstanding:6000,card_unused_limit:24000,loan_and_private_borrowing_outstanding:53000,
 total_financing_liabilities:59000,pending_treasury_requests:0,unmatched_statement_lines:1,
 cashflow_status:'MANAGEMENT_ONLY_OPERATIONS_AND_BANK_RECONCILIATION_PENDING',
 accounts:[
 {id:'demo-a',name:'Operating Bank A',kind:'bank',institution:'Sample Bank A',last_four:'1234',balance:101200,restricted:0,credit_limit:null,active:true},
 {id:'demo-b',name:'Procurement Bank B',kind:'bank',institution:'Sample Bank B',last_four:'5678',balance:57000,restricted:0,credit_limit:null,active:true},
 {id:'demo-c',name:'Reserve Bank C',kind:'bank',institution:'Sample Bank C',last_four:'9876',balance:5000,restricted:0,credit_limit:null,active:true},
 {id:'demo-cash',name:'Office cash',kind:'cash',institution:'Office',last_four:null,balance:20000,restricted:0,credit_limit:null,active:true},
 {id:'demo-wallet',name:'Mobile wallet',kind:'wallet',institution:'Sample Wallet',last_four:'1478',balance:10000,restricted:0,credit_limit:null,active:true},
 {id:'demo-card',name:'Corporate credit card',kind:'credit_card',institution:'Sample Bank',last_four:'4455',balance:6000,restricted:0,credit_limit:30000,active:true}],
 facilities:[{id:'demo-loan',lender:'Sample Bank',kind:'bank_loan',outstanding:45000,original_principal:100000,apr:11.5,due_day:15,maturity_date:null},
 {id:'demo-private',lender:'Private lender',kind:'private_borrowing',outstanding:8000,original_principal:15000,apr:0,due_day:null,maturity_date:null}]
}
const demoTransactions:Tx[]=[
 {id:'demo-1',kind:'transfer',amount:10000,business_date:'2026-10-09',external_reference:'DEMO-TRANSFER',memo:'Operating to procurement bank',status:'posted',requested_by:'demo-maker',approved_by:'demo-checker',created_at:'2026-10-09',source_account_id:'demo-a',target_account_id:'demo-b',facility_id:null,expense_id:null,interest_amount:0,fee_amount:0,matched_source:true,matched_target:true},
 {id:'demo-2',kind:'loan_repay',amount:10000,business_date:'2026-10-09',external_reference:'DEMO-REPAY',memo:'Principal plus finance cost',status:'posted',requested_by:'demo-maker',approved_by:'demo-checker',created_at:'2026-10-09',source_account_id:'demo-a',target_account_id:null,facility_id:'demo-loan',expense_id:null,interest_amount:500,fee_amount:100,matched_source:false,matched_target:false},
 {id:'demo-3',kind:'expense_card',amount:3000,business_date:'2026-10-09',external_reference:'DEMO-CARD',memo:'Approved office expense on credit card',status:'posted',requested_by:'demo-maker',approved_by:'demo-checker',created_at:'2026-10-09',source_account_id:null,target_account_id:'demo-card',facility_id:null,expense_id:'demo-expense',interest_amount:0,fee_amount:0,matched_source:false,matched_target:false}
]
const demoTrends:Trend[]=['2026-05-01','2026-06-01','2026-07-01','2026-08-01','2026-09-01','2026-10-01'].map((m,i)=>({
 month_start:m,operating_outflow:[0,0,15000,22000,17000,1200][i],
 financing_inflow:[0,0,150000,0,20000,30000][i],financing_outflow:[0,0,0,12000,15000,13000][i],
 unallocated_card_bill:[0,0,0,1000,2000,2000][i],other_unallocated_interest:[0,0,0,0,0,600][i],
 net_cash_movement:[0,0,135000,-35000,-14000,13200][i]
}))
const demoForecast:Forecast[]=[{id:'demo-f1',due_date:'2026-10-16',expected_cash_change:-20000,event_kind:'supplier_payment',confidence:'contractual',description:'Approved supplier invoice due',source_reference:'DEMO-SUPPLIER',status:'open'}]

export default async function TreasuryOwner({searchParams}:{searchParams:Promise<{demo?:string;error?:string;notice?:string}>}){
 const {supabase}=await requireSuperAdmin()
 const q=await searchParams
 const demo=q.demo==='1'
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})
 const month=today.slice(0,7)+'-01'
 const isolated=process.env.VERCEL_ENV==='preview'&&process.env.FINANCE_WRITES_ENABLED==='true'&&
  Boolean(process.env.FINANCE_PREVIEW_SUPABASE_URL)&&
  process.env.NEXT_PUBLIC_SUPABASE_URL===process.env.FINANCE_PREVIEW_SUPABASE_URL&&
  !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('sukabonfjcnaavjgjyuy')
 let summary:Summary|null=null,transactions:Tx[]=[],statements:Statement[]=[],forecasts:Forecast[]=[],trends:Trend[]=[]
 let dbError=''
 if(demo){
   summary=demoSummary;transactions=demoTransactions;forecasts=demoForecast;trends=demoTrends
 }else{
   const [s,t,b,f,c]=await Promise.all([
    supabase.rpc('treasury_dashboard',{p_today:today}),
    supabase.rpc('treasury_transaction_feed',{p_limit:100}),
    supabase.rpc('treasury_statement_feed',{p_limit:100}),
    supabase.rpc('treasury_forecast_feed',{p_today:today}),
    supabase.rpc('treasury_cashflow_trend',{p_month:month})
   ])
   if(s.error||t.error||b.error||f.error||c.error)dbError='The Treasury Preview schema is not installed here; this is not a writable financial environment.'
   else {summary=s.data as Summary;transactions=(t.data??[]) as Tx[];statements=(b.data??[]) as Statement[];forecasts=(f.data??[]) as Forecast[];trends=(c.data??[]) as Trend[]}
 }
 const accounts=summary?.accounts??[],debts=summary?.facilities??[],pending=transactions.filter(x=>x.status==='pending')
 const byId=new Map(accounts.map(a=>[a.id,a]))
 return <SuperAdminShell><div className="finance-ops-surface grid min-w-0 gap-4">
   <section className="finance-ops-hero relative overflow-hidden rounded-[27px] bg-[linear-gradient(115deg,#092a3d_0%,#10585d_55%,#138c81_100%)] px-5 py-7 text-white shadow-xl shadow-teal-950/10 sm:p-7">
    <div className="relative flex flex-wrap items-start justify-between gap-3">
     <div><p className="text-[11px] font-black uppercase tracking-[.25em] text-cyan-200">2-TAKA-R-BAZAR · TREASURY</p><h1 className="mt-2 text-3xl font-black tracking-tight">Cash flow & liquidity</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-teal-100">One financial source of truth. Multiple bank accounts, cash, loans and cards — reconciled with maker-checker approvals.</p>
     </div><span className="finance-hero-badge rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-bold">{demo?'SYNTHETIC · NO REAL ACCOUNTS':isolated?'ISOLATED PREVIEW':'WRITES LOCKED'}</span>
    </div>
    <div className="finance-hero-actions relative mt-6 flex flex-wrap gap-3"><Link href="/super-admin/finance" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold">Finance & profit →</Link><Link href="/admin/treasury" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold">Finance staff request desk →</Link><Link href="/super-admin/treasury?demo=1" className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-teal-800">Explore synthetic demo</Link></div>
   </section>
   {q.error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{q.error}</div>}
   {q.notice&&<div role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-900">{q.notice}</div>}
   {dbError&&<div className="finance-gate-notice rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{dbError} <Link href="/super-admin/treasury?demo=1" className="font-black underline">Open synthetic design demo</Link></div>}
   {demo&&<div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm font-semibold text-purple-800">Illustrative entries only. These are not your actual bank accounts, liabilities, profit or financial statements.</div>}
   {!isolated&&<div className="finance-protection-notice rounded-xl bg-slate-200/60 p-3 text-xs text-slate-700"><b>Production protection:</b> All cash-changing actions require an isolated Preview database. No transaction can be posted to the live Supabase instance from this branch.</div>}
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <Metric name="Total book cash" value={dbError?'—':taka(summary?.cash_total)} description="Banks, wallet, office/community cash; excludes unused card credit"/>
    <Metric name="Unrestricted cash" value={dbError?'—':taka(summary?.unrestricted_cash)} color="text-teal-700" description="After legally or operationally restricted balances"/>
    <Metric name="Deployable cash" value={dbError?'—':taka(summary?.deployable_cash)} color="text-emerald-700" description="After 14-day contractual outflows and minimum reserve"/>
    <Metric name="Business debt" value={dbError?'—':taka(summary?.loan_and_private_borrowing_outstanding)} description="Bank and private loans principal outstanding"/>
    <Metric name="Card obligations" value={dbError?'—':taka(summary?.card_outstanding)} color="text-violet-700" description={'Available card credit: '+taka(summary?.card_unused_limit)+' (not cash)'}/>
    <Metric name="Unmatched bank lines" value={dbError?'—':String(summary?.unmatched_statement_lines??0)} color="text-amber-700" description="Book balance is not certified by external statements"/>
   </div>
   <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
    <Movements data={trends}/>
    <Card>
     <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-black">Liquidity protection</h2><p className="mt-1 text-xs text-slate-500">Cash not available for discretionary debt repayment</p></div><span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">14-day horizon</span></div>
     <div className="mt-7 space-y-3">
      {[
       ['Cash, total',summary?.cash_total,'text-slate-950'],
       ['Restricted cash',summary?.restricted_cash,'text-amber-700'],
       ['Minimum operating reserve',summary?.minimum_reserve,'text-slate-700'],
       ['Contractual payouts due',summary?.contractual_outflows_14d,'text-rose-700'],
       ['Uncommitted deployable cash',summary?.deployable_cash,'text-emerald-700'],
      ].map(([name,value,color])=><div key={String(name)} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-sm"><span className="text-slate-600">{name}</span><b className={'tabular-nums '+color}>{taka(value)}</b></div>)}
     </div>
     <p className="mt-4 text-xs leading-5 text-slate-500">Contractual cash receipts due soon: {taka(summary?.contractual_inflows_14d)}, shown separately and not counted as available cash before collection. Unlinked purchase orders and customer collections must be integrated before decision-grade liquidity.</p>
     {!demo&&<form action={treasurySetReserve} className="mt-4 flex flex-wrap gap-2"><input type="number" step="0.01" name="minimum_operating_reserve" defaultValue={n(summary?.minimum_reserve)} min="0" className={input+' min-w-[140px] flex-1'} aria-label="Minimum operating reserve"/><button disabled={!isolated} className="rounded-xl bg-slate-900 px-3 py-2 font-bold text-sm text-white disabled:opacity-40">Update reserve</button></form>}
    </Card>
   </div>
   <div className="grid gap-4 lg:grid-cols-2">
    <Card>
     <div className="flex justify-between gap-2"><h2 className="text-lg font-black">Money locations</h2><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold">{accounts.length} accounts</span></div>
     <div className="mt-4 space-y-2">{accounts.map(a=><div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-lg">{a.kind==='bank'?'▥':a.kind==='wallet'?'◉':a.kind==='cash'?'৳':'▤'}</div><div className="min-w-0"><p className="truncate text-sm font-black">{a.name}</p><p className="text-xs text-slate-500">{a.institution} {a.last_four?'•••• '+a.last_four:''} · {a.kind}</p></div></div><b className="shrink-0 text-sm tabular-nums">{taka(a.balance)}</b>
     </div>)}{accounts.length===0&&<div className="py-8 text-center text-sm text-slate-500">No treasury accounts registered in this environment.</div>}</div>
    </Card>
    <Card>
     <div className="flex justify-between gap-2"><h2 className="text-lg font-black">Loans & financing</h2><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold">{debts.length} facilities</span></div>
     <div className="mt-4 space-y-3">{debts.map(d=><div key={d.id} className="rounded-2xl border border-slate-100 p-4">
      <div className="flex flex-wrap justify-between gap-2"><b>{d.lender}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{d.kind.replaceAll('_',' ')}</span></div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span className="text-slate-500">Outstanding principal</span><b>{taka(d.outstanding)}</b></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400" style={{width:(Math.min(100,Math.max(0,n(d.outstanding)/Math.max(1,n(d.original_principal))*100)))+'%'}}/></div>
      <p className="mt-2 text-xs text-slate-500">{d.apr}% APR · Due day {d.due_day??'Not specified'} · maturity {d.maturity_date??'Not recorded'}</p>
     </div>)}{!debts.length&&<div className="py-8 text-center text-sm text-slate-500">No registered financing facilities.</div>}</div>
    </Card>
   </div>
   <Card>
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-black">Approval inbox</h2><p className="mt-1 text-xs text-slate-500">Independent authorizations · nothing posts before approval</p></div><span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{pending.length} waiting</span></div>
    <div className="mt-4 space-y-3">{pending.map(t=><div key={t.id} className="rounded-2xl border border-slate-200 p-4">
     <div className="flex flex-wrap justify-between gap-2"><div><b className="text-sm">{txLabel(t.kind)}</b><p className="text-xs text-slate-500">{t.business_date} · {t.external_reference} · {t.memo}</p></div><b className="text-lg">{taka(n(t.amount)+n(t.interest_amount)+n(t.fee_amount))}</b></div>
     {!demo&&<form action={treasuryReviewTransaction} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="transaction_id" value={t.id}/><input name="note" className={input+' min-w-[160px] flex-1'} placeholder="Review note / rejection reason"/><button disabled={!isolated} name="decision" value="approve" className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Approve & post</button><button disabled={!isolated} name="decision" value="reject" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Reject</button></form>}
    </div>)}{!pending.length&&<p className="py-7 text-center text-sm text-slate-500">No pending maker requests.</p>}</div>
   </Card>
   <Card>
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-black">Treasury transaction trail</h2><p className="mt-1 text-xs text-slate-500">Posted means general-ledger authorized. Reconciled means independently matched to external statement.</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs">{transactions.length} transactions</span></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-slate-200 uppercase tracking-wider text-slate-400"><th className="py-3">Date</th><th>Movement / description</th><th className="text-right">Value</th><th className="pl-4">Ledger</th><th>External match</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id} className="border-b border-slate-100 last:border-0"><td className="py-3">{t.business_date}</td><td className="py-3"><b>{txLabel(t.kind)}</b><p className="max-w-52 truncate text-slate-500">{t.memo} · {t.external_reference}</p></td><td className="py-3 text-right font-black">{taka(n(t.amount)+n(t.interest_amount)+n(t.fee_amount))}</td><td className="pl-4"><span className={'rounded-lg px-2 py-1 font-bold '+(t.status==='posted'?'bg-teal-50 text-teal-700':t.status==='pending'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700')}>{t.status}</span></td><td className="text-slate-600">{t.status==='posted'?((t.source_account_id?t.matched_source:true)&&(t.target_account_id?t.matched_target:true)?'Matched':'Unmatched / partial'):'Not yet posted'}</td></tr>)}</tbody></table>
     {!transactions.length&&<p className="p-5 text-center text-sm text-slate-500">No financial transactions recorded.</p>}</div>
   </Card>
   <div className="grid gap-4 lg:grid-cols-2">
    <Card>
     <h2 className="text-lg font-black">Independent bank reconciliation</h2><p className="mt-1 text-xs text-slate-500">Match each imported statement to a posted transaction. Wrong account, amount, date or duplicate will be rejected.</p>
     <div className="mt-4 space-y-3">{statements.filter(s=>!s.matched_transaction_id).slice(0,20).map(s=><div key={s.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{byId.get(s.account_id)?.name??'Account'}</b><b className="text-sm">{taka(s.signed_amount)}</b></div><p className="mt-1 text-xs text-slate-600">{s.statement_date} · {s.reference}</p>
      {!demo&&<form action={treasuryMatchStatement} className="mt-3 grid gap-2"><input type="hidden" name="statement_id" value={s.id}/><select name="transaction_id" required className={input}><option value="">Select posted transaction</option>{transactions.filter(t=>t.status==='posted').map(t=><option key={t.id} value={t.id}>{t.external_reference} · {txLabel(t.kind)} · {taka(t.amount)}</option>)}</select><input name="note" placeholder="Mismatch explanation, when required" className={input}/><button disabled={!isolated} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Match independently →</button></form>}
     </div>)}{!statements.some(s=>!s.matched_transaction_id)&&<p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No unmatched statement lines.</p>}</div>
    </Card>
    <Card>
     <h2 className="text-lg font-black">13-week cash obligations</h2><p className="mt-1 text-xs text-slate-500">Forecasted money movements. Entries are not counted as actual cash.</p>
     <div className="mt-4 space-y-2">{forecasts.slice(0,20).map(f=><div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="min-w-0"><b className="text-xs">{f.description}</b><p className="text-[11px] text-slate-500">{f.due_date} · {f.event_kind.replaceAll('_',' ')} · {f.confidence}</p></div><b className={'shrink-0 text-xs '+(n(f.expected_cash_change)<0?'text-rose-700':'text-emerald-700')}>{taka(f.expected_cash_change)}</b></div>)}{!forecasts.length&&<p className="p-5 text-sm text-slate-500">No due events recorded. Forecast completeness is currently unknown, not zero.</p>}</div>
     {!demo&&<form action={treasuryAddForecast} className="mt-5 grid gap-2 sm:grid-cols-2">
      <label className={label}>Due date<input className={input} type="date" name="due_date" required defaultValue={today}/></label><label className={label}>Signed cash change (+/- BDT)<input className={input} type="number" name="expected_cash_change" step="0.01" required/></label>
      <label className={label}>Category<select name="event_kind" className={input}>{['supplier_payment','customer_collection','loan_due','card_due','payroll','rent','marketing','logistics','tax','other'].map(x=><option key={x} value={x}>{txLabel(x)}</option>)}</select></label>
      <label className={label}>Certainty<select name="confidence" className={input}><option value="contractual">Contractual / committed</option><option value="provisional">Provisional estimate</option></select></label>
      <label className={label}>Source reference<input className={input} name="source_reference" minLength={4} required/></label>
      <label className={label}>Description<input className={input} name="description" minLength={6} required/></label>
      <button disabled={!isolated} className="col-span-full rounded-xl bg-teal-700 px-3 py-2.5 text-sm font-black text-white disabled:opacity-40">Add forecast event</button>
     </form>}
    </Card>
   </div>
   {!demo&&<div className="grid gap-4 lg:grid-cols-2">
    <Card><h2 className="text-lg font-black">Register bank, cash or credit card</h2><p className="mt-1 text-xs text-slate-500">Open with an auditable balance, masked account reference and a dedicated GL account.</p>
      <form action={treasuryAddAccount} className="mt-4 grid gap-2 sm:grid-cols-2">
       <label className={label}>Account name<input name="name" className={input} required minLength={3}/></label>
       <label className={label}>Type<select className={input} name="account_kind"><option value="bank">Bank account</option><option value="wallet">Wallet</option><option value="cash">Cash</option><option value="credit_card">Credit card</option></select></label>
       <label className={label}>Institution<input name="institution" className={input} required minLength={2}/></label>
       <label className={label}>Last 4 digits ONLY<input name="last_four" className={input} maxLength={4} placeholder="1234"/></label>
       <label className={label}>Opening as of<input name="opened_on" type="date" defaultValue={today} className={input} required/></label>
       <label className={label}>Opening balance / card payable<input name="opening_balance" type="number" min="0" step="0.01" defaultValue="0" className={input} required/></label>
       <label className={label}>Restricted cash<input name="restricted_amount" type="number" min="0" step="0.01" defaultValue="0" className={input}/></label>
       <label className={label}>Credit limit (cards only)<input name="credit_limit" type="number" min="0.01" step="0.01" className={input}/></label>
       <label className={label+' sm:col-span-2'}>Opening statement or signed cash count reference<input name="opening_reference" required minLength={4} className={input}/></label>
       <button disabled={!isolated} className="sm:col-span-2 rounded-xl bg-teal-700 px-3 py-2.5 text-sm font-black text-white disabled:opacity-40">Create treasury account</button>
      </form>
    </Card>
    <Card><h2 className="text-lg font-black">Register business borrowing</h2><p className="mt-1 text-xs text-slate-500">New borrowing starts at zero until actual disbursement. Historical outstanding may be entered with a signed opening agreement.</p>
      <form action={treasuryAddFacility} className="mt-4 grid gap-2 sm:grid-cols-2">
       <label className={label}>Lender name<input name="lender" required minLength={3} className={input}/></label>
       <label className={label}>Type<select name="facility_kind" className={input}><option value="bank_loan">Bank loan</option><option value="private_borrowing">Private borrowing</option></select></label>
       <label className={label}>Original facility principal<input name="original_principal" type="number" min="0.01" step="0.01" required className={input}/></label>
       <label className={label}>Existing outstanding<input name="opening_outstanding" type="number" min="0" step="0.01" defaultValue="0" required className={input}/></label>
       <label className={label}>APR %<input name="interest_apr" type="number" min="0" max="1000" step="0.0001" defaultValue="0" className={input}/></label>
       <label className={label}>Scheduled monthly due day<input name="due_day" type="number" min="1" max="28" className={input}/></label>
       <label className={label}>Opening as of<input name="opened_on" type="date" defaultValue={today} required className={input}/></label>
       <label className={label}>Maturity date<input name="maturity_date" type="date" className={input}/></label>
       <label className={label+' sm:col-span-2'}>Signed loan / borrowing agreement reference<input name="agreement_reference" minLength={4} required className={input}/></label>
       <button disabled={!isolated} className="sm:col-span-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-black text-white disabled:opacity-40">Add financing facility</button>
      </form>
    </Card>
   </div>}
   <div className="finance-glass-gate rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-black text-amber-950">Financial completeness & audit gate</h2><p className="mt-2 text-sm leading-6 text-amber-900">These are management ledger movements — NOT a certified IAS 7 statement. Bank statement links may be incomplete. Customer sales collections, procurement payments, supplier payables, card-flow allocation, true 13-week automatically generated commitments, tax and month close need reconciliation before cash recovery, DSCR, working-capital cash conversion and international-standard consolidated reports can be certified. No Production bank transfers or repayments can be executed from this dashboard.</p></div>
 </div></SuperAdminShell>
}
