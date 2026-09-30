import Link from 'next/link'
import { requirePickupOperator } from '@/lib/auth'
import { markCollected, recordInboundReceipt, reportPickupIssue } from '@/app/actions/pickup'
import { SubmitButton } from '@/components/submit-button'
import { StatusPill } from '@/components/status-pill'
import { Flash } from '@/components/flash'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'
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
  return <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 text-slate-950">
    <header className="app-shell-header sticky top-0 z-40 w-full px-3 pt-2 sm:px-5">
      <div className="app-shell-header-bar mx-auto flex w-full max-w-6xl items-center justify-between gap-2 rounded-[20px] border border-sky-200/80 bg-white/65 px-3 py-2 shadow-[inset_0_1px_0_white,0_10px_30px_rgba(14,165,233,.08)] backdrop-blur-xl sm:gap-3 sm:px-5">
        <Link href="/pickup-ops" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label="2-TAKA-R-BAZAR Pickup operations">
          <span className="hidden sm:block"><BrandLogo size={46}/></span><span className="sm:hidden"><BrandLogo size={38}/></span>
          <div className="hidden min-w-0 sm:block"><div className="text-sm font-black tracking-tight">PICKUP OPERATIONS</div><div className="text-[10px] font-semibold tracking-wide text-slate-500">Supplier handover · customer collection</div></div>
        </Link>
        <div className="app-role-actions flex min-w-0 flex-1 items-center justify-end gap-1 text-[10px] sm:gap-2 sm:text-xs">
          <ThemeToggle className="shrink-0"/>
          <Link href="/home" className="btn-primary shrink-0 rounded-full px-3 py-2" aria-label="Customer app"><span className="sm:hidden">App</span><span className="hidden sm:inline">Customer app</span></Link>
        </div>
      </div>
    </header>
    <main className="mx-auto grid w-full max-w-6xl min-w-0 gap-5 px-3 py-4 sm:px-5 sm:py-5"><section><h1 className="text-3xl font-black">Pickup operations</h1><p className="muted">Receive the consolidated supplier handover first. Customer orders appear for collection only after Operations marks the pool Ready for pickup.</p></section><Flash error={sp.error} notice={sp.notice}/>
    {(deliveries??[]).length>0&&<section className="grid gap-3"><div><div className="card-title">Inbound handover</div><h2 className="section-title">Supplier delivery</h2></div>{(deliveries??[]).map((d:any)=><article className="card" key={d.pool_item_id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-black">{d.product_name} · {d.package_size}</h3><p className="muted">{d.pool_title}</p><p className="muted">Receiving: {d.receiving_point_name} · target {d.supplier_delivery_at?dateTime(d.supplier_delivery_at):'not set'}</p></div><span className="chip capitalize">{d.receipt_status}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div><div className="card-title">Expected</div><b className="text-xl">{d.expected_quantity}</b></div><div><div className="card-title">Received</div><b className="text-xl">{d.received_quantity}</b></div><div><div className="card-title">Status</div><b className="text-xl capitalize">{d.receipt_status}</b></div></div><form action={recordInboundReceipt} className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end"><input type="hidden" name="pool_item_id" value={d.pool_item_id}/><label><span className="label">Received quantity</span><input className="input" type="number" min="0" name="received_quantity" defaultValue={d.received_quantity||d.expected_quantity} required/></label><label><span className="label">Receiving note / issue</span><input className="input" name="notes" placeholder="Packaging checked; note shortage/damage"/></label><SubmitButton>Record receipt</SubmitButton></form></article>)}</section>}
    <form className="card flex gap-2" method="get"><input className="input" name="q" defaultValue={sp.q??''} placeholder="Search order ID, customer name or phone"/><button className="btn-secondary shrink-0 whitespace-nowrap px-4">Search</button></form>
    {orders.length===0?<div className="card muted">No customer orders are ready for pickup.</div>:orders.map(o=>{const p=pm.get(o.id) as any;return <article className="card" key={o.id}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-black">{o.order_code}</h2><p className="muted">{p?.full_name} · {p?.phone}</p><p className="muted">{o.pickup_points?.name}</p></div><StatusPill status={o.status}/></div><div className="mt-3 grid gap-2">{o.order_items?.map((i:any)=><div key={i.id} className="flex justify-between border-t border-slate-100 pt-2"><span>{i.products?.name} · {i.products?.package_size} × <b>{i.quantity}</b></span><span>{taka(Number(i.unit_price)*Number(i.quantity))}</span></div>)}</div>{o.status==='ready_for_pickup'&&<div className="mt-4 grid gap-3 md:grid-cols-2"><form action={markCollected} className="mt-0 grid gap-2 rounded-xl bg-emerald-50 p-3"><input type="hidden" name="order_id" value={o.id}/><input className="input" name="notes" placeholder="Collection note (optional)"/><SubmitButton>Mark collected</SubmitButton><p className="text-xs text-emerald-900">Completes the order, credits verified savings once, and may qualify a pending first-order referral reward exactly once.</p></form><form action={reportPickupIssue} className="grid gap-2 rounded-xl bg-amber-50 p-3"><input type="hidden" name="order_id" value={o.id}/><textarea className="input min-h-20" name="description" placeholder="Missing/damaged/wrong goods detail" required/><SubmitButton className="btn-secondary">Report issue</SubmitButton></form></div>}</article>})}
    </main>
  </div>
}
