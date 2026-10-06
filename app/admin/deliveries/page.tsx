import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { markHomeDelivered } from '@/app/actions/admin'
import { requireAdmin } from '@/lib/auth'
import { taka, dateTime } from '@/lib/format'
import { StatusPill } from '@/components/status-pill'

export const dynamic='force-dynamic'

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin();const sp=await searchParams
  const {data:orders}=await supabase.from('orders').select('id,order_code,customer_id,status,ready_at,product_subtotal,delivery_fee,delivery_actual_cost,delivery_address,total_amount,pools(title,communities(name)),order_items(quantity,unit_price,products(name,package_size))').eq('fulfillment_method','home_delivery').order('created_at',{ascending:false}).limit(200)
  const ids=[...new Set((orders??[]).map((o:any)=>o.customer_id))]
  const {data:profiles}=ids.length?await supabase.from('profiles').select('id,full_name,phone').in('id',ids):{data:[] as any[]};const customerById=new Map((profiles??[]).map((p:any)=>[p.id,p]))
  return <AdminShell><div className="grid gap-5"><section><div className="card-title">Fulfilment</div><h1 className="text-3xl font-black">Home deliveries</h1><p className="muted mt-1">Customer delivery fees stay separate from product savings and product margin. Record actual delivery cost when the order is delivered.</p></section><Flash {...sp}/>
    {(orders??[]).length===0?<div className="card muted">No home-delivery orders yet.</div>:(orders??[]).map((o:any)=>{const customer=customerById.get(o.customer_id) as any;const actual=o.delivery_actual_cost==null?null:Number(o.delivery_actual_cost);const deliveryContribution=actual==null?null:Number(o.delivery_fee)-actual;return <article className="card" key={o.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">{o.order_code}</h2><p className="muted">{customer?.full_name} · {customer?.phone} · {o.pools?.communities?.name}</p></div><StatusPill status={o.status}/></div><p className="mt-3"><b>Address:</b> {o.delivery_address}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Products</div><b>{taka(o.product_subtotal)}</b></div><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Customer delivery fee</div><b>{taka(o.delivery_fee)}</b></div><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Total payable</div><b>{taka(o.total_amount)}</b></div><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Delivery contribution</div><b>{deliveryContribution==null?'Pending':taka(deliveryContribution)}</b></div></div>
      {o.status==='ready_for_pickup'&&<form action={markHomeDelivered} className="mt-4 grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-[180px_1fr_auto] sm:items-end"><input type="hidden" name="order_id" value={o.id}/><label><span className="label">Actual delivery cost</span><input className="input" type="number" min="0" step="0.01" name="actual_delivery_cost" placeholder="e.g. 25" required/></label><label><span className="label">Delivery note</span><input className="input" name="notes" placeholder="Receiver / handover note"/></label><SubmitButton>Mark delivered</SubmitButton><p className="muted text-xs sm:col-span-3">This completes the order and verifies product savings. Delivery fee/cost remains a separate operational record.</p></form>}
      {o.status==='completed'&&<p className="success mt-4">Delivered and completed{actual!=null?` · actual delivery cost ${taka(actual)}`:''}{o.ready_at?` · ready ${dateTime(o.ready_at)}`:''}</p>}
    </article>})}
  </div></AdminShell>
}
