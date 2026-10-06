import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'
const Icon=({children}:{children:React.ReactNode})=><span className="glass-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl">{children}</span>

type PoolCardStats={joined:number;savingPotential:number}

export default async function HomePage(){
  const {user,profile,roles,supabase}=await requireOnboardedUser()
  const [{data:savingsSummaryRows},{data:activePools},{data:readyOrder},{data:community},{data:summaryRows}]=await Promise.all([
    supabase.rpc('get_my_savings_summary'),
    supabase.from('pools').select('id,title,status,is_paused,pickup_at,commitment_closes_at,cadence,pool_items(id,benchmark_price_snapshot)').eq('community_id',profile.community_id).in('status',['open','pricing','final_price','confirmation','ordered','ready_for_pickup']).order('created_at',{ascending:false}).limit(6),
    supabase.from('orders').select('id,order_code,status,fulfillment_method,delivery_address,delivery_fee,pickup_points(name,address,google_maps_url)').eq('customer_id',user.id).eq('status','ready_for_pickup').order('ready_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('communities').select('id,name').eq('id',profile.community_id).maybeSingle(),
    supabase.rpc('get_my_community_summary'),
  ])
  const savingsSummary=savingsSummaryRows?.[0] as any
  const lifetime=Number(savingsSummary?.lifetime_verified_saving??0)
  const thisMonth=Number(savingsSummary?.month_verified_saving??0)
  const summary=summaryRows?.[0] as any
  const pools=(activePools??[]).filter((pool:any)=>!pool.is_paused)
  const glass='glass-panel'

  const poolStatsEntries=await Promise.all(pools.map(async(pool:any)=>{
    const [participationResult,unlockResult]=await Promise.all([
      supabase.rpc('get_pool_participation',{p_pool_id:pool.id}),
      supabase.rpc('get_pool_price_unlocks',{p_pool_id:pool.id}),
    ])
    const joined=Number(participationResult.data?.[0]?.joined_households??0)
    const itemsById=new Map((pool.pool_items??[]).map((item:any)=>[item.id,item]))
    const savingPotential=(unlockResult.data??[]).reduce((sum:number,row:any)=>{
      const item:any=itemsById.get(row.pool_item_id)
      const benchmark=Number(item?.benchmark_price_snapshot??0)
      const unlocked=Number(row.unlocked_price??0)
      const quantity=Number(row.current_quantity??0)
      return sum+(unlocked>0?Math.max(0,benchmark-unlocked)*quantity:0)
    },0)
    return [pool.id,{joined,savingPotential} satisfies PoolCardStats] as const
  }))
  const poolStats=new Map<string,PoolCardStats>(poolStatsEntries)

  return <AppShell roles={roles}><div className="relative grid min-w-0 gap-4 sm:gap-5">
    <section className={`${glass} relative overflow-hidden rounded-[28px] p-5 sm:p-7 lg:p-8`}><div className="relative grid gap-6 lg:grid-cols-[1.35fr_.65fr] lg:items-center"><div className="grid gap-5 md:grid-cols-[1fr_230px] md:items-center lg:grid-cols-[1fr_250px]"><div><p className="text-sm font-bold text-sky-700">Hello, {profile.full_name}</p><h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.02] tracking-[-.035em] sm:text-4xl lg:text-5xl">Shop together with <span className="text-cyan-700">{community?.name}</span></h1><p className="mt-3 max-w-xl text-sm font-medium leading-6 text-slate-700">Join a weekly or monthly pool, commit only what you need, and confirm only after the final pooled price is published.</p><div className="mt-5 flex flex-col gap-2 sm:flex-row"><Link href="/pool" className="glass-primary inline-flex min-h-12 items-center justify-center rounded-2xl border border-sky-400 bg-gradient-to-b from-sky-400 to-blue-600 px-6 font-black text-white">Browse pools</Link><Link href="/orders" className="glass-secondary inline-flex min-h-12 items-center justify-center rounded-2xl border border-white bg-white/55 px-6 font-black text-slate-900">▣ My orders</Link></div></div><div className="hidden items-center justify-center md:flex"><img src="/grocery-hero-glass.svg" alt="Grocery basket" decoding="async" fetchPriority="high" className="h-44 w-full object-contain"/></div></div><div className="glass-subpanel rounded-[24px] p-5"><div className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">My verified savings</div><div className="mt-3 text-4xl font-black">🪙 {taka(thisMonth)}</div><div className="mt-1 text-sm font-medium text-slate-600">this month · {taka(lifetime)} lifetime</div><Link className="glass-inset mt-5 flex min-h-11 items-center justify-between rounded-xl px-4 text-sm font-black" href="/savings">View savings history <span>→</span></Link></div></div></section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className={`${glass} flex items-center gap-4 rounded-[22px] p-4`}><Icon>📍</Icon><div><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">Community</div><div className="mt-1 text-lg font-black">{community?.name}</div><p className="mt-1 text-xs text-slate-600">Your pools are selected for this community.</p></div></div><div className={`${glass} flex items-center gap-4 rounded-[22px] p-4`}><Icon>👥</Icon><div><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">Participating households</div><div className="mt-1 text-2xl font-black">{summary?.household_count??0}</div></div></div><div className={`${glass} flex items-center gap-4 rounded-[22px] p-4`}><Icon>📊</Icon><div><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">Community savings · month</div><div className="mt-1 text-2xl font-black">{taka(summary?.month_verified_saving??0)}</div></div></div></section>

    <section><div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-2"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-sky-700">Available now</p><h2 className="mt-1 text-2xl font-black tracking-tight">Your community pools</h2></div><Link href="/pool" className="text-sm font-black text-cyan-700 underline underline-offset-4">View all pools →</Link></div>{pools.length?<div className="grid gap-3">{pools.map((pool:any)=>{const itemCount=(pool.pool_items??[]).length;const stats=poolStats.get(pool.id)??{joined:0,savingPotential:0};return <article key={pool.id} className={`${glass} rounded-[22px] p-3 sm:p-4 lg:p-5`}><div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_190px] md:items-center lg:grid-cols-[145px_minmax(0,1fr)_210px]"><div className="hidden h-24 items-center justify-center md:flex lg:h-28"><img src="/grocery-hero-glass.svg" alt="Grocery pool" className="h-full w-full object-contain"/></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black capitalize text-cyan-800">{pool.cadence??'weekly'} Pool</span><StatusPill status={pool.status}/><span className="ml-auto text-xs font-bold text-slate-500 md:hidden">{itemCount} item{itemCount===1?'':'s'}</span></div><h3 className="mt-2 text-lg font-black leading-tight sm:text-xl lg:text-2xl">{pool.title}</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div className="glass-inset rounded-xl p-2.5"><span className="block text-[9px] font-black uppercase tracking-wide text-sky-700">Families joined</span><b className="mt-1 block text-base">{stats.joined}</b></div><div className="glass-inset rounded-xl p-2.5"><span className="block text-[9px] font-black uppercase tracking-wide text-emerald-700">Saving potential</span><b className="mt-1 block text-base text-emerald-800">{taka(stats.savingPotential)}</b></div><div className="glass-inset rounded-xl p-2.5"><span className="block text-[9px] font-black uppercase tracking-wide text-sky-700">Commit by</span><b className="mt-1 block text-sm">{shortDate(pool.commitment_closes_at)}</b></div><div className="glass-inset rounded-xl p-2.5"><span className="block text-[9px] font-black uppercase tracking-wide text-sky-700">Fulfilment target</span><b className="mt-1 block text-sm">{shortDate(pool.pickup_at)}</b></div></div></div><div className="flex flex-col gap-2 md:items-end"><span className="hidden text-sm font-bold text-slate-600 md:block">{itemCount} item{itemCount===1?'':'s'}</span><Link href={`/pool#pool-${pool.id}`} className="glass-primary inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-sky-400 to-blue-600 px-5 font-black text-white">Open pool</Link></div></div></article>})}</div>:<div className={`${glass} rounded-[26px] p-8 text-center`}><h3 className="text-2xl font-black">The next weekly or monthly pool will appear here.</h3></div>}</section>

    <section className="grid gap-3 lg:grid-cols-[.9fr_1.1fr]"><div className={`${glass} rounded-[24px] p-5`}><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">Next fulfilment</div>{readyOrder?<><h2 className="mt-2 text-xl font-black">{readyOrder.order_code}</h2>{(readyOrder as any).fulfillment_method==='home_delivery'?<p className="mt-2 text-sm text-slate-600"><b>Home delivery · {taka((readyOrder as any).delivery_fee??0)}</b><br/>{(readyOrder as any).delivery_address}</p>:<p className="mt-2 text-sm text-slate-600"><b>FREE community collection</b><br/>{(readyOrder.pickup_points as any)?.name}<br/>{(readyOrder.pickup_points as any)?.address}</p>}<Link className="glass-secondary mt-4 inline-flex rounded-xl px-4 py-2 font-bold" href="/orders">Order details</Link></>:<><h2 className="mt-2 text-xl font-black">Nothing ready yet</h2><p className="mt-2 text-sm text-slate-600">When an order is ready for collection or home delivery, the details will appear here.</p></>}</div><div className={`${glass} rounded-[24px] p-5`}><div className="text-[11px] font-black uppercase tracking-wide text-sky-700">How 2-TAKA-R-BAZAR works</div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[['1','Commit','Choose items and quantities while the pool is open.'],['2','Confirm','Confirm the final product price and choose FREE pickup or home delivery.'],['3','Receive & save','Collect or receive the order, then product savings are verified.']].map(([n,title,text])=><div key={n} className="glass-inset rounded-2xl p-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-blue-600 text-sm font-black text-white">{n}</div><div className="mt-3 font-black">{title}</div><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>)}</div></div></section>
  </div></AppShell>
}
