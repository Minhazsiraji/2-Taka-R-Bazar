import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { ShareUnlockButton } from '@/components/share-unlock-button'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

type PoolCardStats={
  joined:number
  units:number
  savingPotential:number
  bestNext:null|{
    current:number
    target:number
    remaining:number
    price:number
    product:string
    progress:number
  }
}

type Mission={
  kind:'pool'|'group'
  title:string
  subtitle:string
  href:string
  current:number
  target:number
  remaining:number
  price:number
  progress:number
  unitLabel:string
}

export default async function HomePage(){
  const {user,profile,roles,supabase}=await requireOnboardedUser()
  const [
    {data:savingsSummaryRows},
    {data:activePools},
    {data:readyOrder},
    {data:community},
    {data:summaryRows},
    {data:groupDeals},
  ]=await Promise.all([
    supabase.rpc('get_my_savings_summary'),
    supabase.from('pools')
      .select('id,title,status,is_paused,pickup_at,commitment_closes_at,cadence,pool_items(id,benchmark_price_snapshot,products(name))')
      .eq('community_id',profile.community_id)
      .in('status',['open','pricing','final_price','confirmation','ordered','ready_for_pickup'])
      .order('created_at',{ascending:false})
      .limit(6),
    supabase.from('orders')
      .select('id,order_code,status,fulfillment_method,delivery_address,delivery_fee,pickup_points(name,address,google_maps_url)')
      .eq('customer_id',user.id)
      .eq('status','ready_for_pickup')
      .order('ready_at',{ascending:false})
      .limit(1)
      .maybeSingle(),
    supabase.from('communities').select('id,name').eq('id',profile.community_id).maybeSingle(),
    supabase.rpc('get_my_community_summary'),
    supabase.rpc('get_my_group_deals'),
  ])

  const savingsSummary=savingsSummaryRows?.[0] as any
  const lifetime=Number(savingsSummary?.lifetime_verified_saving??0)
  const thisMonth=Number(savingsSummary?.month_verified_saving??0)
  const summary=summaryRows?.[0] as any
  const pools=(activePools??[]).filter((pool:any)=>!pool.is_paused)

  const poolStatsEntries=await Promise.all(pools.map(async(pool:any)=>{
    const [participationResult,unlockResult]=await Promise.all([
      supabase.rpc('get_pool_participation',{p_pool_id:pool.id}),
      supabase.rpc('get_pool_price_unlocks',{p_pool_id:pool.id}),
    ])

    const joined=Number(participationResult.data?.[0]?.joined_households??0)
    const units=Number(participationResult.data?.[0]?.total_committed_units??0)
    const itemsById=new Map((pool.pool_items??[]).map((item:any)=>[item.id,item]))

    let savingPotential=0
    let bestNext:PoolCardStats['bestNext']=null

    for(const row of unlockResult.data??[]){
      const item:any=itemsById.get(row.pool_item_id)
      const benchmark=Number(item?.benchmark_price_snapshot??0)
      const unlocked=Number(row.unlocked_price??0)
      const quantity=Number(row.current_quantity??0)
      if(unlocked>0)savingPotential+=Math.max(0,benchmark-unlocked)*quantity

      const target=Number(row.next_threshold??0)
      const price=Number(row.next_price??0)
      if(target>0&&price>0){
        const current=Math.min(quantity,target)
        const remaining=Math.max(target-current,0)
        const progress=target?current/target:0
        const candidate={
          current,target,remaining,price,
          product:String(item?.products?.name??'Pool item'),
          progress,
        }
        if(!bestNext||candidate.progress>bestNext.progress||(candidate.progress===bestNext.progress&&candidate.remaining<bestNext.remaining)){
          bestNext=candidate
        }
      }
    }

    return [pool.id,{joined,units,savingPotential,bestNext} satisfies PoolCardStats] as const
  }))

  const poolStats=new Map<string,PoolCardStats>(poolStatsEntries)

  const missions:Mission[]=[]
  for(const pool of pools){
    const stats=poolStats.get(pool.id)
    if(stats?.bestNext){
      missions.push({
        kind:'pool',
        title:pool.title,
        subtitle:stats.bestNext.product,
        href:'/pool#pool-'+pool.id,
        current:stats.bestNext.current,
        target:stats.bestNext.target,
        remaining:stats.bestNext.remaining,
        price:stats.bestNext.price,
        progress:stats.bestNext.progress,
        unitLabel:'units',
      })
    }
  }

  const openDeals=(groupDeals??[]).filter((deal:any)=>deal.status==='open')
  for(const deal of openDeals){
    const target=Number(deal.next_threshold??0)
    const price=Number(deal.next_price??0)
    if(target<=0||price<=0)continue
    const qualified=Number(deal.buyer_count??0)
    const joined=Number(deal.my_quantity??0)>0
    const circleMembers=Number(deal.circle_members??0)
    const current=Math.min(qualified===0&&joined?circleMembers:qualified,target)
    missions.push({
      kind:'group',
      title:String(deal.product_name??deal.title),
      subtitle:String(deal.title),
      href:'/group-deals',
      current,
      target,
      remaining:Math.max(target-current,0),
      price,
      progress:target?current/target:0,
      unitLabel:'buyers',
    })
  }

  missions.sort((a,b)=>b.progress-a.progress||a.remaining-b.remaining)
  const mission=missions[0]??null
  const missionPercent=mission?Math.max(0,Math.min(100,Math.round(mission.progress*100))):0

  return <AppShell roles={roles}>
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <section className="cx-savings-hero p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <div className="cx-compact-strip">
              <span className="cx-compact-chip">📍 {community?.name??'Your community'}</span>
              <span className="cx-compact-chip">👥 {summary?.household_count??0} households</span>
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-cyan-700">Savings pulse</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">Your community is buying smarter.</h1>
            <p className="muted mt-2 max-w-2xl text-sm">See what is close to a lower price, commit only what you need, and keep delivery separate from product savings.</p>
          </div>

          <Link href="/savings" className="glass-inset min-w-[190px] rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-700">You saved this month</div>
            <div className="mt-1 text-3xl font-black text-emerald-700">{taka(thisMonth)}</div>
            <div className="mt-1 text-xs font-bold text-slate-500">{taka(lifetime)} lifetime verified saving →</div>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md">
          <Link href="/pool" className="glass-secondary flex min-h-12 items-center justify-between rounded-2xl px-4 font-black">
            <span>Pools</span><span className="chip">{pools.length} open</span>
          </Link>
          <Link href="/group-deals" className="glass-secondary flex min-h-12 items-center justify-between rounded-2xl px-4 font-black">
            <span>Group Deals</span><span className="chip">{openDeals.length} open</span>
          </Link>
        </div>
      </section>

      {mission&&<section className="cx-mission-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Best next saving move</p>
            <h2 className="mt-1 text-lg font-black sm:text-xl">{mission.title}</h2>
            <p className="muted mt-1 text-xs sm:text-sm">{mission.subtitle}</p>
          </div>
          <span className="chip">{mission.kind==='group'?'Neighbour deal':'Pool target'}</span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xl font-black">{mission.current} / {mission.target} {mission.unitLabel}</div>
            <div className="mt-1 text-sm font-black text-emerald-700">{mission.remaining} more → {taka(mission.price)}</div>
          </div>
          <div className="text-sm font-black text-slate-500">{missionPercent}%</div>
        </div>

        <div className="price-target-track mt-2 h-3 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={missionPercent}>
          <div className="price-target-fill h-full transition-[width] duration-500" style={{width:String(missionPercent)+'%'}}/>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={mission.href} className="btn-primary min-h-10 px-4">Open opportunity</Link>
          <ShareUnlockButton
            title="2-TAKA-R-BAZAR saving target"
            text={mission.kind==='group'
              ? mission.remaining+' more neighbours can unlock '+taka(mission.price)+' for '+mission.title+'.'
              : mission.remaining+' more units can unlock '+taka(mission.price)+' for '+mission.title+'.'}
            label={mission.kind==='group'?'Invite neighbours':'Share with community'}
          />
        </div>
      </section>}

      {readyOrder&&<section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="card-title">Ready now</div>
            <h2 className="mt-1 text-lg font-black">{readyOrder.order_code}</h2>
            <p className="muted mt-1 text-sm">{(readyOrder as any).fulfillment_method==='home_delivery'
              ? 'Home delivery · '+taka((readyOrder as any).delivery_fee??0)
              : 'FREE community pickup · '+((readyOrder.pickup_points as any)?.name??'Pickup point')}</p>
          </div>
          <Link className="btn-primary min-h-10 px-4" href="/orders">Track order</Link>
        </div>
      </section>}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-sky-700">Shop now</p>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">Community pools</h2>
          </div>
          <Link href="/pool" className="text-sm font-black text-cyan-700">View all →</Link>
        </div>

        {pools.length?<div className="grid gap-3 lg:grid-cols-2">{pools.slice(0,4).map((pool:any)=>{
          const stats=poolStats.get(pool.id)??{joined:0,units:0,savingPotential:0,bestNext:null}
          const itemCount=(pool.pool_items??[]).length
          return <article key={pool.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap gap-2"><span className="chip capitalize">{pool.cadence??'weekly'} pool</span><StatusPill status={pool.status}/></div>
                <h3 className="mt-2 text-lg font-black leading-tight">{pool.title}</h3>
                <p className="muted mt-1 text-xs">{itemCount} item{itemCount===1?'':'s'} · fulfilment {shortDate(pool.pickup_at)}</p>
              </div>
              <Link href={'/pool#pool-'+pool.id} className="btn-secondary min-h-10 px-3 text-sm">Open</Link>
            </div>

            <div className="cx-compact-strip mt-3">
              <span className="cx-compact-chip">👥 {stats.joined} households</span>
              <span className="cx-compact-chip">📦 {stats.units} units</span>
              {stats.savingPotential>0&&<span className="cx-compact-chip text-emerald-700">↓ {taka(stats.savingPotential)} current saving</span>}
            </div>

            {stats.bestNext&&<div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/55 p-3">
              <div className="flex items-center justify-between gap-2 text-xs font-black">
                <span>{stats.bestNext.current}/{stats.bestNext.target} units</span>
                <span className="text-emerald-700">{stats.bestNext.remaining} more → {taka(stats.bestNext.price)}</span>
              </div>
              <div className="price-target-track mt-2 h-2 overflow-hidden"><div className="price-target-fill h-full" style={{width:String(Math.min(100,Math.round(stats.bestNext.progress*100)))+'%'}}/></div>
            </div>}
          </article>
        })}</div>:<div className="card p-6 text-center"><h3 className="text-lg font-black">No open pool right now</h3><p className="muted mt-2 text-sm">The next community buying opportunity will appear here.</p></div>}
      </section>

      {openDeals.length>0&&<section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-sky-700">Nearby</p><h2 className="mt-1 text-xl font-black sm:text-2xl">Neighbour deals</h2></div>
          <Link href="/group-deals" className="text-sm font-black text-cyan-700">View all →</Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">{openDeals.slice(0,2).map((deal:any)=>{
          const price=Number(deal.current_price??0)
          const next=Number(deal.next_threshold??0)
          const buyers=Number(deal.buyer_count??0)
          const joined=Number(deal.my_quantity??0)>0
          const progressBuyers=Math.min(buyers===0&&joined?Number(deal.circle_members??0):buyers,next||1)
          const remaining=next?Math.max(next-progressBuyers,0):0
          return <article key={deal.deal_id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="text-lg font-black">{deal.product_name}</h3><p className="muted mt-1 text-xs">{deal.package_size} · closes {shortDate(deal.closes_at)}</p></div>
              <span className="chip">{joined?'Joined':'Open'}</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div><span className="muted text-xs">Current price</span><div className="text-xl font-black text-emerald-700">{price?taka(price):'Unlocking'}</div></div>
              {next>0&&<div className="text-right"><span className="muted text-xs">Next</span><div className="font-black">{progressBuyers}/{next} buyers</div><div className="text-xs font-black text-emerald-700">{remaining} more → {taka(Number(deal.next_price))}</div></div>}
            </div>
          </article>
        })}</div>
      </section>}
    </div>
  </AppShell>
}
