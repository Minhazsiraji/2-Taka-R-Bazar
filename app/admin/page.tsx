import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function AdminDashboard(){
  const {supabase:db}=await requireAdmin()
  // Live pilot modules; legacy Pool and Orders data are intentionally NOT
  // blended into these metrics. No fabricated finance or customer activity.
  const [
   openCycles,activeOffers,quotesResult,directOrders,households,products,qrResult
  ]=await Promise.all([
   db.from('simple_sale_cycles').select('id,offer_id').eq('status','open').limit(500),
   db.from('simple_sale_offers').select('id,kind').eq('published',true),
   db.from('simple_sale_cycle_quotes').select('id,status,fulfillment').in('status',['awaiting_delivery','quoted','accepted','payment_submitted']).limit(500),
   db.from('launch_orders').select('id,status,payment_status').limit(500),
   db.from('profiles').select('id',{count:'exact',head:true}).not('onboarding_completed_at','is',null),
   db.from('products').select('id',{count:'exact',head:true}).eq('active',true),
   db.rpc('get_admin_community_qr_stats')
  ])
  const failures=[openCycles,activeOffers,quotesResult,directOrders,households,products].some(r=>Boolean(r.error))
  const offerKind=new Map((activeOffers.data??[]).map(o=>[o.id,o.kind]))
  const active=(kind:string)=>(openCycles.data??[]).filter(c=>offerKind.get(c.offer_id)===kind).length
  const waitingDelivery=(quotesResult.data??[]).filter(q=>q.status==='awaiting_delivery'&&!q.fulfillment).length
  const feeReview=(quotesResult.data??[]).filter(q=>q.status==='awaiting_delivery'&&q.fulfillment).length
  const staffPayments=(quotesResult.data??[]).filter(q=>q.status==='payment_submitted').length
  const directReview=(directOrders.data??[]).filter(o=>o.status==='requested'||o.status==='confirmed'&&o.payment_status==='submitted').length
  const liveMetrics=[
    {label:'Open Group Deal rounds',value:active('GROUP_DEAL'),href:'/admin/offers',caption:'Community-specific'},
    {label:'Open Pool rounds',value:active('COMMUNITY_POOL'),href:'/admin/offers',caption:'Community-specific'},
    {label:'Customers choosing delivery',value:waitingDelivery,href:'/admin/order-tracking?stage=customer',caption:'Locked quotes'},
    {label:'Staff delivery fees needed',value:feeReview,href:'/admin/offer-settlement',caption:'Confirm fee before payment'},
    {label:'Transfers to verify',value:staffPayments,href:'/admin/offer-settlement',caption:'Independent bank/bKash check'},
    {label:'Direct approvals needed',value:directReview,href:'/admin/launch-orders',caption:'Separate order lane'},
    {label:'Active products',value:products.count??'—',href:'/admin/products',caption:'One shared catalog'},
    {label:'Onboarded households',value:households.count??'—',href:'/admin/customers',caption:'Real registered customers'}
  ]
  return <AdminShell><div className="grid gap-5">
    <header className="card">
     <p className="card-title">2TBR · Live operations</p>
     <h1 className="mt-1 text-2xl font-black sm:text-3xl">Operations dashboard</h1>
     <p className="muted mt-2">Daily priorities from the new Group Deal, Community Pool and direct-order modules. Historical finance and legacy Pool figures are not mixed into these counts.</p>
     <div className="mt-3 flex flex-wrap gap-2">
      <Link href="/admin/products#quick-product-upload" className="btn-primary">Upload product</Link>
      <Link href="/admin/inventory" className="btn-secondary">Update inventory</Link>
      <Link href="/admin/offers" className="btn-secondary">Create Deal / Pool</Link>
      <Link href="/admin/order-tracking" className="btn-secondary">Track orders</Link>
     </div>
    </header>
    {failures&&<p role="alert" className="error">One or more live metrics could not load. Do not interpret a missing value as zero; open the linked module for verification.</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Real live module metrics">
      {liveMetrics.map(m=><Link href={m.href} key={m.label} className="admin-ops-stat block transition hover:border-teal-300">
        <p className="card-title">{m.label}</p><strong className="metric block">{failures?'—':m.value}</strong>
        <p className="muted mt-1 text-xs">{m.caption}</p>
      </Link>)}
    </section>
    <section className="card">
     <h2 className="section-title">Your daily workflow</h2>
     <p className="muted mt-1">Upload one product → update sellable allocation → create Direct / Deal / Pool offers → review closed quotes → confirm delivery and actual received payment → track orders.</p>
     <div className="mt-3 flex flex-wrap gap-2">
      <Link href="/admin/offer-settlement" className="btn-primary">Review settlement queue</Link>
      <Link href="/admin/order-tracking?stage=staff" className="btn-secondary">Show orders needing staff</Link>
      <Link href="/admin/own-products" className="btn-secondary">Physical own-stock ledger</Link>
     </div>
    </section>
    <section className="card grid gap-4">
      <div>
        <div className="card-title">Community QR acquisition</div>
        <h2 className="mt-1 text-2xl font-black">Poster → signup → community → completed buyer</h2>
        <p className="muted mt-1">A scan is tracked separately. It does not count as a member, commitment or order.</p>
      </div>

      {qrResult.error
        ? <div className="error">QR campaign statistics are temporarily unavailable.</div>
        : !(qrResult.data??[]).length
          ? <p className="muted text-sm">No community QR campaigns are configured yet.</p>
          : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Code</th><th className="px-3 py-2">Community</th><th className="px-3 py-2">Campaign / placement</th><th className="px-3 py-2 text-right">Scans</th><th className="px-3 py-2 text-right">Joined</th><th className="px-3 py-2 text-right">Completed buyers</th></tr></thead>
              <tbody>{(qrResult.data??[]).map((row:any)=><tr key={row.code} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-mono font-black">{row.code}</td><td className="px-3 py-3 font-bold">{row.community_name}</td><td className="px-3 py-3"><div>{row.campaign_name}</div><div className="muted text-xs">{row.placement??'—'}</div></td><td className="px-3 py-3 text-right font-black">{row.scan_count}</td><td className="px-3 py-3 text-right font-black">{row.joined_count}</td><td className="px-3 py-3 text-right font-black">{row.buyers_with_completed_order}</td></tr>)}</tbody>
            </table></div>}
    </section>

    <div className="notice">Pilot dashboards must use real operational data. Demo products may be seeded, but production metrics and supplier pricing are never fabricated.</div>
  </div></AdminShell>
}
