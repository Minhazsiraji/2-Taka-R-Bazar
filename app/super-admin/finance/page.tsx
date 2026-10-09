import Link from 'next/link'
import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { createFinanceExpense, reviewFinanceExpense, requestFinanceSettlement, reviewFinanceSettlement } from '@/app/actions/finance'

export const dynamic = 'force-dynamic'

type E = {
 id:string;category:string;description:string;vendor_name:string;document_reference:string;
 amount:number|string;incurred_on:string;community_id:string|null;campaign_code:string|null;
 status:string;created_by:string;reviewed_by:string|null;created_at:string;
 evidence_path:string; evidence_sha256:string;
 settlement_id:string|null;settlement_status:string|null;settlement_evidence_path:string|null
}
type Line = {posted_at:string;posting_date:string;event_key:string;memo:string;account_code:string;account_title:string;debit:number|string;credit:number|string;community_id:string|null}
type Summary = { month:string; posted_expenses:number|string; settled_cash_out:number|string; pending_count:number;payment_pending_count:number;by_category:{category:string;amount:number|string}[];profit_status:string }
const CATEGORY=[
 ['logistics','Logistics & delivery','#0ea5e9'],
 ['marketing_offline','Marketing — offline','#14b8a6'],
 ['marketing_online','Marketing — online','#8b5cf6'],
 ['office','Office & staff','#f59e0b'],
 ['infrastructure','Technology & infrastructure','#64748b'],
 ['commissions','Commissions & incentives','#f472b6'],
 ['miscellaneous','Other operating costs','#fb7185'],
] as const
const labelFor=(v:string)=>CATEGORY.find(x=>x[0]===v)?.[1]??v.replaceAll('_',' ')
const num=(v:unknown)=>Number(v??0)||0
const bd=(v:unknown)=>'৳'+num(v).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})
const monthKey=(s:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s)?s:''
const demoExpenses:E[]=[
 {id:'preview-1',category:'marketing_offline',description:'Community QR print campaign',vendor_name:'Example print partner',document_reference:'DEMO-QRP-101',amount:1200,incurred_on:'2026-10-04',community_id:null,campaign_code:'AMT-01',status:'settled',created_by:'demo',reviewed_by:'demo2',created_at:'2026-10-04',settlement_id:'settle1',settlement_status:'verified',evidence_path:'DEMO',evidence_sha256:'DEMO',settlement_evidence_path:'DEMO'},
 {id:'preview-2',category:'logistics',description:'Community point freight',vendor_name:'Example transport',document_reference:'DEMO-FRT-102',amount:880,incurred_on:'2026-10-05',community_id:null,campaign_code:null,status:'posted',created_by:'demo',reviewed_by:'demo2',created_at:'2026-10-05',settlement_id:null,settlement_status:null,evidence_path:'DEMO',evidence_sha256:'DEMO',settlement_evidence_path:null,evidence_path:'DEMO',evidence_sha256:'DEMO',settlement_evidence_path:null},
 {id:'preview-3',category:'marketing_online',description:'Facebook location-targeted test',vendor_name:'Example ad provider',document_reference:'DEMO-ADS-103',amount:2000,incurred_on:'2026-10-06',community_id:null,campaign_code:'AMT-01',status:'submitted',created_by:'demo',reviewed_by:null,created_at:'2026-10-06',settlement_id:null,settlement_status:null},
 {id:'preview-4',category:'infrastructure',description:'Domain and digital services',vendor_name:'Example tech provider',document_reference:'DEMO-INF-104',amount:700,incurred_on:'2026-10-07',community_id:null,campaign_code:null,status:'settlement_requested',created_by:'demo',reviewed_by:'demo2',created_at:'2026-10-07',settlement_id:'settle4',settlement_status:'pending',evidence_path:'DEMO',evidence_sha256:'DEMO',settlement_evidence_path:'DEMO'}
]
const demoLedger:Line[]=[
 {posted_at:'2026-10-04',posting_date:'2026-10-04',event_key:'DEMO:accrual:1',memo:'Community QR print campaign',account_code:'6200',account_title:'Offline marketing',debit:1200,credit:0,community_id:null},
 {posted_at:'2026-10-04',posting_date:'2026-10-04',event_key:'DEMO:accrual:1',memo:'Community QR print campaign',account_code:'2000',account_title:'Approved expenses payable',debit:0,credit:1200,community_id:null},
 {posted_at:'2026-10-04',posting_date:'2026-10-04',event_key:'DEMO:settlement:1',memo:'QR printing paid',account_code:'2000',account_title:'Approved expenses payable',debit:1200,credit:0,community_id:null},
 {posted_at:'2026-10-04',posting_date:'2026-10-04',event_key:'DEMO:settlement:1',memo:'QR printing paid',account_code:'1000',account_title:'Cash on hand',debit:0,credit:1200,community_id:null}
]
function Card({children,className=''}:{children:React.ReactNode;className?:string}){return <div className={'rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(2,6,23,0.035)] '+className}>{children}</div>}
function Metric({name,value,sub,accent='text-slate-950'}:{name:string;value:string;sub:string;accent?:string}){
 return <Card><p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-500">{name}</p><p className={'mt-3 break-words text-2xl font-black tracking-tight sm:text-3xl '+accent}>{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{sub}</p></Card>
}
function CostBreakdown({rows}:{rows:{category:string;amount:number|string}[]}){
 const raw=CATEGORY.map(([key,title,color])=>({key,title,color,amount:Math.max(0,num(rows.find(x=>x.category===key)?.amount))}))
 const total=raw.reduce((v,x)=>v+x.amount,0)
 const stops:string[]=[];let pct=0
 for(const x of raw){const length=total?x.amount/total*100:0;if(length)stops.push(x.color+' '+pct+'% '+(pct+length)+'%');pct+=length}
 return <Card>
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">Cost composition</h2><p className="text-xs text-slate-500">Posted operating expenses by category</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Accrual basis</span></div>
  <div className="mt-7 flex flex-col items-center gap-7 md:flex-row">
   <div className="relative h-48 w-48 shrink-0 rounded-full" role="img" aria-label="Expense category composition" style={{background:total?'conic-gradient('+stops.join(', ')+')':'conic-gradient(#e2e8f0 0% 100%)'}}>
    <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_#e2e8f0]">
     <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</span>
     <strong className="mt-1 text-xl font-black">{bd(total)}</strong>
    </div>
   </div>
   <div className="w-full min-w-0 flex-1 space-y-3">{raw.map(x=><div key={x.key} className="flex items-center justify-between gap-2 text-sm">
    <div className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:x.color}}/><span className="truncate text-slate-600">{x.title}</span></div>
    <b className="shrink-0 tabular-nums">{bd(x.amount)}</b>
   </div>)}</div>
  </div>
 </Card>
}
function CategoryBars({rows}:{rows:{category:string;amount:number|string}[]}){
 const vals=CATEGORY.map(([k,name,color])=>({k,name,color,value:num(rows.find(x=>x.category===k)?.amount)}))
 const max=Math.max(1,...vals.map(x=>x.value))
 return <Card>
  <h2 className="text-lg font-black">Expense distribution</h2><p className="text-xs text-slate-500">Review where money is spent and compare channels</p>
  <div className="mt-6 space-y-4">{vals.map(x=><div key={x.k}>
    <div className="mb-1.5 flex justify-between gap-2 text-xs"><span className="font-semibold text-slate-600">{x.name}</span><b className="tabular-nums">{bd(x.value)}</b></div>
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-500" style={{width:(x.value/max*100)+'%',background:'linear-gradient(90deg,'+x.color+','+x.color+'bb)'}}/></div>
   </div>)}</div>
 </Card>
}
function pill(status:string){
 const colors:Record<string,string>={settled:'bg-emerald-50 text-emerald-700',posted:'bg-sky-50 text-sky-700',submitted:'bg-amber-50 text-amber-700',rejected:'bg-red-50 text-red-700',settlement_requested:'bg-violet-50 text-violet-700'}
 return <span className={'inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider '+(colors[status]??'bg-slate-100 text-slate-600')}>{status.replaceAll('_',' ')}</span>
}
export default async function FinancePage({searchParams}:{searchParams:Promise<{month?:string;demo?:string;notice?:string;error?:string}>}){
 const user=await requireSuperAdmin()
 const query=await searchParams
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'}).slice(0,7)
 const month=monthKey(query.month??'')||today
 const monthStart=month+'-01'
 const demo=query.demo==='1'
 const params=month=>'/super-admin/finance?month='+month+(demo?'&demo=1':'')
 let rows:E[]=[]
 let ledger:Line[]=[]
 let report:Summary|null=null
 let dbError=''
 const isolated=process.env.VERCEL_ENV==='preview'&&process.env.FINANCE_WRITES_ENABLED==='true'&&Boolean(process.env.FINANCE_PREVIEW_SUPABASE_URL)&&process.env.NEXT_PUBLIC_SUPABASE_URL===process.env.FINANCE_PREVIEW_SUPABASE_URL&&!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('sukabonfjcnaavjgjyuy')
 if(demo){
  rows=demoExpenses;ledger=demoLedger
  report={month:monthStart,posted_expenses:2780,settled_cash_out:1200,pending_count:1,payment_pending_count:2,by_category:[{category:'marketing_offline',amount:1200},{category:'logistics',amount:880},{category:'infrastructure',amount:700}],profit_status:'UNAVAILABLE_UNTIL_REVENUE_COGS_RECONCILED'}
 } else {
  const [a,b,c]=await Promise.all([
   user.supabase.rpc('finance_report',{p_month:monthStart}),
   user.supabase.rpc('finance_list_expenses',{p_month:monthStart}),
   user.supabase.rpc('finance_ledger',{p_month:monthStart}),
  ])
  if(a.error||b.error||c.error){dbError='Finance schema is not available in this environment. Preview code has not been installed on an isolated database.'}
  else {report=a.data as Summary;rows=(b.data??[]) as E[];ledger=(c.data??[]) as Line[]}
 }
 const monthDate=new Date(monthStart+'T12:00:00Z')
 const previous=new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()-1,1)).toISOString().slice(0,7)
 const next=new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+1,1)).toISOString().slice(0,7)
 const monthTitle=monthDate.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})
 const drafts=rows.filter(x=>x.status==='submitted')
 const evidenceLinks = new Map<string,string>()
 if(!demo && !dbError) {
  await Promise.all(rows.slice(0,100).flatMap(e=>[
    e.evidence_path && user.supabase.storage.from('finance-evidence').createSignedUrl(e.evidence_path,300)
      .then(({data})=>{if(data?.signedUrl)evidenceLinks.set(e.id,data.signedUrl)}),
    e.settlement_evidence_path && user.supabase.storage.from('finance-evidence').createSignedUrl(e.settlement_evidence_path,300)
      .then(({data})=>{if(data?.signedUrl)evidenceLinks.set('settlement:'+e.id,data.signedUrl)}),
  ].filter(Boolean) as Promise<void>[]))
 }
 const paymentQueue=rows.filter(x=>x.status==='settlement_requested')
 return <SuperAdminShell><div className="grid min-w-0 gap-5">
  <section className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(117deg,#082b3e_0%,#0c5757_52%,#167c77_100%)] px-5 py-7 text-white shadow-[0_16px_45px_rgba(8,68,73,.22)] sm:p-8">
   <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[40px] border-white/5"/><div className="pointer-events-none absolute -bottom-20 right-20 h-44 w-44 rounded-full bg-teal-300/10 blur-xl"/>
   <div className="relative flex flex-wrap items-start justify-between gap-3">
    <div><p className="text-[10px] font-black uppercase tracking-[.28em] text-teal-200">2-TAKA-R-BAZAR · OWNER FINANCE</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Finance intelligence</h1><p className="mt-2 max-w-xl text-sm text-teal-100">Controlled expenses, independent approvals, auditable transactions, and a clear path to reconciled net profit.</p></div>
    <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-bold">{demo?'SYNTHETIC DEMO':isolated?'ISOLATED PREVIEW':'PREVIEW · WRITES LOCKED'}</span>
   </div>
   <div className="relative mt-8 flex flex-wrap items-end justify-between gap-5">
    <div><p className="text-xs font-semibold text-teal-200">Final net profit</p><div className="mt-1 text-2xl font-black sm:text-3xl">Not certified yet</div><p className="mt-1 text-[11px] text-teal-100">Sales, actual procurement COGS and settlements must reconcile before closing P&amp;L.</p></div>
    <div className="flex gap-2"><Link href={params(previous)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20" aria-label="Previous month">←</Link><div className="rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-bold">{monthTitle}</div><Link href={params(next)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20" aria-label="Next month">→</Link></div>
   </div>
  </section>
  {query.error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{query.error}</p>}
  {query.notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{query.notice}</p>}
  {dbError&&<div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{dbError} <Link href={'/super-admin/finance?demo=1&month='+month} className="ml-1 font-black underline">Explore the clearly labeled UI demo →</Link></div>}
  {demo&&<div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-bold text-violet-800">Simulation only — these records are invented examples. No customer, supplier, expense, revenue or profit data is being read or changed.</div>}
  {!isolated&&<div className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-700"><b>Financial mutation gate:</b> OFF. Approvals and payments cannot post to the Production database. An independent preview database and explicit environment confirmation are required.</div>}
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Metric name="Posted expenses" value={bd(report?.posted_expenses)} sub="Ledger-backed, current period"/>
   <Metric name="Payment outflows" value={bd(report?.settled_cash_out)} sub="Approved expense settlements" accent="text-teal-700"/>
   <Metric name="Approval queue" value={String(report?.pending_count??0)} sub="Submitted expenses awaiting independent review" accent="text-amber-700"/>
   <Metric name="Payment queue" value={String(report?.payment_pending_count??0)} sub="Approved costs awaiting verified settlement" accent="text-violet-700"/>
  </div>
  <div className="grid gap-4 lg:grid-cols-2"><CostBreakdown rows={report?.by_category??[]}/><CategoryBars rows={report?.by_category??[]}/></div>
  <section className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
   <Card>
    <div className="flex items-start justify-between gap-2"><div><h2 className="text-lg font-black">Record an expense</h2><p className="text-xs text-slate-500">One entry, independent approval, automatic balanced journal</p></div><span className="rounded-lg bg-teal-50 px-2 py-1 text-[10px] font-black text-teal-700">MAKER</span></div>
    <form action={createFinanceExpense} className="mt-5 grid grid-cols-2 gap-3">
     <label className="col-span-2 grid gap-1 text-xs font-bold text-slate-600">Category<select name="category" required className="rounded-xl border border-slate-200 bg-white p-3 text-sm">{CATEGORY.map(x=><option value={x[0]} key={x[0]}>{x[1]}</option>)}</select></label>
     <label className="col-span-2 grid gap-1 text-xs font-bold text-slate-600">Description<input name="description" minLength={6} required placeholder="e.g. QR printing for AMT-01" className="rounded-xl border border-slate-200 p-3 text-sm"/></label>
     <label className="grid gap-1 text-xs font-bold text-slate-600">Amount (BDT)<input name="amount" type="number" min="0.01" step="0.01" required className="w-full rounded-xl border border-slate-200 p-3 text-sm"/></label>
     <label className="grid gap-1 text-xs font-bold text-slate-600">Incurred on<input name="incurred_on" type="date" defaultValue={new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})} required className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-sm"/></label>
     <label className="col-span-2 grid gap-1 text-xs font-bold text-slate-600">Vendor / payee<input name="vendor_name" minLength={2} required className="rounded-xl border border-slate-200 p-3 text-sm"/></label>
     <label className="col-span-2 grid gap-1 text-xs font-bold text-slate-600">Invoice / receipt reference<input name="document_reference" minLength={3} required className="rounded-xl border border-slate-200 p-3 text-sm"/></label>
     <label className="col-span-2 grid gap-1 text-xs font-bold text-slate-600">Original invoice or receipt — JPEG / PNG / PDF, max 5MB<input name="receipt_file" type="file" accept="image/jpeg,image/png,application/pdf" required className="rounded-xl border border-dashed border-teal-200 bg-teal-50 p-3 text-xs"/></label>
     <label className="grid gap-1 text-xs font-bold text-slate-600">Community<select name="community_id" className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Company shared</option>{(await user.supabase.from('communities').select('id,name').order('name')).data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label className="grid gap-1 text-xs font-bold text-slate-600">Campaign code<input name="campaign_code" placeholder="Optional: AMT-01" className="w-full rounded-xl border border-slate-200 p-3 text-sm"/></label>
     <button className="col-span-2 rounded-xl bg-[#0c7772] px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-950/10 hover:bg-[#095f5b]">Submit expense for approval →</button>
     <p className="col-span-2 text-xs leading-5 text-slate-500">Procurement is not an operating expense category. Invoice reference is metadata, not proof of a verified invoice. Receipt bytes are hashed and privately stored; an approver must independently inspect evidence. Procurement matching is a later release gate.</p>
    </form>
   </Card>
   <Card>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">Expense approvals</h2><p className="text-xs text-slate-500">No self-approval. Rejections require a reason.</p></div><span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{drafts.length} waiting</span></div>
    {drafts.length?<div className="mt-4 space-y-3">{drafts.map(e=><div key={e.id} className="rounded-2xl border border-slate-200 p-4">
     <div className="flex flex-wrap items-center justify-between gap-2"><b>{e.vendor_name}</b><span className="font-black">{bd(e.amount)}</span></div>
     <p className="mt-1 text-sm text-slate-600">{e.description}</p><p className="mt-1 text-xs text-slate-400">{e.document_reference} · {e.incurred_on} · {labelFor(e.category)}</p>
     {evidenceLinks.has(e.id)&&<a href={evidenceLinks.get(e.id)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-teal-700 underline">View private receipt ↗</a>}
     {!demo&&<form action={reviewFinanceExpense} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="expense_id" value={e.id}/><input name="note" aria-label="Review note" placeholder="Decision note" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs"/><button name="decision" value="approve" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Approve & post</button><button name="decision" value="reject" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">Reject</button></form>}
    </div>)}</div>:<div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm text-slate-500">No expenses waiting for approval in this period.</div>}
    <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Checker verification posts: <b>Dr operating expense / Cr payable</b>. No cash is presumed until verified settlement.</div>
   </Card>
  </section>
  <Card>
   <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">Expense and settlement control</h2><p className="text-xs text-slate-500">Trace vendor → invoice → approval → journal → payment</p></div><span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{rows.length} entries</span></div>
   <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[770px] text-left text-xs">
    <thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-400"><th className="py-3">Incurred</th><th>Payee / document</th><th>Category</th><th className="text-right">Amount</th><th>Status</th><th className="pl-3">Next action</th></tr></thead>
    <tbody>{rows.map(e=><tr key={e.id} className="border-b border-slate-100 align-top last:border-0">
      <td className="py-4 text-slate-500">{e.incurred_on}</td><td className="py-4"><b>{e.vendor_name}</b><p className="mt-1 max-w-48 truncate text-slate-400">{e.document_reference}</p>{evidenceLinks.has(e.id)&&<a href={evidenceLinks.get(e.id)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-teal-700 underline">Receipt ↗</a>}</td><td className="py-4 text-slate-600">{labelFor(e.category)}</td><td className="py-4 text-right font-black">{bd(e.amount)}</td><td className="py-4">{pill(e.status)}</td><td className="py-3 pl-3">
        {e.status==='posted'&&!demo?<form action={requestFinanceSettlement} className="flex flex-wrap gap-1.5">
         <input type="hidden" name="expense_id" value={e.id}/>
         <select name="payment_method" className="rounded border border-slate-200 p-1.5"><option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile">Mobile</option></select>
         <input name="payment_reference" minLength={4} required placeholder="Transfer reference" className="w-28 rounded border border-slate-200 p-1.5"/>
         <input name="payment_date" type="date" required defaultValue={new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})} className="rounded border border-slate-200 p-1.5"/>
         <input name="payment_proof" type="file" accept="image/jpeg,image/png,application/pdf" required aria-label="Payment proof" className="w-40 rounded border border-slate-200 p-1.5"/>
         <button className="rounded bg-slate-900 px-2 py-1.5 font-bold text-white">Request verify</button></form>:null}
        {e.status==='settlement_requested'&&e.settlement_id&&!demo?<form action={reviewFinanceSettlement} className="flex flex-wrap gap-1.5"><input type="hidden" name="settlement_id" value={e.settlement_id}/>{evidenceLinks.has('settlement:'+e.id)&&<a href={evidenceLinks.get('settlement:'+e.id)} target="_blank" rel="noopener noreferrer" className="self-center text-xs font-bold text-teal-700 underline">Proof ↗</a>}<input name="note" aria-label="Payment verification note" placeholder="Verification note" className="w-28 rounded border border-slate-200 p-1.5"/><button name="decision" value="approve" className="rounded bg-emerald-600 px-2 py-1.5 font-bold text-white">Verify</button><button name="decision" value="reject" className="rounded bg-red-50 px-2 py-1.5 font-bold text-red-700">Reject</button></form>:null}
        {(demo||e.status==='settled'||e.status==='rejected'||e.status==='submitted')&&<span className="text-slate-400">{demo?'Demo only':e.status==='submitted'?'Awaiting approval':'—'}</span>}
       </td>
     </tr>)}</tbody>
   </table>{!rows.length&&<p className="p-5 text-sm text-slate-500">No recorded expenses for this month.</p>}</div>
  </Card>
  <Card>
   <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-black">General ledger explorer</h2><p className="text-xs text-slate-500">Double-entry transactions · reviewer traceable · no direct edit</p></div><span className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">Journal source of truth</span></div>
   <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-xs"><thead><tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400"><th className="py-3">Date</th><th>Journal</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead><tbody>{ledger.map((line,i)=><tr key={line.event_key+line.account_code+i} className="border-b border-slate-100"><td className="py-3 text-slate-500">{line.posting_date}</td><td className="max-w-40 truncate py-3" title={line.event_key}>{line.memo}</td><td className="py-3">{line.account_code} · {line.account_title}</td><td className="py-3 text-right font-semibold">{num(line.debit)?bd(line.debit):'—'}</td><td className="py-3 text-right font-semibold">{num(line.credit)?bd(line.credit):'—'}</td></tr>)}</tbody></table>{!ledger.length&&<p className="p-5 text-sm text-slate-500">No posted journals this period.</p>}</div>
  </Card>
  <div className="rounded-[22px] border border-sky-200 bg-sky-50 p-5"><h2 className="font-black text-sky-950">Financial assurance and release gates</h2><p className="mt-2 text-sm leading-6 text-slate-700">Expenses and verified disbursements are separate from order GMV. Procurement invoices, inventory COGS, customer settlements, bank statements, tax, refunds, allocation policy, audit evidence, and month-close must be reconciled before a company net-profit value is certified. The current finance foundation does not claim these later gates are complete.</p></div>
 </div></SuperAdminShell>
}
