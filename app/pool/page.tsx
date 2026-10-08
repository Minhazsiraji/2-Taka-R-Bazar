import { PriceComparison } from '@/components/price-comparison'
import { AppShell } from '@/components/app-shell'
import { ProductImage } from '@/components/product-image'
import { StatusPill } from '@/components/status-pill'
import { SubmitButton } from '@/components/submit-button'
import { PriceTargetProgress } from '@/components/price-target-progress'
import { ShareUnlockButton } from '@/components/share-unlock-button'
import { commitToPool, submitPoolItemReview, submitPoolReview, togglePoolItemLove, togglePoolLove } from '@/app/actions/customer'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'
const activeStatuses=['open','pricing','final_price','confirmation','ordered','ready_for_pickup']
const stageLabel=(status:string)=>status==='ready_for_pickup'?'ready for fulfilment':status.replaceAll('_',' ')

function ratingSummary(rows:any[]){
  if(!rows.length)return {avg:0,count:0}
  return {avg:rows.reduce((s,r)=>s+Number(r.rating),0)/rows.length,count:rows.length}
}

function Stars({value}:{value:number}){
  return <span className="font-black text-amber-500" aria-label={value.toFixed(1)+' out of 5 stars'}>★ {value?value.toFixed(1):'—'}</span>
}

export default async function PoolPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}) {
  const {user,profile,roles,supabase}=await requireOnboardedUser()
  const {error,notice}=await searchParams
  const {data:pools}=await supabase.from('pools').select('*').eq('community_id',profile.community_id).in('status',activeStatuses).order('created_at',{ascending:false})
  const poolIds=(pools??[]).map((p:any)=>p.id)
  let items:any[]=[]
  const commitments=new Map<string,any>()
  const demand=new Map<string,number>()
  const itemHouseholds=new Map<string,number>()
  const participation=new Map<string,{joined:number;units:number}>()
  const unlockByItem=new Map<string,any>()

  if(poolIds.length){
    const [itemResult,commitmentResult,...statsResults]=await Promise.all([
      supabase.from('pool_items').select('*,products(id,name,brand,category,package_size,unit,image_url,source_type)').in('pool_id',poolIds).eq('active',true).order('created_at'),
      supabase.from('commitments').select('*').eq('customer_id',user.id),
      ...poolIds.flatMap(poolId=>[
        supabase.rpc('get_pool_demand',{p_pool_id:poolId}),
        supabase.rpc('get_pool_participation',{p_pool_id:poolId}),
      ]),
    ])
    items=(itemResult as any).data??[]
    ;(((commitmentResult as any).data)??[]).forEach((c:any)=>commitments.set(c.pool_item_id,c))
    poolIds.forEach((poolId,index)=>{
      const demandResult:any=statsResults[index*2]
      const participationResult:any=statsResults[index*2+1]
      ;(demandResult?.data??[]).forEach((row:any)=>{
        demand.set(row.pool_item_id,Number(row.total_quantity))
        itemHouseholds.set(row.pool_item_id,Number(row.household_count))
      })
      const pr=participationResult?.data?.[0]
      participation.set(poolId,{joined:Number(pr?.joined_households??0),units:Number(pr?.total_committed_units??0)})
    })
    const unlockResults=await Promise.all(poolIds.map(poolId=>supabase.rpc('get_pool_price_unlocks',{p_pool_id:poolId})))
    unlockResults.forEach(result=>(result.data??[]).forEach((row:any)=>unlockByItem.set(row.pool_item_id,row)))
  }

  const itemIds=items.map((i:any)=>i.id)
  let poolLoves:any[]=[]
  let itemLoves:any[]=[]
  let poolReviews:any[]=[]
  let itemReviews:any[]=[]
  let completedPoolIds=new Set<string>()
  let completedItemIds=new Set<string>()

  if(poolIds.length){
    const [pl,pr,completedOrders]=await Promise.all([
      supabase.from('pool_loves').select('pool_id,user_id').in('pool_id',poolIds),
      supabase.from('pool_reviews').select('pool_id,user_id,rating,comment,created_at').in('pool_id',poolIds).order('created_at',{ascending:false}),
      supabase.from('orders').select('id,pool_id').eq('customer_id',user.id).eq('status','completed').in('pool_id',poolIds),
    ])
    poolLoves=pl.data??[]
    poolReviews=pr.data??[]
    const completed=completedOrders.data??[]
    completedPoolIds=new Set(completed.map((o:any)=>o.pool_id))
    const completedOrderIds=completed.map((o:any)=>o.id)
    if(completedOrderIds.length){
      const {data}=await supabase.from('order_items').select('pool_item_id').in('order_id',completedOrderIds)
      completedItemIds=new Set((data??[]).map((x:any)=>x.pool_item_id))
    }
  }

  if(itemIds.length){
    const [il,ir]=await Promise.all([
      supabase.from('pool_item_loves').select('pool_item_id,user_id').in('pool_item_id',itemIds),
      supabase.from('pool_item_reviews').select('pool_item_id,user_id,rating,comment,created_at').in('pool_item_id',itemIds).order('created_at',{ascending:false}),
    ])
    itemLoves=il.data??[]
    itemReviews=ir.data??[]
  }

  const visiblePools=(pools??[]).filter((pool:any)=>{
    if(!pool.is_paused)return true
    return items.some((item:any)=>item.pool_id===pool.id&&commitments.has(item.id))
  })

  return <AppShell roles={roles}>
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Community buying</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Available pools</h1>
          <p className="muted mt-1 text-sm">Choose essentials, watch the price fall as community volume grows.</p>
        </div>
        <span className="cx-compact-chip">📍 {profile.household_name}</span>
      </section>

      {error&&<div className="error">{error}</div>}
      {notice&&<div className="success">{notice}</div>}

      {!visiblePools.length
        ? <div className="card p-6 text-center"><h2 className="text-xl font-black">No active pool right now</h2><p className="muted mt-2">The next community buying opportunity will appear here as soon as it opens.</p></div>
        : visiblePools.map((pool:any)=>{
          const poolItems=items.filter((item:any)=>item.pool_id===pool.id)
          const joined=participation.get(pool.id)??{joined:0,units:0}
          const likes=poolLoves.filter((x:any)=>x.pool_id===pool.id)
          const loved=likes.some((x:any)=>x.user_id===user.id)
          const reviews=poolReviews.filter((x:any)=>x.pool_id===pool.id)
          const rs=ratingSummary(reviews)
          const ownReview=reviews.find((x:any)=>x.user_id===user.id)
          const benchmarkBasket=poolItems.reduce((s:number,i:any)=>s+Number(i.benchmark_price_snapshot||0),0)
          const allUnlocked=poolItems.length>0&&poolItems.every((i:any)=>Number(unlockByItem.get(i.id)?.unlocked_price||0)>0)
          const unlockedBasket=poolItems.reduce((s:number,i:any)=>s+Number(unlockByItem.get(i.id)?.unlocked_price||0),0)
          const potentialBasket=allUnlocked?Math.max(0,benchmarkBasket-unlockedBasket):0

          return <section id={'pool-'+pool.id} key={pool.id} className="grid min-w-0 gap-3 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
            <div className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip capitalize">{pool.cadence??'weekly'} pool</span>
                    <StatusPill status={pool.is_paused?'paused':pool.status}/>
                    {rs.count>0&&<span className="chip"><Stars value={rs.avg}/> · {rs.count}</span>}
                  </div>
                  <h2 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{pool.title}</h2>
                  <p className="muted mt-1 text-sm">Fulfilment target · {shortDate(pool.pickup_at)}</p>
                </div>

                <form action={togglePoolLove}>
                  <input type="hidden" name="pool_id" value={pool.id}/>
                  <button className={'btn-secondary min-h-10 px-3 text-sm '+(loved?'border-rose-200 text-rose-700':'')}>{loved?'♥':'♡'} {likes.length}</button>
                </form>
              </div>

              <div className="cx-compact-strip mt-3">
                <span className="cx-compact-chip">👥 {joined.joined} household{joined.joined===1?'':'s'}</span>
                <span className="cx-compact-chip">📦 {joined.units} units</span>
                {allUnlocked&&<span className="cx-compact-chip">Basket max {taka(unlockedBasket)}</span>}
                {allUnlocked&&potentialBasket>0&&<span className="cx-compact-chip text-emerald-700">↓ Save {taka(potentialBasket)} on 1 of each</span>}
              </div>

              {pool.is_paused&&<div className="notice mt-3 text-sm">This pool is temporarily paused. Existing commitments are safe; changes reopen when Operations resumes the pool.</div>}
            </div>

            <div className="grid gap-3">
              {poolItems.map((item:any)=>{
                const product=item.products
                const own=commitments.get(item.id)
                const final=Number(item.final_customer_price||0)
                const bench=Number(item.benchmark_price_snapshot||0)
                const unlock=unlockByItem.get(item.id)??{}
                const currentQty=Number(unlock.current_quantity??demand.get(item.id)??0)
                const unlocked=Number(unlock.unlocked_price||0)
                const unlockedThreshold=Number(unlock.unlocked_threshold||0)
                const nextThreshold=Number(unlock.next_threshold||0)
                const nextPrice=Number(unlock.next_price||0)
                const unitsNeeded=Number(unlock.units_needed||0)
                const householdCount=Number(itemHouseholds.get(item.id)??0)
                const currentPrice=final||unlocked
                const currentSaving=currentPrice>0?Math.max(0,bench-currentPrice):0
                const ilikes=itemLoves.filter((x:any)=>x.pool_item_id===item.id)
                const iloved=ilikes.some((x:any)=>x.user_id===user.id)
                const irevs=itemReviews.filter((x:any)=>x.pool_item_id===item.id)
                const irs=ratingSummary(irevs)
                const ownItemReview=irevs.find((x:any)=>x.user_id===user.id)

                return <article className="card cx-compact-product min-w-0 p-4 sm:p-5" key={item.id}>
                  <div className="cx-product-heading">
                    <ProductImage src={product?.image_url} name={product?.name} className="cx-product-photo"/>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{product?.category}</p>
                          <h3 className="mt-1 text-base font-black leading-tight sm:text-lg">{product?.name}</h3>
                          <p className="muted mt-1 text-xs">{product?.brand} · {product?.package_size}</p>
                        </div>
                        <form action={togglePoolItemLove}>
                          <input type="hidden" name="pool_item_id" value={item.id}/>
                          <button aria-label="Love this item" className={'inline-flex h-9 min-w-9 items-center justify-center rounded-full border bg-white/60 px-2 text-sm font-black shadow-sm '+(iloved?'border-rose-200 text-rose-700':'border-slate-200 text-slate-600')}>{iloved?'♥':'♡'}{ilikes.length>0&&<span className="ml-1 text-[10px]">{ilikes.length}</span>}</button>
                        </form>
                      </div>

                      <div className="cx-compact-strip mt-2">
                        <span className="cx-compact-chip">{householdCount} household{householdCount===1?'':'s'}</span>
                        <span className="cx-compact-chip">{currentQty} units</span>
                        {irs.count>0&&<span className="cx-compact-chip"><Stars value={irs.avg}/></span>}
                      </div>
                    </div>
                  </div>

                  <PriceComparison market={taka(bench)} current={currentPrice>0?taka(currentPrice):'Building'} currentLabel={final?'Final price':'Current max'} saving={currentPrice>0?taka(currentSaving):'—'}/>

                  <PriceTargetProgress
                    currentQuantity={currentQty}
                    households={householdCount}
                    unlockedThreshold={unlockedThreshold}
                    unlockedPrice={unlocked}
                    nextThreshold={nextThreshold}
                    nextPrice={nextPrice}
                    benchmarkPrice={bench}
                  />

                  {nextThreshold>0&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/55 p-3">
                    <div>
                      <div className="text-xs font-black text-slate-700">{unitsNeeded} more unit{unitsNeeded===1?'':'s'} can unlock {taka(nextPrice)}</div>
                      <div className="muted mt-1 text-[11px]">Share the target with neighbours; quantity still comes from real commitments.</div>
                    </div>
                    <ShareUnlockButton
                      title={String(product?.name??'2-TAKA-R-BAZAR pool')}
                      text={unitsNeeded+' more units can unlock '+taka(nextPrice)+' for '+String(product?.name??'this item')+'.'}
                      label="Share target"
                    />
                  </div>}

                  {own&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50/65 p-3">
                    <div><div className="text-[10px] font-black uppercase tracking-wide text-sky-700">Your commitment</div><b>{own.quantity} unit{Number(own.quantity)===1?'':'s'}</b></div>
                    <StatusPill status={own.status}/>
                  </div>}

                  {pool.status==='open'&&!pool.is_paused
                    ? <form action={commitToPool} className="cx-quantity-form">
                        <input type="hidden" name="pool_item_id" value={item.id}/>
                        <label><span className="label">Quantity</span><input className="input" type="number" name="quantity" min={item.min_quantity} max={item.max_quantity} defaultValue={own?.quantity??1} required/></label>
                        <SubmitButton className="w-full sm:w-auto">{own?'Update quantity':'Commit'}</SubmitButton>
                      </form>
                    : <p className="muted mt-3 border-t border-slate-200 pt-3 text-sm">{pool.is_paused?'Commitment changes are paused.':'Commitments are closed while this pool is in '+stageLabel(String(pool.status))+'.'}</p>}

                  <details className="mt-3 border-t border-slate-200 pt-3">
                    <summary className="cursor-pointer text-sm font-black text-slate-600">Price promise, reviews & details</summary>
                    <div className="mt-3 grid gap-3">
                      <p className="muted text-sm leading-6">{unlocked
                        ? <>Your unlocked maximum is <b className="text-slate-900">{taka(unlocked)}</b>. Final supplier negotiation may improve it, but it will not increase.</>
                        : nextThreshold
                          ? <>First price unlocks at <b className="text-slate-900">{nextThreshold} units</b>.</>
                          : <>No planning tier is currently available.</>}</p>

                      {irevs.filter((r:any)=>r.comment).slice(0,2).map((r:any,index:number)=><blockquote key={String(r.user_id)+'-'+index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm"><b className="text-amber-700">★ {r.rating}/5</b> <span className="text-slate-700">“{r.comment}”</span></blockquote>)}

                      {completedItemIds.has(item.id)&&<form action={submitPoolItemReview} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <input type="hidden" name="pool_item_id" value={item.id}/>
                        <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                          <select className="input" name="rating" defaultValue={ownItemReview?.rating??5} required>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n===1?'':'s'}</option>)}</select>
                          <input className="input" name="comment" maxLength={800} defaultValue={ownItemReview?.comment??''} placeholder="Review this item"/>
                        </div>
                        <SubmitButton className="btn-secondary">{ownItemReview?'Update item review':'Review item'}</SubmitButton>
                      </form>}
                    </div>
                  </details>
                </article>
              })}

              {poolItems.length===0&&<div className="card"><p className="muted">No items have been added to this pool yet.</p></div>}
            </div>

            {(reviews.filter((r:any)=>r.comment).length>0||completedPoolIds.has(pool.id))&&<details className="card p-4">
              <summary className="cursor-pointer text-sm font-black">Pool feedback</summary>
              <div className="mt-3 grid gap-3">
                {reviews.filter((r:any)=>r.comment).slice(0,2).map((r:any,index:number)=><blockquote key={String(r.user_id)+'-'+index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm"><div className="font-black text-amber-500">★ {r.rating}/5</div><p className="mt-1 text-slate-700">“{r.comment}”</p><p className="mt-1 text-xs font-bold text-slate-500">Verified buyer</p></blockquote>)}

                {completedPoolIds.has(pool.id)&&<form action={submitPoolReview} className="grid gap-2 sm:grid-cols-[140px_1fr_auto] sm:items-end">
                  <input type="hidden" name="pool_id" value={pool.id}/>
                  <label><span className="label">Rate pool</span><select className="input" name="rating" defaultValue={ownReview?.rating??5} required>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n===1?'':'s'}</option>)}</select></label>
                  <label><span className="label">Review</span><input className="input" name="comment" maxLength={800} defaultValue={ownReview?.comment??''} placeholder="What worked well?"/></label>
                  <SubmitButton>{ownReview?'Update review':'Post review'}</SubmitButton>
                </form>}
              </div>
            </details>}
          </section>
        })}

      <div className="card p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div><div className="card-title">Price promise</div><p className="muted mt-1 text-sm leading-6"><b className="text-slate-900">An unlocked maximum price cannot increase.</b> Final supplier negotiation can only keep it or improve it. Delivery stays separate from product savings.</p></div>
        </div>
      </div>
    </div>
  </AppShell>
}
