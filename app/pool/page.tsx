import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { SubmitButton } from '@/components/submit-button'
import { commitToPool } from '@/app/actions/customer'
import { requireOnboardedUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { taka } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function PoolPage({ searchParams }: { searchParams: Promise<{error?:string;notice?:string}> }) {
  const { user, profile, roles, supabase } = await requireOnboardedUser()
  const { error, notice } = await searchParams
  const admin = createAdminClient()
  const { data: pool } = await supabase.from('pools').select('*').eq('community_id',profile.community_id).in('status',['open','pricing','final_price','confirmation','ordered','ready_for_pickup']).order('created_at',{ascending:false}).limit(1).maybeSingle()
  let items: any[] = []; const commitments = new Map<string, any>(); const demand = new Map<string, number>()
  if (pool) {
    const [{ data: itemRows }, { data: ownCommitments }] = await Promise.all([
      admin.from('pool_items').select('*,products(id,name,brand,category,package_size,unit,image_url)').eq('pool_id',pool.id).eq('active',true).order('created_at'),
      supabase.from('commitments').select('*').eq('customer_id',user.id),
    ])
    items = itemRows ?? []
    ;(ownCommitments ?? []).forEach((c:any)=>commitments.set(c.pool_item_id,c))
    const { data: allCommitments } = await admin.from('commitments').select('pool_item_id,quantity,status').in('pool_item_id',items.map(i=>i.id)).in('status',['active','confirmed'])
    ;(allCommitments ?? []).forEach((c:any)=>demand.set(c.pool_item_id,(demand.get(c.pool_item_id)??0)+Number(c.quantity)))
  }
  return <AppShell roles={roles}><div className="grid gap-5">
    <section><h1 className="text-3xl font-black">This week&apos;s pool</h1><p className="muted mt-1">Local demand for {profile.household_name} in your community.</p></section>
    {error && <div className="error">{error}</div>}{notice && <div className="success">{notice}</div>}
    {!pool ? <div className="card"><p>No active pool right now.</p></div> : <>
      <div className="card flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{pool.title}</h2><p className="muted mt-1">Demand and price status update here.</p></div><StatusPill status={pool.status}/></div>
      <div className="grid gap-4 lg:grid-cols-2">{items.map((item:any)=>{
        const product=item.products; const own=commitments.get(item.id); const final=Number(item.final_customer_price||0); const bench=Number(item.benchmark_price_snapshot); const perUnit=final?Math.max(0,bench-final):null
        return <article className="card" key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-500">{product?.category}</p><h3 className="text-xl font-black">{product?.name}</h3><p className="muted">{product?.brand} · {product?.package_size}</p></div><span className="chip">Demand {demand.get(item.id)??0}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Market benchmark</div><b className="text-lg">{taka(bench)}</b></div><div className="rounded-xl bg-emerald-50 p-3"><div className="card-title">Final pool price</div><b className="text-lg text-emerald-800">{final?taka(final):'Pending'}</b>{perUnit!==null&&<p className="text-sm font-bold text-emerald-800">Save {taka(perUnit)}/unit</p>}</div></div>
          {own && <p className="mt-3 text-sm font-semibold">Your commitment: {own.quantity} · <StatusPill status={own.status}/></p>}
          {pool.status==='open' ? <form action={commitToPool} className="mt-4 flex items-end gap-2"><input type="hidden" name="pool_item_id" value={item.id}/><label className="flex-1"><span className="label">Quantity</span><input className="input" type="number" name="quantity" min={item.min_quantity} max={item.max_quantity} defaultValue={own?.quantity??1} required/></label><SubmitButton>{own?'Update commitment':'I want this'}</SubmitButton></form> : <p className="muted mt-4">Commitments are closed while this pool is in {String(pool.status).replaceAll('_',' ')}.</p>}
        </article>
      })}</div>
      <div className="notice"><b>Transparent benchmark:</b> savings use the admin-approved local market benchmark stored for the pool item, not an artificial MRP. Savings become verified only after collection.</div>
    </>}
  </div></AppShell>
}
