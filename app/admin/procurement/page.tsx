import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import {
 procurementCreatePO,procurementReviewPO,procurementLinkDispatch,
 procurementSubmitBill,procurementReviewBill,procurementRequestPayment,
 procurementPostCommunityCash
} from '@/app/actions/procurement'

export const dynamic='force-dynamic'
type Quote={id:string;product_name:string;supplier_name:string;pool_title:string;quantity:number;unit_cost:number;expiry:string|null;pool_status:string}
type PO={id:string;code:string;supplier_id:string;supplier:string;product_id:string;product:string;quantity:number;unit_cost:number;value:number;received_quantity:number;status:string;created_by:string}
type Dispatch={id:string;code:string;supplier_id:string;status:string;product_ids:string[]}
type Bill={id:string;po_id:string;ref:string;vendor:string;quantity:number;amount:number;status:string;submitted_by:string}
type Account={id:string;name:string;kind:string}
type Receipt={day_id:string;date:string;community:string;product_cash:number;delivery_cash:number}
type Data={selected_quotes:Quote[];purchase_orders:PO[];dispatches:Dispatch[];bills:Bill[];liquid_accounts:Account[];cash_receipts_pending:Receipt[]}
const style='min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
const taka=(value:number)=>'৳'+Number(value||0).toLocaleString('en-BD',{maximumFractionDigits:2,minimumFractionDigits:2})
const demo:Data={
 selected_quotes:[{id:'synthetic-quote',product_name:'5 L Cooking Oil',supplier_name:'Sample Oil Supplier',pool_title:'AMT-01 Oct Pool',quantity:100,unit_cost:950,expiry:'2026-10-25',pool_status:'ordered'}],
 purchase_orders:[{id:'synthetic-po',code:'PO-SAMPLE-01',supplier_id:'synthetic-supplier',supplier:'Sample Oil Supplier',product_id:'synthetic-product',product:'Cooking Oil 5L',quantity:100,unit_cost:950,value:95000,received_quantity:95,status:'approved',created_by:'synthetic-user'}],
 dispatches:[{id:'synthetic-dispatch',code:'DSP-SAMPLE-01',supplier_id:'synthetic-supplier',status:'verified',product_ids:['synthetic-product']}],
 bills:[{id:'synthetic-bill',po_id:'synthetic-po',ref:'INV-SAMPLE-001',vendor:'Sample Oil Supplier',quantity:95,amount:90250,status:'posted',submitted_by:'synthetic-user'}],
 liquid_accounts:[{id:'synthetic-bank',name:'Operating Bank A',kind:'bank'},{id:'synthetic-cash',name:'AMT-01 Custody Cash',kind:'cash'}],
 cash_receipts_pending:[{day_id:'synthetic-day',date:'2026-10-09',community:'AMT-01',product_cash:16000,delivery_cash:360}]
}
function Panel({heading,detail,children}:{heading:string;detail:string;children:React.ReactNode}){
 return <section className="finance-panel rounded-[23px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">{heading}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p><div className="mt-4">{children}</div></section>
}
export default async function ProcurementControl({searchParams}:{searchParams:Promise<{demo?:string;error?:string;notice?:string}>}){
 const {supabase}=await requireAdmin()
 const q=await searchParams,demoMode=q.demo==='1'
 const isolated=process.env.VERCEL_ENV==='preview'&&process.env.FINANCE_WRITES_ENABLED==='true'&&
  Boolean(process.env.FINANCE_PREVIEW_SUPABASE_URL)&&
  process.env.NEXT_PUBLIC_SUPABASE_URL===process.env.FINANCE_PREVIEW_SUPABASE_URL&&
  !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('sukabonfjcnaavjgjyuy')
 const {data,error}=demoMode?{data:demo,error:null}:await supabase.rpc('procurement_workbench')
 const d=(data??{selected_quotes:[],purchase_orders:[],dispatches:[],bills:[],liquid_accounts:[],cash_receipts_pending:[]}) as Data
 const quote=d.selected_quotes??[],po=d.purchase_orders??[],dispatch=d.dispatches??[],bills=d.bills??[],accounts=d.liquid_accounts??[],cash=d.cash_receipts_pending??[]
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})
 return <AdminShell><div className="finance-ops-surface grid min-w-0 gap-4">
  <section className="finance-ops-hero rounded-[27px] bg-[linear-gradient(125deg,#062c41_0%,#0b5b5d_52%,#16a085_100%)] p-6 text-white shadow-lg">
   <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">SUPPLIER COST · PHYSICAL STOCK · ACCOUNTING</p>
   <h1 className="mt-2 text-3xl font-black tracking-tight">Procurement & reconciliation</h1>
   <p className="mt-2 max-w-xl text-sm text-teal-100">One controlled trail: negotiated supplier quote → approved purchase order → verified handover → invoice match → Treasury bank settlement.</p>
   <div className="mt-4 flex flex-wrap gap-2"><Link href="/super-admin/treasury?demo=1" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold">Treasury command center ↗</Link><Link href="/super-admin/finance?demo=1" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold">Finance intelligence ↗</Link><Link href="/admin/procurement?demo=1" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-teal-800">Synthetic walkthrough</Link></div>
  </section>
  {q.error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{q.error}</div>}
  {q.notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{q.notice}</div>}
  {demoMode&&<div className="rounded-xl bg-violet-50 p-3 text-xs font-bold text-violet-800">Illustrative synthetic values. These do not represent a real order, supplier payment or supplier price.</div>}
  {(error||!isolated)&&<div className="finance-gate-notice rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
    <b>Controlled Preview:</b> Supplier finance writes remain locked until an isolated approved Supabase Preview database is connected. Customer Production transactions remain untouched.
   </div>}
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   {[
    ['Quotes awaiting PO',quote.length],['Pending PO approval',po.filter(x=>x.status==='submitted').length],
    ['Invoices for approval',bills.filter(x=>x.status==='submitted').length],
    ['Accepted cash not journalled',cash.length]
   ].map(([name,count])=><div className="finance-panel rounded-2xl border border-slate-200 bg-white p-4" key={String(name)}><p className="text-[10px] font-black uppercase text-slate-500">{name}</p><p className="mt-2 text-3xl font-black text-teal-800">{count}</p></div>)}
  </div>
  <div className="grid gap-4 xl:grid-cols-2">
   <Panel heading="1 · Generate purchase order" detail="Selected, in-date final quote and frozen Pool quantity are required. Owner must independently approve.">
    <form action={procurementCreatePO} className="grid gap-2">
     <label className="text-xs font-bold">Final supplier quotation<select className={style} name="quote_id" required><option value="">Choose selected quote</option>{quote.map(x=><option key={x.id} value={x.id}>{x.supplier_name} · {x.product_name} · {x.quantity} units · {taka(x.unit_cost)}</option>)}</select></label>
     <label className="text-xs font-bold">Buying purpose<input name="note" className={style} placeholder="Supplier terms, delivery plan and approved price"/></label>
     <button disabled={!isolated||demoMode||!quote.length} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">Submit PO for approval</button>
    </form>
   </Panel>
   <Panel heading="2 · Independent PO review" detail="Prevent self-approval and recheck supplier, quotation, agreed price and quantity before commitment.">
    <div className="space-y-3">{po.filter(x=>x.status==='submitted').map(x=><form key={x.id} action={procurementReviewPO} className="rounded-xl border border-slate-200 p-3">
      <input type="hidden" name="po_id" value={x.id}/><p className="text-sm font-black">{x.code} · {x.supplier}</p><p className="text-xs text-slate-500">{x.quantity} × {taka(x.unit_cost)} = {taka(x.value)}</p>
      <input name="note" className={style+' mt-2'} placeholder="Independent approval or rejection reason"/>
      <div className="mt-2 flex flex-wrap gap-2"><button disabled={!isolated||demoMode} name="decision" value="approve" className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Approve PO</button><button disabled={!isolated||demoMode} name="decision" value="reject" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Reject</button></div>
     </form>)}{!po.some(x=>x.status==='submitted')&&<p className="text-sm text-slate-500">No PO awaits approval.</p>}</div>
   </Panel>
   <Panel heading="3 · Link supplier dispatch" detail="Bind a supplier dispatch to the approved purchase order. Only independently verified accepted goods become invoice-eligible.">
    <form action={procurementLinkDispatch} className="grid gap-2">
     <label className="text-xs font-bold">Approved PO<select className={style} name="po_id" required><option value="">Choose PO</option>{po.filter(x=>x.status==='approved').map(x=><option key={x.id} value={x.id}>{x.code} · {x.product}</option>)}</select></label>
     <label className="text-xs font-bold">Physical dispatch<select className={style} name="dispatch_id" required><option value="">Choose supplier batch</option>{dispatch.map(x=><option key={x.id} value={x.id}>{x.code} · {x.status}</option>)}</select></label>
     <button disabled={!isolated||demoMode} className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">Link PO to dispatch</button>
    </form>
   </Panel>
   <Panel heading="4 · Submit supplier invoice" detail="Matching requires verified accepted quantities, exact approved unit price and authentic private PDF/JPEG/PNG evidence.">
    <form action={procurementSubmitBill} className="grid gap-2" encType="multipart/form-data">
     <label className="text-xs font-bold">Approved PO<select name="po_id" className={style} required><option value="">Choose PO</option>{po.filter(x=>x.status==='approved').map(x=><option key={x.id} value={x.id}>{x.code} · accepted {x.received_quantity}/{x.quantity} · {taka(x.unit_cost)}</option>)}</select></label>
     <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Billed qty<input name="quantity" type="number" min="1" required className={style}/></label><label className="text-xs font-bold">Unit landed price<input name="unit_price" type="number" min=".01" step=".01" required className={style}/></label></div>
     <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Invoice number<input name="invoice_reference" required minLength={4} className={style}/></label><label className="text-xs font-bold">Invoice date<input name="invoice_date" type="date" defaultValue={today} required className={style}/></label></div>
     <label className="text-xs font-bold">Supplier invoice proof<input name="invoice_file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required className={style}/></label>
     <button disabled={!isolated||demoMode} className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">Submit for three-way verification</button>
    </form>
   </Panel>
   <Panel heading="5 · Post matched supplier payable" detail="Independent owner review creates Dr Inventory and Cr Supplier Payable only after PO, dispatch receipt and invoice match.">
    <div className="grid gap-2">{bills.filter(x=>x.status==='submitted').map(x=><form key={x.id} action={procurementReviewBill} className="rounded-xl border border-slate-200 p-3">
      <input type="hidden" name="bill_id" value={x.id}/><p className="text-sm font-black">{x.ref} · {x.vendor}</p><p className="text-xs text-slate-500">{x.quantity} received units · {taka(x.amount)}</p>
      <input name="note" placeholder="Three-way match review / variance reason" className={style+' mt-2'}/>
      <div className="mt-2 flex gap-2"><button disabled={!isolated||demoMode} name="decision" value="approve" className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Match & post payable</button><button disabled={!isolated||demoMode} name="decision" value="reject" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Reject</button></div>
     </form>)}{!bills.some(x=>x.status==='submitted')&&<p className="text-sm text-slate-500">No outstanding invoices awaiting matching.</p>}</div>
   </Panel>
   <Panel heading="6 · Request supplier bank settlement" detail="Approving this Treasury request debits supplier payable and credits the actual bank account. Independent statement matching follows.">
    <form action={procurementRequestPayment} className="grid gap-2">
     <label className="text-xs font-bold">Matched unpaid supplier invoice<select name="bill_id" className={style} required><option value="">Choose posted invoice</option>{bills.filter(x=>x.status==='posted').map(x=><option key={x.id} value={x.id}>{x.vendor} · {x.ref} · {taka(x.amount)}</option>)}</select></label>
     <label className="text-xs font-bold">Pay from account<select name="account_id" className={style} required><option value="">Choose liquid account</option>{accounts.map(x=><option key={x.id} value={x.id}>{x.name} · {x.kind}</option>)}</select></label>
     <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Payment date<input name="payment_date" type="date" className={style} defaultValue={today} required/></label><label className="text-xs font-bold">Bank reference<input name="external_reference" minLength={4} className={style} required/></label></div>
     <button disabled={!isolated||demoMode} className="rounded-xl bg-teal-700 px-3 py-2.5 text-sm font-black text-white disabled:opacity-40">Request independent Treasury settlement</button>
    </form>
   </Panel>
  </div>
  <Panel heading="7 · Record independently accepted Community COD" detail="Only a closed, exception-free Community Ops cash handover can be recorded; product COD and home-delivery fees remain separately classified as unapplied collections.">
   <div className="grid gap-2 sm:grid-cols-2">{cash.map(x=><form key={x.day_id} action={procurementPostCommunityCash} className="grid gap-2 rounded-xl border border-teal-100 bg-teal-50/50 p-3">
    <input type="hidden" name="day_id" value={x.day_id}/><b className="text-sm">{x.community} · {x.date}</b>
    <p className="text-xs text-slate-600">Product cash {taka(x.product_cash)} · Delivery cash {taka(x.delivery_cash)}</p>
    <label className="text-xs font-bold">Physical cash custody account<select name="cash_account_id" required className={style}><option value="">Select Community cash</option>{accounts.filter(a=>a.kind==='cash').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="text-xs font-bold">Signed custody reference<input name="cash_custody_reference" minLength={4} required className={style}/></label>
    <button disabled={!isolated||demoMode} className="rounded-xl bg-teal-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">Post accepted cash to Treasury</button>
   </form>)}{!cash.length&&<p className="text-sm text-slate-500">No accepted Community cash handovers are awaiting a ledger entry.</p>}</div>
  </Panel>
  <Panel heading="Immutable procurement audit trail" detail="Purchase orders and supplier bills remain linked to their source document, physical dispatch, approved finance journal and Treasury payment.">
   <div className="overflow-x-auto"><table className="w-full min-w-[610px] text-left text-xs"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3">PO</th><th>Supplier/product</th><th>Goods accepted</th><th>Cost</th><th>Status</th></tr></thead><tbody>{po.map(x=><tr key={x.id} className="border-b border-slate-100"><td className="py-3 font-black">{x.code}</td><td>{x.supplier} · {x.product}</td><td>{x.received_quantity} / {x.quantity}</td><td className="font-bold">{taka(x.value)}</td><td><span className={'rounded-lg px-2 py-1 font-black '+(x.status==='approved'?'bg-teal-50 text-teal-700':'bg-amber-50 text-amber-700')}>{x.status}</span></td></tr>)}</tbody></table>{!po.length&&<p className="p-5 text-center text-slate-500">No purchase orders created.</p>}</div>
  </Panel>
 </div></AdminShell>
}
