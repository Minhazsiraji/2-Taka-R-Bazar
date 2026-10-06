import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { StatusPill } from '@/components/status-pill'
import { requireAdmin } from '@/lib/auth'
import { shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Search = { q?: string; status?: string }

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim().toLowerCase()
  const status = sp.status ?? 'all'

  const [{ data: pools }, { data: communities }, { data: items }, { data: commitments }] = await Promise.all([
    supabase.from('pools').select('id,community_id,title,status,cadence,pickup_at,created_at,is_paused').order('created_at', { ascending: false }),
    supabase.from('communities').select('id,name'),
    supabase.from('pool_items').select('id,pool_id'),
    supabase.from('commitments').select('pool_item_id,quantity,status'),
  ])

  const communityById = new Map((communities ?? []).map((x: any) => [x.id, x.name]))
  const itemIdsByPool = new Map<string, string[]>()
  ;(items ?? []).forEach((i: any) => {
    if (!itemIdsByPool.has(i.pool_id)) itemIdsByPool.set(i.pool_id, [])
    itemIdsByPool.get(i.pool_id)!.push(i.id)
  })
  const demandByItem = new Map<string, number>()
  ;(commitments ?? []).forEach((c: any) => {
    if (!['active', 'confirmed'].includes(c.status)) return
    demandByItem.set(c.pool_item_id, (demandByItem.get(c.pool_item_id) ?? 0) + Number(c.quantity || 0))
  })

  const filtered = (pools ?? []).filter((p: any) => {
    const community = String(communityById.get(p.community_id) ?? '').toLowerCase()
    const matchesText = !q || p.title.toLowerCase().includes(q) || community.includes(q) || p.status.toLowerCase().includes(q)
    return matchesText && (status === 'all' || p.status === status)
  })

  return <AdminShell><div className="grid gap-5">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="card-title">Pool operations</div><h1 className="text-2xl font-bold sm:text-3xl">Pools</h1><p className="muted mt-1">Search the list, open one pool, then manage only that pool.</p></div>
      <div className="flex flex-wrap gap-2"><Link className="btn-primary" href="/admin/pools/new">Create pool</Link><Link className="btn-secondary" href="/admin/pools/workflow">Advanced workflow</Link></div>
    </section>

    <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_180px_auto]" method="get">
      <label><span className="label">Search</span><input className="input" name="q" defaultValue={sp.q ?? ''} placeholder="Pool, community or status"/></label>
      <label><span className="label">Status</span><select className="input" name="status" defaultValue={status}><option value="all">All</option><option value="draft">Draft</option><option value="open">Open</option><option value="pricing">Pricing</option><option value="final_price">Final price</option><option value="confirmation">Confirmation</option><option value="ordered">Ordered</option><option value="ready_for_pickup">Ready</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      <button className="btn-primary self-end" type="submit">Search</button>
    </form>

    <div className="flex items-center justify-between"><p className="muted">{filtered.length} pool{filtered.length === 1 ? '' : 's'} found</p>{(q || status !== 'all') && <Link className="text-sm font-bold text-cyan-800 underline" href="/admin/pools">Clear filters</Link>}</div>

    <div className="grid gap-3">
      {filtered.length === 0 ? <div className="card p-5"><b>No pools match your search.</b></div> : filtered.map((p: any) => {
        const itemIds = itemIdsByPool.get(p.id) ?? []
        const demand = itemIds.reduce((sum, id) => sum + (demandByItem.get(id) ?? 0), 0)
        return <Link key={p.id} href={`/admin/pools/${p.id}`} className="card group grid gap-3 p-4 transition hover:-translate-y-0.5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="chip capitalize">{p.cadence ?? 'weekly'}</span><span className="text-xs font-bold uppercase text-slate-500">{communityById.get(p.community_id) ?? 'Unknown community'}</span></div><h2 className="mt-2 truncate text-lg font-bold sm:text-xl">{p.title}</h2><p className="muted mt-1">Created {shortDate(p.created_at)} · {itemIds.length} SKU{itemIds.length === 1 ? '' : 's'} · {demand} committed units · pickup {p.pickup_at ? shortDate(p.pickup_at) : 'not set'}</p></div>
          <div className="flex items-center gap-3 sm:justify-end">{p.is_paused&&<span className="chip">Paused</span>}<StatusPill status={p.status}/><span className="btn-secondary px-4 py-2">Open →</span></div>
        </Link>
      })}
    </div>
  </div></AdminShell>
}
