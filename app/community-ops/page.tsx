import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { requirePickupOperator } from '@/lib/auth'
import { taka } from '@/lib/format'
import {
  startCommunityOpsDay,refreshCommunityOpsManifest,recordCommunityInbound,recordCommunityStockAdjustment,verifyCommunityOrder,
  completeCommunityOrder,recordCommunityOrderException,submitCommunityOpsReport,submitCommunityCashHandover,
} from '@/app/actions/community-ops'

export const dynamic='force-dynamic'

const exceptionOptions=[
  ['customer_unavailable','Customer unavailable'],['customer_refused','Customer refused'],['damaged_goods','Damaged goods'],
  ['short_goods','Short goods'],['partial_delivery','Partial delivery'],['wrong_item','Wrong item'],['payment_issue','Payment issue'],
  ['address_issue','Address issue'],['return_requested','Return requested'],['cash_variance','Cash variance'],
  ['cancelled','Cancelled'],['other_exception','Other exception'],
]

export default async function CommunityOpsPage({searchParams}:{searchParams:Promise<{day?:string;error?:string;notice?:string}>}){
  const {roles,supabase}=await requirePickupOperator();const sp=await searchParams
  const [{data:assignments},{data:days}]=await Promise.all([
    supabase.rpc('get_my_community_ops_assignments'),
    supabase.rpc('get_my_community_ops_days'),
  ])
  let detail:any=null
  if(sp.day){const {data}=await supabase.rpc('get_community_ops_day',{p_day_id:sp.day});detail=data}
  const d=detail?.day,summary=detail?.summary??{},products=detail?.products??[],orders=detail?.orders??[],inbound=detail?.inbound??[],stockAdjustments=detail?.stock_adjustments??[],handover=detail?.cash_handover

  return <AppShell roles={roles}><div className="grid gap-5">
    <section><div className="card-title">Community Operations Officer</div><h1 className="text-3xl font-black">Community fulfilment & reconciliation</h1><p className="muted mt-1">Receive goods, verify customer orders, hand over or deliver, keep Product COD and Home Delivery cash separate, record exceptions, and close only after Admin/Accounts accepts the cash.</p></section>
    <Flash error={sp.error} notice={sp.notice}/>

    {!detail&&<>
      <section className="card grid gap-3">
        <h2 className="section-title">Open community day</h2>
        <form action={startCommunityOpsDay} className="grid gap-3 sm:grid-cols-[1fr_190px_auto] sm:items-end">
          <label><span className="label">Community</span><select className="input" name="community_id" required><option value="">Choose community</option>{(assignments??[]).map((a:any)=><option value={a.community_id} key={a.community_id}>{a.community_name}</option>)}</select></label>
          <label><span className="label">Business date</span><input className="input" type="date" name="business_date"/></label>
          <SubmitButton>Open community day</SubmitButton>
        </form>
      </section>
      <section><h2 className="section-title mb-3">Recent days</h2><div className="grid gap-3 sm:grid-cols-2">{(days??[]).map((x:any)=><Link className="card" href={'/community-ops?day='+encodeURIComponent(x.day_id)} key={x.day_id}><div className="flex justify-between gap-3"><div><b>{x.community_name}</b><div className="muted text-sm">{String(x.business_date)}</div></div><span className="chip capitalize">{String(x.status).replaceAll('_',' ')}</span></div></Link>)}</div></section>
    </>}

    {detail&&<>
      <section className="card">
        <div className="flex flex-wrap justify-between gap-3"><div><Link className="text-sm font-black text-cyan-700" href="/community-ops">← All days</Link><h2 className="mt-2 text-2xl font-black">{d.community_name}</h2><p className="muted">{d.business_date}</p></div><span className="chip capitalize">{String(d.status).replaceAll('_',' ')}</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Orders</div><b className="text-xl">{summary.orders??0}</b><div className="muted text-xs">{summary.completed_orders??0} complete · {summary.exception_orders??0} exception</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Product COD</div><b className="text-xl">{taka(Number(summary.product_cod_collected??0))}</b><div className="muted text-xs">Expected {taka(Number(summary.expected_product_cod??0))}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Delivery fees</div><b className="text-xl">{taka(Number(summary.delivery_fees_collected??0))}</b><div className="muted text-xs">Expected {taka(Number(summary.expected_delivery_fees??0))}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Ready unresolved</div><b className="text-xl">{summary.pending_orders??0}</b><div className="muted text-xs">{summary.pickup_orders??0} pickup · {summary.home_delivery_orders??0} home</div></div>
        </div>
        {d.status==='open'&&<form action={refreshCommunityOpsManifest} className="mt-4"><input type="hidden" name="day_id" value={d.id}/><SubmitButton className="btn-secondary">Refresh manifest</SubmitButton></form>}
      </section>

      <section className="grid gap-3">
        <div><div className="card-title">Product requirement & inbound</div><h2 className="section-title">Receive and reconcile products</h2><p className="muted text-sm">Any net quantity variance requires a reason.</p></div>
        {products.map((p:any)=><article className="card" key={p.product_id}>
          <div className="flex justify-between gap-3"><div><h3 className="font-black">{p.product_name}</h3><p className="muted text-sm">{p.package_size}</p></div><div className="text-right text-sm"><div>Required <b>{p.required_quantity}</b></div><div>Net inbound <b>{p.inbound_received}</b></div><div>Stock accounted <b>{p.stock_accounted??0}</b></div><div className={Number(p.stock_variance)===0?'text-emerald-700':'text-rose-700'}>Variance <b>{p.stock_variance??0}</b></div></div></div>
          {d.status==='open'&&<form action={recordCommunityInbound} className="mt-4 grid gap-2 lg:grid-cols-4">
            <input type="hidden" name="day_id" value={d.id}/><input type="hidden" name="product_id" value={p.product_id}/>
            <label><span className="label">Source</span><select className="input" name="source_type"><option value="supplier">Supplier</option><option value="2tbr_store">2TBR Store</option><option value="delivery_agent">Delivery Agent</option><option value="transfer">Transfer</option><option value="return">Return</option><option value="other">Other</option></select></label>
            <label><span className="label">Source name</span><input className="input" name="source_name"/></label>
            <label><span className="label">Expected qty</span><input className="input" type="number" min="0" name="expected_quantity" defaultValue={Math.max(Number(p.required_quantity)-Number(p.inbound_received),0)} required/></label>
            <label><span className="label">Received qty</span><input className="input" type="number" min="0" name="received_quantity" required/></label>
            <label><span className="label">Damaged</span><input className="input" type="number" min="0" name="damaged_quantity" defaultValue="0"/></label>
            <label><span className="label">Returned</span><input className="input" type="number" min="0" name="returned_quantity" defaultValue="0"/></label>
            <label><span className="label">Exception code</span><input className="input" name="exception_code"/></label>
            <label><span className="label">Variance reason</span><input className="input" name="exception_reason" placeholder="Required if net differs"/></label>
            <label className="lg:col-span-3"><span className="label">Receiving note</span><input className="input" name="notes"/></label>
            <SubmitButton>Record receipt</SubmitButton>
          </form>}
          {d.status==='open'&&Number(p.stock_variance)!==0&&<form action={recordCommunityStockAdjustment} className="mt-3 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 md:grid-cols-4"><input type="hidden" name="day_id" value={d.id}/><input type="hidden" name="product_id" value={p.product_id}/><label><span className="label">Stock disposition</span><select className="input" name="disposition" required><option value="retained_at_point">Retained at point</option><option value="returned_to_office">Returned to office</option><option value="damaged">Damaged</option><option value="missing">Missing</option><option value="transfer_out">Transferred out</option><option value="other">Other</option></select></label><label><span className="label">Quantity</span><input className="input" type="number" min="1" name="quantity" defaultValue={Math.abs(Number(p.stock_variance))||1} required/></label><label><span className="label">Reason</span><input className="input" name="reason" required placeholder="Why this stock remains/left/damaged/missing"/></label><label><span className="label">Note</span><input className="input" name="notes"/></label><div className="md:col-span-4"><SubmitButton className="btn-secondary">Account stock variance</SubmitButton></div></form>}
        </article>)}
        {inbound.length>0&&<details className="card"><summary className="cursor-pointer font-black">Inbound history ({inbound.length})</summary><div className="mt-3 grid gap-2">{inbound.map((i:any)=><div className="rounded-xl bg-slate-50 p-3 text-sm" key={i.id}><b>{i.product_name}</b> · {i.source_type}<div className="muted">Expected {i.expected_quantity} · Received {i.received_quantity} · Damaged {i.damaged_quantity} · Returned {i.returned_quantity}</div>{i.exception_reason&&<div className="text-amber-700">{i.exception_reason}</div>}</div>)}</div></details>}
        {stockAdjustments.length>0&&<details className="card"><summary className="cursor-pointer font-black">Stock disposition history ({stockAdjustments.length})</summary><div className="mt-3 grid gap-2">{stockAdjustments.map((s:any)=><div className="rounded-xl bg-slate-50 p-3 text-sm" key={s.id}><b>{s.product_name}</b> · {String(s.disposition).replaceAll('_',' ')} · {s.quantity}<div className="muted">{s.reason}</div></div>)}</div></details>}
      </section>

      <section className="grid gap-3">
        <div><div className="card-title">Account-wise requirements</div><h2 className="section-title">Customer orders</h2><p className="muted text-sm">Successful handover requires verified goods and exact cash. Otherwise record an exception.</p></div>
        {orders.map((o:any)=><article className="card" key={o.order_id}>
          <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-black">{o.order_code}</h3><p className="muted">{o.customer_name} · {o.phone}</p><p className="muted text-sm">{o.fulfillment_method==='home_delivery'?'Home delivery · '+(o.delivery_address??''):'Community collection'}</p></div><div className="flex gap-2"><span className="chip">{String(o.status).replaceAll('_',' ')}</span><span className="chip">{String(o.state).replaceAll('_',' ')}</span></div></div>
          <div className="mt-3 grid gap-2">{(o.items??[]).map((i:any,idx:number)=><div className="flex justify-between border-t border-slate-100 pt-2 text-sm" key={idx}><span>{i.name} · {i.package_size} × <b>{i.quantity}</b></span><span>{taka(Number(i.unit_price)*Number(i.quantity))}</span></div>)}</div>
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4"><div><div className="card-title">Product total</div><b>{taka(o.product_subtotal)}</b></div><div><div className="card-title">Delivery fee</div><b>{taka(o.delivery_fee)}</b></div><div><div className="card-title">Product cash due</div><b>{taka(o.expected_product_cash)}</b></div><div><div className="card-title">Delivery cash due</div><b>{taka(o.expected_delivery_cash)}</b></div></div>
          <p className="mt-2 text-xs text-slate-500">Payment: {String(o.payment_status).replaceAll('_',' ')} · {o.payment_mode}</p>
          {o.exception_reason&&<div className="error mt-3"><b>{String(o.exception_code).replaceAll('_',' ')}</b> · {o.exception_reason}</div>}
          {d.status==='open'&&o.state!=='completed'&&o.state!=='exception'&&<>
            {!o.goods_verified_at&&<form action={verifyCommunityOrder} className="mt-4 grid gap-2 rounded-xl bg-sky-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end"><input type="hidden" name="day_id" value={d.id}/><input type="hidden" name="order_id" value={o.order_id}/><input className="input" name="notes" placeholder="Receiving/packet verification note"/><SubmitButton>Verify order received</SubmitButton></form>}
            {o.goods_verified_at&&o.status==='ready_for_pickup'&&<form action={completeCommunityOrder} className="mt-4 grid gap-2 rounded-xl bg-emerald-50 p-3 md:grid-cols-4"><input type="hidden" name="day_id" value={d.id}/><input type="hidden" name="order_id" value={o.order_id}/><label><span className="label">Product COD</span><input className="input" type="number" min="0" step="0.01" name="product_cash" defaultValue={Number(o.expected_product_cash)} required/></label><label><span className="label">Delivery fee</span><input className="input" type="number" min="0" step="0.01" name="delivery_cash" defaultValue={Number(o.expected_delivery_cash)} required/></label><label><span className="label">Actual delivery cost</span><input className="input" type="number" min="0" step="0.01" name="actual_delivery_cost" disabled={o.fulfillment_method!=='home_delivery'}/></label><label><span className="label">Handover note</span><input className="input" name="notes"/></label><div className="md:col-span-4"><SubmitButton>{o.fulfillment_method==='home_delivery'?'Confirm delivered':'Confirm handed over'}</SubmitButton></div></form>}
            <details className="mt-3 rounded-xl bg-amber-50 p-3"><summary className="cursor-pointer font-black">Record exception instead</summary><form action={recordCommunityOrderException} className="mt-3 grid gap-2 md:grid-cols-3"><input type="hidden" name="day_id" value={d.id}/><input type="hidden" name="order_id" value={o.order_id}/><select className="input" name="exception_code" required><option value="">Exception type</option>{exceptionOptions.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><input className="input md:col-span-2" name="exception_reason" required placeholder="Exact reason"/><input className="input" type="number" min="0" step="0.01" name="product_cash" defaultValue="0" placeholder="Product cash received"/><input className="input" type="number" min="0" step="0.01" name="delivery_cash" defaultValue="0" placeholder="Delivery cash received"/><input className="input" name="notes" placeholder="Additional note"/><div className="md:col-span-3"><SubmitButton className="btn-secondary">Save exception</SubmitButton></div></form></details>
          </>}
          {o.state==='completed'&&<div className="success mt-3">Completed · Product COD {taka(o.product_cash_received)} · Delivery cash {taka(o.delivery_cash_received)}</div>}
        </article>)}
      </section>

      {d.status==='open'&&<section className="card"><h2 className="section-title">Submit daily community report</h2><form action={submitCommunityOpsReport} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"><input type="hidden" name="day_id" value={d.id}/><textarea className="input min-h-20" name="report_note" placeholder="Summary, returns, shortages, unresolved issues"/><SubmitButton>Submit daily report</SubmitButton></form></section>}

      {['submitted','cash_handover_pending','exception'].includes(d.status)&&<section className="card"><h2 className="section-title">Cash handover to Admin / Accounts</h2><p className="muted text-sm">Submit the two cash buckets separately.</p><form action={submitCommunityCashHandover} className="mt-3 grid gap-2 md:grid-cols-3"><input type="hidden" name="day_id" value={d.id}/><label><span className="label">Product COD cash</span><input className="input" type="number" min="0" step="0.01" name="product_cod" defaultValue={Number(summary.product_cod_collected??0)} required/></label><label><span className="label">Home delivery fees</span><input className="input" type="number" min="0" step="0.01" name="delivery_fees" defaultValue={Number(summary.delivery_fees_collected??0)} required/></label><label><span className="label">Variance / handover note</span><input className="input" name="note"/></label><div className="md:col-span-3"><SubmitButton>Submit cash handover</SubmitButton></div></form>{handover&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">Submitted Product COD <b>{taka(handover.product_cod_submitted)}</b> · Delivery fees <b>{taka(handover.delivery_fees_submitted)}</b> · {handover.status}</div>}</section>}

      {d.status==='closed'&&<div className="success"><b>Day reconciled and closed.</b> Admin/Accounts accepted the cash handover{d.accepted_with_exception?' with documented exception(s)':''}.</div>}
    </>}
  </div></AppShell>
}
