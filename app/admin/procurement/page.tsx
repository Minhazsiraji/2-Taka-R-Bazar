import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import {
 procurementCreatePO,procurementReviewPO,procurementLinkDispatch,
 procurementSubmitBill,procurementReviewBill,procurementRequestPayment,
 procurementPostCommunityCash,procurementAttachDocument
} from '@/app/actions/procurement'

export const dynamic='force-dynamic'
type Quote={id:string;product_name:string;supplier_name:string;pool_title:string;quantity:number;unit_cost:number;expiry:string|null;pool_status:string}
type PO={id:string;code:string;supplier_id:string;supplier:string;product_id:string;product:string;quantity:number;unit_cost:number;value:number;received_quantity:number;status:string;created_by:string}
type Dispatch={id:string;code:string;supplier_id:string;status:string;product_ids:string[]}
type Bill={id:string;po_id:string;ref:string;vendor:string;quantity:number;amount:number;status:string;submitted_by:string;evidence_path?:string}
type Account={id:string;name:string;kind:string}
type Receipt={day_id:string;date:string;community:string;product_cash:number;delivery_cash:number}
type Data={selected_quotes:Quote[];purchase_orders:PO[];dispatches:Dispatch[];bills:Bill[];liquid_accounts:Account[];cash_receipts_pending:Receipt[]}
const style='min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
const taka=(value:number)=>'৳'+Number(value||0).toLocaleString('en-BD',{maximumFractionDigits:2,minimumFractionDigits:2})
const demo:Data={
 selected_quotes:[
  {id:'syn-quote-sugar',product_name:'Sugar 1 kg',supplier_name:'Sample Essential Foods',pool_title:'AMT-01 October grocery pool',quantity:50,unit_cost:130,expiry:'2026-10-25',pool_status:'ordered'},
  {id:'syn-quote-noodles',product_name:'Noodles 8-pack',supplier_name:'Example FMCG Distributor',pool_title:'Savar DOHS October pool',quantity:120,unit_cost:72,expiry:'2026-10-23',pool_status:'ordered'}
 ],
 purchase_orders:[
  {id:'syn-po-oil',code:'SYN-PO-OIL-001',supplier_id:'syn-supplier-oil',supplier:'Sample Oil Supplier',product_id:'syn-product-oil',product:'Cooking Oil 5 L',quantity:100,unit_cost:950,value:95000,received_quantity:95,status:'approved',created_by:'synthetic-maker'},
  {id:'syn-po-rice',code:'SYN-PO-RICE-002',supplier_id:'syn-supplier-rice',supplier:'Sample Rice Mill',product_id:'syn-product-rice',product:'Miniket Rice 10 kg',quantity:80,unit_cost:1120,value:89600,received_quantity:0,status:'submitted',created_by:'synthetic-maker'},
  {id:'syn-po-flour',code:'SYN-PO-FLOUR-003',supplier_id:'syn-supplier-flour',supplier:'Example Flour Trading',product_id:'syn-product-flour',product:'Atta 1 kg',quantity:60,unit_cost:55,value:3300,received_quantity:60,status:'approved',created_by:'synthetic-maker'}
 ],
 dispatches:[
  {id:'syn-dispatch-oil',code:'SYN-DSP-OIL-001',supplier_id:'syn-supplier-oil',status:'verified',product_ids:['syn-product-oil']},
  {id:'syn-dispatch-flour',code:'SYN-DSP-FLOUR-002',supplier_id:'syn-supplier-flour',status:'verified',product_ids:['syn-product-flour']}
 ],
 bills:[
  {id:'syn-bill-oil-a',po_id:'syn-po-oil',ref:'SYN-INV-OIL-70',vendor:'Sample Oil Supplier',quantity:70,amount:66500,status:'settled',submitted_by:'synthetic-maker'},
  {id:'syn-bill-oil-b',po_id:'syn-po-oil',ref:'SYN-INV-OIL-25',vendor:'Sample Oil Supplier',quantity:25,amount:23750,status:'posted',submitted_by:'synthetic-maker'},
  {id:'syn-bill-flour',po_id:'syn-po-flour',ref:'SYN-INV-FLOUR-60',vendor:'Example Flour Trading',quantity:60,amount:3300,status:'submitted',submitted_by:'synthetic-maker'}
 ],
 liquid_accounts:[
  {id:'demo-a',name:'Operating Bank A · 1234',kind:'bank'},
  {id:'demo-b',name:'Procurement Bank B · 5678',kind:'bank'},
  {id:'demo-cash',name:'Community custody cash · AMT-01',kind:'cash'}
 ],
 cash_receipts_pending:[
  {day_id:'syn-cod-amt',date:'2026-10-08',community:'Amin Model Town (AMT-01)',product_cash:16000,delivery_cash:360},
  {day_id:'syn-cod-dohs',date:'2026-10-09',community:'Savar DOHS',product_cash:9500,delivery_cash:140}
 ]
}
function Panel({heading,detail,children}:{heading:string;detail:string;children:React.ReactNode}){
 return <section className="finance-panel rounded-[23px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">{heading}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p><div className="mt-4">{children}</div></section>
}
export default async function ProcurementControl({searchParams}:{searchParams:Promise<{demo?:string;error?:string;notice?:string}>}){
 const {supabase}=await requireAdmin()
 const q=await searchParams,demoMode=q.demo==='1'||(process.env.VERCEL_ENV==='preview'&&!(process.env.FINANCE_WRITES_ENABLED==='true'&&process.env.FINANCE_PREVIEW_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_URL===process.env.FINANCE_PREVIEW_SUPABASE_URL)&&q.demo!=='0')
 const isolated=process.env.VERCEL_ENV==='preview'&&process.env.FINANCE_WRITES_ENABLED==='true'&&
  Boolean(process.env.FINANCE_PREVIEW_SUPABASE_URL)&&
  process.env.NEXT_PUBLIC_SUPABASE_URL===process.env.FINANCE_PREVIEW_SUPABASE_URL&&
  (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('sukabonfjcnaavjgjyuy')||process.env.FINANCE_SHARED_DB_UAT_ENABLED==='true')
 const {data,error}=demoMode?{data:demo,error:null}:await supabase.rpc('procurement_workbench')
 const {data:attachmentData}=demoMode?{data:[]}:await supabase.rpc('finance_document_attachment_index')
 const attachments=(Array.isArray(attachmentData)?attachmentData:[]) as Array<{id:string;entity_type:string;entity_id:string;kind:string;name:string;uploaded_at:string}>
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
  {demoMode&&<div className="rounded-xl bg-violet-50 p-3 text-xs font-bold text-violet-800">SYNTHETIC SCENARIO · AMT-01 and Savar DOHS pools: example quotes, purchase orders, dispatches, supplier invoices, and COD cash awaiting custody posting. Demo actions are disabled; real data is not modified.</div>}
  {demoMode&&<nav aria-label="Synthetic scenario sections" className="finance-glass-gate flex flex-wrap gap-2 rounded-xl p-3 text-xs font-black"><span className="mr-2 text-teal-900">AMT-01 · Connected demo</span><Link href="/super-admin/finance?demo=1" className="rounded-lg border border-teal-200 px-3 py-2 text-teal-800">Finance expenses →</Link><Link href="/super-admin/treasury?demo=1" className="rounded-lg border border-teal-200 px-3 py-2 text-teal-800">Treasury balances →</Link></nav>}
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
  <Panel heading="Document center · generate, save, print or use manual proof" detail="Generate print-ready purchase orders and internal supplier bill copies. Print to PDF or download an HTML copy. Original supplier invoices remain independent evidence and must be uploaded before approval. If generation is unavailable, use a signed manual PO and upload the supplier-issued PDF/JPEG/PNG invoice in step 4; do not bypass approval or invoice checks.">
   <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">The generated supplier bill is an internal register, not a supplier-issued VAT/tax invoice. Keep the real supplier document and authorized approval record. Demo records do not create genuine evidence.</p>
   <div className="grid gap-2 sm:grid-cols-2">
    {po.map(x=><div key={x.id} className="rounded-xl border border-slate-200 p-3 text-xs"><b>{x.code} · {x.supplier}</b><p className="mt-1 text-slate-600">{x.product} · {taka(x.value)}</p>
     <div className="mt-2 flex flex-wrap gap-3">{!demoMode&&<><a className="font-bold text-teal-800 underline" target="_blank" rel="noopener noreferrer" href={`/api/finance/documents/po/${x.id}`}>View / print PO</a><a className="font-bold text-teal-800 underline" href={`/api/finance/documents/po/${x.id}?download=1`}>Download PO</a></>}{demoMode&&<span className="text-violet-700">Synthetic PO · no evidentiary document</span>}</div>
    </div>)}
    {bills.map(x=><div key={x.id} className="rounded-xl border border-slate-200 p-3 text-xs"><b>{x.ref} · {x.vendor}</b><p className="mt-1 text-slate-600">{taka(x.amount)} · {x.status}</p>
     <div className="mt-2 flex flex-wrap gap-3">{!demoMode&&<><a className="font-bold text-teal-800 underline" target="_blank" rel="noopener noreferrer" href={`/api/finance/documents/bill/${x.id}`}>Print register</a><a className="font-bold text-teal-800 underline" href={`/api/finance/documents/bill/${x.id}?download=1`}>Download register</a><a className="font-bold text-teal-800 underline" href={`/api/finance/documents/proof/${x.id}`}>Download original proof</a></>}{demoMode&&<span className="text-violet-700">Synthetic invoice · no real supplier file</span>}</div>
    </div>)}
   </div>
   <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/30 p-3">
    <p className="mb-2 text-sm font-black text-teal-900">Attach signed manual documents / generated PDF evidence</p>
    <form action={procurementAttachDocument} className="grid gap-2" encType="multipart/form-data">
     <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-bold">Record type<select name="entity_type" className={style} required><option value="po">Purchase order</option><option value="bill">Supplier bill</option></select></label>
      <label className="text-xs font-bold">Evidence category<select name="document_kind" className={style} required><option value="signed_po">Signed purchase order</option><option value="supplier_invoice">Supplier invoice</option><option value="goods_receipt">Goods received proof</option><option value="delivery_note">Supplier delivery note</option><option value="other">Other linked proof</option></select></label>
     </div>
     <label className="text-xs font-bold">Select record (copy UUID from its displayed identifier list)<select name="entity_id" className={style} required><option value="">Choose PO or bill</option>{po.map(x=><option key={x.id} value={x.id}>PO · {x.code} · {x.supplier}</option>)}{bills.map(x=><option key={x.id} value={x.id}>BILL · {x.ref} · {x.vendor}</option>)}</select></label>
     <label className="text-xs font-bold">Document description<input className={style} name="display_name" minLength={3} maxLength={140} required placeholder="Signed PO, receipt no. 123, original paper scan"/></label>
     <label className="text-xs font-bold">Upload PDF, JPG or PNG (up to 1.5 MB)<input className={style} name="document_file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required/></label>
     <button disabled={demoMode||!isolated} className="rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Save immutable evidence to record</button>
    </form>
    <div className="mt-3 space-y-1">{attachments.map(a=><div key={a.id} className="flex flex-wrap justify-between gap-2 border-t border-teal-100 py-2 text-xs"><span>{a.name} · {a.kind} · {a.entity_type} · {a.uploaded_at?.slice(0,10)}</span><a className="font-black text-teal-800 underline" href={`/api/finance/attachments/${a.id}`}>Download original</a></div>)}{!attachments.length&&<p className="text-xs text-slate-600">No additional signed documents attached.</p>}</div>
   </div>
   <p className="mt-3 text-xs text-slate-600">Manual fallback: prepare and sign documents offline; attach original supplier invoice as PDF/JPEG/PNG in step 4. For any additional manual PO or custody evidence, keep the signed original under controlled records until a dedicated linked upload register is available. No manual document may substitute for verified payment or physical receipt.</p>
  </Panel>
  <Panel heading="Immutable procurement audit trail" detail="Purchase orders and supplier bills remain linked to their source document, physical dispatch, approved finance journal and Treasury payment.">
   <div className="overflow-x-auto"><table className="w-full min-w-[610px] text-left text-xs"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3">PO</th><th>Supplier/product</th><th>Goods accepted</th><th>Cost</th><th>Status</th></tr></thead><tbody>{po.map(x=><tr key={x.id} className="border-b border-slate-100"><td className="py-3 font-black">{x.code}</td><td>{x.supplier} · {x.product}</td><td>{x.received_quantity} / {x.quantity}</td><td className="font-bold">{taka(x.value)}</td><td><span className={'rounded-lg px-2 py-1 font-black '+(x.status==='approved'?'bg-teal-50 text-teal-700':'bg-amber-50 text-amber-700')}>{x.status}</span></td></tr>)}</tbody></table>{!po.length&&<p className="p-5 text-center text-slate-500">No purchase orders created.</p>}</div>
  </Panel>
 </div></AdminShell>
}
