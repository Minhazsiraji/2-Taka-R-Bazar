import Link from 'next/link'
import { requirePickupOperator } from '@/lib/auth'
import { markCollected, recordInboundReceipt, reportPickupIssue } from '@/app/actions/pickup'
import { SubmitButton } from '@/components/submit-button'
import { StatusPill } from '@/components/status-pill'
import { Flash } from '@/components/flash'
import { taka, dateTime } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;error?:string;notice?:string}>}){
  const {user,roles,supabase}=await requirePickupOperator(); const sp=await searchParams
  let pointIds:string[]=[]
  if(roles.has('admin')||roles.has('super_admin')){
    const {data}=await supabase.from('pickup_points').select('id').eq('active',true);pointIds=(data??[]).map((x:any)=>x.id)
  } else {
    const {data}=await supabase.from('pickup_operator_assignments').select('pickup_point_id').eq('user_id',user.id);pointIds=(data??[]).map((x:any)=>x.pickup_point_id)
  }
  const {data:deliveries}=await supabase.rpc('get_assigned_supplier_deliveries')
  let orders:any[]=[]
  if(pointIds.length){
    const {data}=await supabase.from('orders').select('*,pickup_points(name,address),order_items(*,products(name,package_size))').in('pickup_point_id',pointIds).in('status',['ready_for_pickup','completed']).order('ready_at',{ascending:false})
    orders=data??[]
  }
  const {data:contacts}=await supabase.rpc('get_pickup_customer_contacts'); const pm=new Map((contacts??[]).map((p:any)=>[p.order_id,p]))
  const q=(sp.q??'').trim().toLowerCase();if(q)orders=orders.filter(o=>{const p=pm.get(o.id) as any;return o.order_code.toLowerCase().includes(q)||(p?.full_name??'').toLowerCase().includes(q)||(p?.phone??'').includes(q)})
  return <div className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-5xl justify-between px-4 py-3"><b className="text-emerald-700">2-TAKA-R-BAZAR · Pickup</b><Link href="/home" className="text-sm font-bold">Customer app →</Link></div></header>
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5"><section><h1 className="text-3xl font-black">Pickup operations</h1><p className="muted">Receive the consolidated supplier handover first. Customer orders appear for collection only after Operations marks the pool Ready for pickup.</p></section><Flash error={sp.error} notice={sp.notice}/>
    {(deliveries??[]).length>0&&<section className="grid gap-3"><div><div className="card-title">Inbound handover</div><h2 className="section-title">Supplier delivery</h2></div>{(deliveries??[]).map((d:any)=><article className="card" key={d.pool_item_id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-black">{d.product_name} · {d.package_size}</h3><p className="muted">{d.pool_title}</p><p className="muted">Receiving: {d.receiving_point_name} · target {d.supplier_delivery_at?dateTime(d.supplier_delivery_at):'not set'}</p></div><span className="chip capitalize">{d.receipt_status}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div><div className="card-title">Expected</div><b className="text-xl">{d.expected_quantity}</b></div><div><div className="card-title">Received</div><b className="text-xl">{d.received_quantity}</b></div><div><div className="card-title">Status</div><b className="text-xl capitalize">{d.receipt_status}</b></div></div><form action={recordInboundReceipt} className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end"><input type="hidden" name="pool_item_id" value={d.pool_item_id}/><label><span className="label">Received quantity</span><input className="input" type="number" min="0" name="received_quantity" defaultValue={d.received_quantity||d.expected_quantity} required/></label><label><span className="label">Receiving note / issue</span><input className="input" name="notes" placeholder="Packaging checked; note shortage/damage"/></label><SubmitButton>Record receipt</SubmitButton></form></article>)}</section>}
    <form className="card flex gap-2" method="get"><input className="input" name="q" defaultValue={sp.q??''} placeholder="Search order ID, customer name or phone"/><button className="btn-secondary">Search</button></form>
    {orders.length===0?<div className="card muted">No customer orders are ready for pickup.</div>:orders.map(o=>{const p=pm.get(o.id) as any;return <article className="card" key={o.id}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-black">{o.order_code}</h2><p className="muted">{p?.full_name} · {p?.phone}</p><p className="muted">{o.pickup_points?.name}</p></div><StatusPill status={o.status}/></div><div className="mt-3 grid gap-2">{o.order_items?.map((i:any)=><div key={i.id} className="flex justify-between border-t border-slate-100 pt-2"><span>{i.products?.name} · {i.products?.package_size} × <b>{i.quantity}</b></span><span>{taka(Number(i.unit_price)*Number(i.quantity))}</span></div>)}</div>{o.status==='ready_for_pickup'&&<div className="mt-4 grid gap-3 md:grid-cols-2"><form action={markCollected} className="grid gap-2 rounded-xl bg-emerald-50 p-3"><input type="hidden" name="order_id" value={o.id}/><input className="input" name="notes" placeholder="Collection note (optional)"/><SubmitButton>Mark collected</SubmitButton><p className="text-xs text-emerald-900">Completes the order, credits verified savings once, and may qualify a pending first-order referral reward exactly once.</p></form><form action={reportPickupIssue} className="grid gap-2 rounded-xl bg-amber-50 p-3"><input type="hidden" name="order_id" value={o.id}/><textarea className="input min-h-20" name="description" placeholder="Missing/damaged/wrong goods detail" required/><SubmitButton className="btn-secondary">Report issue</SubmitButton></form></div>}</article>})}
    </main>
  </div>
}
