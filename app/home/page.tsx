import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { user, profile, roles, supabase } = await requireOnboardedUser()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const [{data:savings},{data:activePools},{data:readyOrder},{data:community},{data:summaryRows}] = await Promise.all([
    supabase.from('savings_ledger').select('amount,verified_at').eq('customer_id',user.id).order('verified_at',{ascending:false}),
    supabase.from('pools').select('id,title,status,pickup_at,commitment_closes_at,cadence,pool_items(id)').eq('community_id',profile.community_id).in('status',['open','pricing','final_price','confirmation','ordered','ready_for_pickup']).order('created_at',{ascending:false}).limit(6),
    supabase.from('orders').select('id,order_code,status,pickup_points(name,address,google_maps_url)').eq('customer_id',user.id).eq('status','ready_for_pickup').order('ready_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('communities').select('id,name').eq('id',profile.community_id).maybeSingle(),
    supabase.rpc('get_my_community_summary'),
  ])
  const lifetime=(savings??[]).reduce((sum:number,row:any)=>sum+Number(row.amount),0)
  const thisMonth=(savings??[]).filter((row:any)=>row.verified_at>=monthStart).reduce((sum:number,row:any)=>sum+Number(row.amount),0)
  const summary=summaryRows?.[0] as any
  const pools=activePools??[]

  return <AppShell roles={roles}>
    <div className="grid min-w-0 gap-5 sm:gap-6">
      <section className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.45fr_.75fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-slate-400">Hello, {profile.full_name}</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Shop together with {community?.name}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Join a weekly or monthly pool, commit only what you need, and confirm only after the final pooled price is published.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Link href="/pool" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-2.5 font-black text-black">Browse pools</Link><Link href="/orders" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-5 py-2.5 font-bold text-white">My orders</Link></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">My verified savings</div><div className="mt-2 text-4xl font-black">{taka(thisMonth)}</div><div className="mt-1 text-sm text-slate-400">this month · {taka(lifetime)} lifetime</div><Link className="mt-4 inline-flex text-sm font-bold text-white underline underline-offset-4" href="/savings">View savings history</Link></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card"><div className="card-title">Community</div><div className="mt-2 text-xl font-black">{community?.name}</div><p className="muted mt-2">Your pools are selected specifically for this community.</p></div>
        <div className="card"><div className="card-title">Participating households</div><div className="metric">{summary?.household_count??0}</div><p className="muted mt-2">members currently registered in your community</p></div>
        <div className="card"><div className="card-title">Community savings · month</div><div className="metric text-emerald-700">{taka(summary?.month_verified_saving??0)}</div><p className="muted mt-2">verified only after successful collection</p></div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="card-title">Available now</p><h2 className="mt-1 text-2xl font-black">Your community pools</h2></div><Link href="/pool" className="text-sm font-black text-slate-700 underline underline-offset-4">View all pools →</Link></div>
        {pools.length ? <div className="grid gap-3 lg:grid-cols-2">{pools.map((pool:any)=>{
          const itemCount=(pool.pool_items??[]).length
          return <article key={pool.id} className="card group border-slate-300 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><span className="chip capitalize">{pool.cadence??'weekly'} pool</span><StatusPill status={pool.status}/></div><span className="text-sm font-bold text-slate-500">{itemCount} item{itemCount===1?'':'s'}</span></div>
            <h3 className="mt-4 text-xl font-black">{pool.title}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><span className="block text-xs font-bold uppercase text-slate-400">Commit by</span><b>{shortDate(pool.commitment_closes_at)}</b></div><div><span className="block text-xs font-bold uppercase text-slate-400">Pickup target</span><b>{shortDate(pool.pickup_at)}</b></div></div>
            <Link href="/pool" className="btn-primary mt-4 w-full sm:w-auto">Open pool</Link>
          </article>
        })}</div> : <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-6 text-center sm:p-9"><div className="mx-auto max-w-xl"><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">No live pool yet</div><h3 className="mt-2 text-2xl font-black">The next weekly or monthly pool will appear here.</h3><p className="muted mx-auto mt-3 max-w-md">Draft pools stay private. Once Operations opens a pool for {community?.name}, you will see it here automatically.</p></div></div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <div className="card p-5"><div className="card-title">Next pickup</div>{readyOrder?<><h2 className="mt-2 text-xl font-black">{readyOrder.order_code}</h2><p className="muted mt-2">{(readyOrder.pickup_points as any)?.name}<br/>{(readyOrder.pickup_points as any)?.address}</p><Link className="btn-secondary mt-4 w-full sm:w-auto" href="/pickup">Pickup details</Link></>:<><h2 className="mt-2 text-xl font-black">Nothing ready yet</h2><p className="muted mt-2">When an order is ready for collection, the selected pickup point will appear here.</p></>}</div>
        <div className="card p-5"><div className="card-title">How 2-TAKA-R-BAZAR works</div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[['1','Commit','Choose items and quantities while the pool is open.'],['2','Confirm','After the final price is published, confirm only what you want to buy.'],['3','Collect & save','Choose an available pickup point, collect the order, then savings are verified.']].map(([n,title,text])=><div key={n} className="rounded-xl bg-slate-50 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-black text-white">{n}</div><div className="mt-3 font-black">{title}</div><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></div>)}</div></div>
      </section>
    </div>
  </AppShell>
}
