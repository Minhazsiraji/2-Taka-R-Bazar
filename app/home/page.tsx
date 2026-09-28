import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const Icon = ({children}:{children:React.ReactNode}) => <span className="glass-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl">{children}</span>

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
  const glass='glass-panel'

  return <AppShell roles={roles}>
    <div className="relative grid min-w-0 gap-4 sm:gap-5">
      <section className={`${glass} relative overflow-hidden rounded-[28px] p-5 sm:p-7 lg:p-8`}>
        <div className="hidden" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_.65fr] lg:items-center">
          <div className="grid gap-5 md:grid-cols-[1fr_230px] md:items-center lg:grid-cols-[1fr_250px]">
            <div>
              <p className="text-sm font-bold text-sky-700">Hello, {profile.full_name}</p>
              <h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.02] tracking-[-.035em] text-slate-950 sm:text-4xl lg:text-5xl">Shop together with <span className="text-cyan-700">{community?.name}</span></h1>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-slate-700">Join a weekly or monthly pool, commit only what you need, and confirm only after the final pooled price is published.</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Link href="/pool" className="glass-primary inline-flex min-h-12 items-center justify-center rounded-2xl border border-sky-400 bg-gradient-to-b from-sky-400 to-blue-600 px-6 font-black text-white shadow-[0_8px_18px_rgba(37,99,235,.25),inset_0_1px_0_rgba(255,255,255,.65)]"><span>Browse pools</span></Link><Link href="/orders" className="glass-secondary inline-flex min-h-12 items-center justify-center rounded-2xl border border-white bg-white/55 px-6 font-black text-slate-900 shadow-sm backdrop-blur">▣　My orders</Link></div>
            </div>
            <div className="hidden md:flex items-center justify-center"><img src="/grocery-hero.svg" alt="Grocery basket" className="h-44 w-full object-contain drop-shadow-[0_16px_18px_rgba(14,165,233,.18)]" /></div>
          </div>
          <div className="glass-subpanel rounded-[24px] p-5">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">My verified savings</div><div className="mt-3 text-4xl font-black text-slate-950">🪙 {taka(thisMonth)}</div><div className="mt-1 text-sm font-medium text-slate-600">this month · {taka(lifetime)} lifetime</div><Link className="glass-inset mt-5 flex min-h-11 items-center justify-between rounded-xl px-4 text-sm font-black text-slate-900" href="/savings">View savings history <span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className={`${glass} flex items-center gap-4 rounded-[22px] p-4`}><Icon>📍</Icon><div><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">Community</div><div className="mt-1 text-lg font-black">{community?.name}</div><p className="mt-1 text-xs leading-4 text-slate-600">Your pools are selected specifically for this community.</p></div></div>
        <div className={`${glass} flex items-center gap-4 rounded-[22px] p-4`}><Icon>👥</Icon><div><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">Participating households</div><div className="mt-1 text-2xl font-black">{summary?.household_count??0}</div><p className="mt-1 text-xs leading-4 text-slate-600">members currently registered in your community.</p></div></div>
        <div className={`${glass} flex items-center gap-4 rounded-[22px] p-4`}><Icon>📊</Icon><div><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">Community savings · month</div><div className="mt-1 text-2xl font-black">{taka(summary?.month_verified_saving??0)}</div><p className="mt-1 text-xs leading-4 text-slate-600">verified only after successful collection.</p></div></div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-2"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-sky-700">Available now</p><h2 className="mt-1 text-2xl font-black tracking-tight">Your community pools</h2></div><Link href="/pool" className="text-sm font-black text-cyan-700 underline underline-offset-4">View all pools　→</Link></div>
        {pools.length ? <div className="grid gap-3">{pools.map((pool:any)=>{
          const itemCount=(pool.pool_items??[]).length
          return <article key={pool.id} className={`${glass} group relative overflow-hidden rounded-[26px] p-5 transition hover:-translate-y-0.5 hover:shadow-xl`}>
            <div className="grid gap-5 md:grid-cols-[170px_1fr_230px] md:items-center">
              <div className="hidden h-28 items-center justify-center md:flex"><img src="/grocery-hero.svg" alt="Grocery pool" className="h-full w-full object-contain" /></div>
              <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-cyan-50/20 px-3 py-1 text-xs font-black capitalize text-cyan-800">{pool.cadence??'weekly'} Pool</span><StatusPill status={pool.status}/></div><h3 className="mt-3 text-xl font-black sm:text-2xl">{pool.title}</h3><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="glass-inset rounded-xl p-3"><span className="block text-[10px] font-black uppercase text-sky-700">▣　Commit by</span><b>{shortDate(pool.commitment_closes_at)}</b></div><div className="glass-inset rounded-xl p-3"><span className="block text-[10px] font-black uppercase text-sky-700">🚚　Pickup target</span><b>{shortDate(pool.pickup_at)}</b></div></div></div>
              <div className="flex flex-col gap-4 md:items-end"><span className="text-sm font-bold text-slate-600">♙　{itemCount} item{itemCount===1?'':'s'}</span><Link href="/pool" className="glass-primary inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-sky-400 bg-gradient-to-b from-sky-400 to-blue-600 px-6 font-black text-white shadow-[0_8px_18px_rgba(37,99,235,.22)]"><span>Open pool</span></Link></div>
            </div>
          </article>
        })}</div> : <div className={`${glass} rounded-[26px] p-8 text-center`}><div className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">No live pool yet</div><h3 className="mt-2 text-2xl font-black">The next weekly or monthly pool will appear here.</h3><p className="mx-auto mt-3 max-w-md text-sm text-slate-600">Draft pools stay private. Once Operations opens a pool for {community?.name}, you will see it here automatically.</p></div>}
      </section>

      <section className="grid gap-3 lg:grid-cols-[.9fr_1.1fr]">
        <div className={`${glass} relative overflow-hidden rounded-[24px] p-5`}><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">◷　Next pickup</div>{readyOrder?<><h2 className="mt-2 text-xl font-black">{readyOrder.order_code}</h2><p className="mt-2 text-sm text-slate-600">{(readyOrder.pickup_points as any)?.name}<br/>{(readyOrder.pickup_points as any)?.address}</p><Link className="glass-secondary mt-4 inline-flex rounded-xl px-4 py-2 font-bold" href="/pickup">Pickup details</Link></>:<><h2 className="mt-2 text-xl font-black">Nothing ready yet</h2><p className="mt-2 max-w-sm text-sm text-slate-600">When an order is ready for collection, the selected pickup point will appear here.</p><div className="pointer-events-none absolute bottom-2 right-8 text-6xl opacity-25">🧊</div></>}</div>
        <div className={`${glass} rounded-[24px] p-5`}><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">⚙　How 2-TAKA-R-BAZAR works</div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[['1','Commit','Choose items and quantities while the pool is open.'],['2','Confirm','After the final price is published, confirm only what you want to buy.'],['3','Collect & save','Choose an available pickup point, collect the order, then savings are verified.']].map(([n,title,text])=><div key={n} className="glass-inset rounded-2xl p-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-blue-600 text-sm font-black text-white">{n}</div><div className="mt-3 font-black">{title}</div><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>)}</div></div>
      </section>
    </div>
  </AppShell>
}
