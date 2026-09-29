import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin-shell'
import { StatusPill } from '@/components/status-pill'
import { requireAdmin } from '@/lib/auth'
import { dateTime, taka } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: pool } = await supabase.from('pools').select('id,community_id,title,status,cadence,commitment_closes_at,confirmation_closes_at,supplier_delivery_at,pickup_at,receiving_pickup_point_id,notes').eq('id', id).maybeSingle()
  if (!pool) notFound()

  const [{ data: community }, { data: items }, { data: products }, { data: commitments }, { data: quotes }, { data: pickups }] = await Promise.all([
    supabase.from('communities').select('id,name').eq('id', pool.community_id).maybeSingle(),
    supabase.from('pool_items').select('id,product_id,benchmark_price_snapshot,final_customer_price').eq('pool_id', id),
    supabase.from('products').select('id,name,package_size'),
    supabase.from('commitments').select('pool_item_id,quantity,status'),
    supabase.from('supplier_quotes').select('pool_item_id,quote_phase,threshold_quantity,customer_ceiling_price').eq('quote_phase','planning_tier'),
    supabase.from('pickup_points').select('id,name,address').eq('community_id', pool.community_id).eq('active', true),
  ])

  const productById = new Map((products ?? []).map((p: any) => [p.id, p]))
  const selectedPickup = (pickups ?? []).find((p: any) => p.id === pool.receiving_pickup_point_id)
  const demandFor = (itemId: string) => (commitments ?? []).filter((c: any) => c.pool_item_id === itemId && ['active','confirmed'].includes(c.status)).reduce((sum: number, c: any) => sum + Number(c.quantity || 0), 0)
  const tiersFor = (itemId: string) => (quotes ?? []).filter((q: any) => q.pool_item_id === itemId).sort((a: any,b: any) => Number(a.threshold_quantity)-Number(b.threshold_quantity))
  const totalDemand = (items ?? []).reduce((sum: number, i: any) => sum + demandFor(i.id), 0)

  return <AdminShell><div className="grid gap-5">
    <div className="flex flex-wrap items-center gap-2 text-sm"><Link className="font-bold text-cyan-800 underline" href="/admin/pools">← Pools</Link><span className="text-slate-400">/</span><span>{pool.title}</span></div>

    <section className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="card-title">Pool details</div><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{pool.title}</h1><p className="muted mt-2">Use this page to review one pool. Operational edits are safe; products, benchmarks, existing demand and pricing history stay protected once the pool is active.</p></div><StatusPill status={pool.status}/></div>
      <div className="mt-4 flex flex-wrap gap-2"><Link className="btn-primary" href={`/admin/pools/edit?pool=${pool.id}`}>Edit pool details</Link><Link className="btn-secondary" href="/admin/pools/workflow">Advanced workflow</Link><Link className="btn-secondary" href="/pool">Customer view</Link></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-4"><div className="card-title">Community</div><b>{community?.name ?? 'Unknown'}</b></div>
      <div className="card p-4"><div className="card-title">SKUs</div><b>{items?.length ?? 0}</b></div>
      <div className="card p-4"><div className="card-title">Committed units</div><b>{totalDemand}</b></div>
      <div className="card p-4"><div className="card-title">Pickup</div><b>{pool.pickup_at ? dateTime(pool.pickup_at) : 'Not set'}</b></div>
    </section>

    <section className="card p-5">
      <h2 className="text-xl font-bold">Operational timeline</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><div className="label">Commitment closes</div><div>{pool.commitment_closes_at ? dateTime(pool.commitment_closes_at) : 'Not set'}</div></div>
        <div><div className="label">Confirmation closes</div><div>{pool.confirmation_closes_at ? dateTime(pool.confirmation_closes_at) : 'Not set'}</div></div>
        <div><div className="label">Supplier handover</div><div>{pool.supplier_delivery_at ? dateTime(pool.supplier_delivery_at) : 'Not set'}</div></div>
        <div><div className="label">Receiving point</div><div>{selectedPickup ? `${selectedPickup.name} · ${selectedPickup.address}` : 'Not set'}</div></div>
      </div>
      {pool.notes && <div className="notice mt-4"><b>Notes:</b> {pool.notes}</div>}
    </section>

    <section className="grid gap-3"><div><div className="card-title">Items</div><h2 className="text-xl font-bold">SKU demand & price targets</h2></div>
      {(items ?? []).length === 0 ? <div className="card p-5">No items in this pool.</div> : (items ?? []).map((item: any) => {
        const product: any = productById.get(item.product_id)
        const demand = demandFor(item.id)
        const tiers = tiersFor(item.id)
        const next = tiers.find((t: any) => Number(t.threshold_quantity) > demand)
        const reached = [...tiers].reverse().find((t: any) => Number(t.threshold_quantity) <= demand)
        return <div key={item.id} className="card grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr] lg:items-center">
          <div><div className="card-title">{product?.package_size ?? 'SKU'}</div><h3 className="text-lg font-bold">{product?.name ?? item.product_id}</h3><p className="muted mt-1">Benchmark {taka(Number(item.benchmark_price_snapshot ?? 0))}</p></div>
          <div><div className="label">Live demand</div><b>{demand} units</b></div>
          <div><div className="label">Current tier</div><b>{reached ? `${reached.threshold_quantity}+ → ${taka(Number(reached.customer_ceiling_price))}` : 'Not unlocked'}</b></div>
          <div><div className="label">Next target</div><b>{next ? `${next.threshold_quantity} units → ${taka(Number(next.customer_ceiling_price))}` : 'Highest tier reached / no tier'}</b>{next && <p className="muted mt-1">{Math.max(0, Number(next.threshold_quantity)-demand)} more units needed</p>}</div>
        </div>
      })}
    </section>
  </div></AdminShell>
}
