import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { SubmitButton } from '@/components/submit-button'
import { PriceTargetProgress } from '@/components/price-target-progress'
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
  return <span className="font-black text-amber-500" aria-label={`${value.toFixed(1)} out of 5 stars`}>★ {value?value.toFixed(1):'—'}</span>
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
      ;(demandResult?.data??[]).forEach((row:any)=>{demand.set(row.pool_item_id,Number(row.total_quantity));itemHouseholds.set(row.pool_item_id,Number(row.household_count))})
      const pr=participationResult?.data?.[0]
      participation.set(poolId,{joined:Number(pr?.joined_households??0),units:Number(pr?.total_committed_units??0)})
    })
    const unlockResults=await Promise.all(poolIds.map(poolId=>supabase.rpc('get_pool_price_unlocks',{p_pool_id:poolId})))
    unlockResults.forEach(result=>(result.data??[]).forEach((row:any)=>unlockByItem.set(row.pool_item_id,row)))
  }

  const itemIds=items.map((i:any)=>i.id)
  let poolLoves:any[]=[]; let itemLoves:any[]=[]; let poolReviews:any[]=[]; let itemReviews:any[]=[]; let completedPoolIds=new Set<string>(); let completedItemIds=new Set<string>()
  if(poolIds.length){
    const [pl,pr,completedOrders]=await Promise.all([
      supabase.from('pool_loves').select('pool_id,user_id').in('pool_id',poolIds),
      supabase.from('pool_reviews').select('pool_id,user_id,rating,comment,created_at').in('pool_id',poolIds).order('created_at',{ascending:false}),
      supabase.from('orders').select('id,pool_id').eq('customer_id',user.id).eq('status','completed').in('pool_id',poolIds),
    ])
    poolLoves=pl.data??[];poolReviews=pr.data??[]
    const completed=completedOrders.data??[]
    completedPoolIds=new Set(completed.map((o:any)=>o.pool_id))
    const completedOrderIds=completed.map((o:any)=>o.id)
    if(completedOrderIds.length){const {data}=await supabase.from('order_items').select('pool_item_id').in('order_id',completedOrderIds);completedItemIds=new Set((data??[]).map((x:any)=>x.pool_item_id))}
  }
  if(itemIds.length){
    const [il,ir]=await Promise.all([
      supabase.from('pool_item_loves').select('pool_item_id,user_id').in('pool_item_id',itemIds),
      supabase.from('pool_item_reviews').select('pool_item_id,user_id,rating,comment,created_at').in('pool_item_id',itemIds).order('created_at',{ascending:false}),
    ])
    itemLoves=il.data??[];itemReviews=ir.data??[]
  }

  const visiblePools=(pools??[]).filter((pool:any)=>{
    if(!pool.is_paused)return true
    return items.some((item:any)=>item.pool_id===pool.id&&commitments.has(item.id))
  })

  return <AppShell roles={roles}>
    <div className="grid min-w-0 gap-5 sm:gap-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Community buying</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Available pools</h1>
        <p className="muted mt-1">Weekly and monthly buying opportunities selected for {profile.household_name}&apos;s community.</p>
      </section>

      {error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}

      {!visiblePools.length?<div className="card p-5"><div className="card-title">Pool status</div><h2 className="mt-2 text-xl font-black">No active pool right now</h2><p className="muted mt-2">The next community buying pool will appear here as soon as it opens.</p></div>:visiblePools.map((pool:any)=>{
        const poolItems=items.filter((item:any)=>item.pool_id===pool.id)
        const joined=participation.get(pool.id)??{joined:0,units:0}
        const likes=poolLoves.filter((x:any)=>x.pool_id===pool.id);const loved=likes.some((x:any)=>x.user_id===user.id)
        const reviews=poolReviews.filter((x:any)=>x.pool_id===pool.id);const rs=ratingSummary(reviews);const ownReview=reviews.find((x:any)=>x.user_id===user.id)
        const benchmarkBasket=poolItems.reduce((s:number,i:any)=>s+Number(i.benchmark_price_snapshot||0),0)
        const allUnlocked=poolItems.length>0&&poolItems.every((i:any)=>Number(unlockByItem.get(i.id)?.unlocked_price||0)>0)
        const unlockedBasket=poolItems.reduce((s:number,i:any)=>s+Number(unlockByItem.get(i.id)?.unlocked_price||0),0)
        const potentialBasket=allUnlocked?Math.max(0,benchmarkBasket-unlockedBasket):0
        const communityPotential=poolItems.reduce((s:number,i:any)=>{const b=Number(i.benchmark_price_snapshot||0),u=Number(unlockByItem.get(i.id)?.unlocked_price||0);return s+(u>0?Math.max(0,b-u)*(demand.get(i.id)??0):0)},0)
        return <section id={`pool-${pool.id}`} key={pool.id} className="grid min-w-0 gap-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0 sm:gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="flex flex-wrap gap-2"><span className="chip capitalize">{pool.cadence??'weekly'} pool</span><StatusPill status={pool.is_paused?'paused':pool.status}/></div><h2 className="mt-2 text-xl font-black sm:text-2xl">{pool.title}</h2><p className="muted mt-1">Fulfilment target · {shortDate(pool.pickup_at)}</p>{pool.is_paused&&<p className="mt-2 text-sm font-semibold">This pool is temporarily paused. Your existing commitment is safe; new commitment changes will reopen after operations resumes it.</p>}</div>
            <form action={togglePoolLove}><input type="hidden" name="pool_id" value={pool.id}/><button className={`btn-secondary min-h-10 px-3 text-sm ${loved?'border-rose-200 text-rose-700':''}`}>{loved?'♥ Loved':'♡ Love'} · {likes.length}</button></form>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ['Market basket',taka(benchmarkBasket),'1 of each SKU'],
              ['Current unlocked basket',allUnlocked?taka(unlockedBasket):'Building demand','Maximum price at current unlocked tiers'],
              ['Potential basket saving',allUnlocked?taka(potentialBasket):'Pending','vs approved benchmark at current unlock'],
              ['Pool-wide potential',taka(communityPotential),'based on current commitments and unlocked prices'],
              ['Joined',`${joined.joined} household${joined.joined===1?'':'s'}`,`${joined.units} committed units`],
            ].map(([label,value,sub])=><div className="card p-4" key={String(label)}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div><p className="muted mt-2">{sub}</p></div>)}
            <div className="card p-4"><div className="card-title">Pool rating</div><div className="mt-2 text-2xl font-black"><Stars value={rs.avg}/></div><p className="muted mt-2">{rs.count} verified review{rs.count===1?'':'s'}</p></div>
          </div>
          {reviews.filter((r:any)=>r.comment).length>0&&<div><div className="mb-3"><div className="card-title">Community feedback</div><h3 className="section-title">Verified buyer reviews</h3></div><div className="grid gap-3 md:grid-cols-2">{reviews.filter((r:any)=>r.comment).slice(0,2).map((r:any,index:number)=><blockquote key={`${r.user_id}-${index}`} className="card p-4 text-sm"><div className="font-black text-amber-500">★ {r.rating}/5</div><p className="mt-2 text-slate-700">“{r.comment}”</p><p className="mt-2 text-xs font-bold text-slate-500">Verified buyer</p></blockquote>)}</div></div>}

          {completedPoolIds.has(pool.id)?<form action={submitPoolReview} className="card grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end"><input type="hidden" name="pool_id" value={pool.id}/><label><span className="label">Rate this pool</span><select className="input" name="rating" defaultValue={ownReview?.rating??5} required>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n===1?'':'s'}</option>)}</select></label><label><span className="label">Review</span><input className="input" name="comment" maxLength={800} defaultValue={ownReview?.comment??''} placeholder="What was good or could improve?"/></label><SubmitButton>{ownReview?'Update review':'Post review'}</SubmitButton></form>:<p className="text-xs font-semibold text-slate-500">Pool ratings and reviews are accepted from verified buyers after successful fulfilment.</p>}

          <div>
            <div className="mb-3"><div className="card-title">Pool items</div><h3 className="section-title">Choose what you need</h3></div>
            <div className="grid gap-4">{poolItems.map((item:any)=>{
              const product=item.products;const own=commitments.get(item.id);const final=Number(item.final_customer_price||0);const bench=Number(item.benchmark_price_snapshot||0)
              const unlock=unlockByItem.get(item.id)??{};const currentQty=Number(unlock.current_quantity??demand.get(item.id)??0);const unlocked=Number(unlock.unlocked_price||0);const unlockedThreshold=Number(unlock.unlocked_threshold||0);const nextThreshold=Number(unlock.next_threshold||0);const nextPrice=Number(unlock.next_price||0);const unitsNeeded=Number(unlock.units_needed||0)
              const householdCount=Number(itemHouseholds.get(item.id)??0)
              const unlockedSaving=unlocked>0?Math.max(0,bench-unlocked):null;const finalSaving=final>0?Math.max(0,bench-final):null
              const ilikes=itemLoves.filter((x:any)=>x.pool_item_id===item.id);const iloved=ilikes.some((x:any)=>x.user_id===user.id);const irevs=itemReviews.filter((x:any)=>x.pool_item_id===item.id);const irs=ratingSummary(irevs);const ownItemReview=irevs.find((x:any)=>x.user_id===user.id)
              return <article className="card min-w-0 p-0" key={item.id}>
                <div className="grid min-w-0 overflow-hidden lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.55fr)]">
                  <div className="min-w-0 overflow-hidden border-b border-slate-200 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                    {product?.image_url&&<div className="product-image-surface mb-4 flex aspect-[4/3] w-full min-w-0 max-w-full items-center justify-center overflow-hidden border p-2 sm:p-3" style={{borderRadius:'0.9rem',backgroundColor:'#fff'}}><img src={product.image_url} alt={`${product.name} product image`} className="block h-full w-full min-w-0 max-w-full object-contain object-center" style={{width:'100%',height:'100%',objectFit:'contain'}} loading="lazy" decoding="async"/></div>}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:flex-col"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{product?.category}</p>{product?.source_type&&product.source_type!=='SUPPLIER_POOL'&&<span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">2-TAKA-R-BAZAR PRODUCT</span>}</div><h4 className="mt-1 text-xl font-black">{product?.name}</h4><p className="muted mt-1">{product?.brand} · {product?.package_size}</p></div><div className="flex flex-wrap gap-2"><span className="chip">{householdCount} household{householdCount===1?'':'s'}</span><span className="chip">{demand.get(item.id)??0} units</span></div></div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><div><Stars value={irs.avg}/> <span className="text-xs font-semibold text-slate-500">({irs.count})</span></div><form action={togglePoolItemLove}><input type="hidden" name="pool_item_id" value={item.id}/><button className={`btn-secondary min-h-9 px-3 py-1.5 text-sm ${iloved?'border-rose-200 text-rose-700':''}`}>{iloved?'♥ Loved':'♡ Love'} · {ilikes.length}</button></form></div>
                    {own&&<div className="mt-4"><div className="card-title">Your commitment</div><div className="mt-1 flex items-center gap-2 text-sm font-black"><span>{own.quantity} unit{Number(own.quantity)===1?'':'s'}</span><StatusPill status={own.status}/></div></div>}
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="pool-price-metrics grid overflow-hidden rounded-xl border sm:grid-cols-2 xl:grid-cols-4">
                      <div className="p-3"><div className="card-title">Normal market price</div><div className="mt-1 text-xl font-black">{taka(bench)}</div><p className="mt-1 text-xs text-slate-500">Approved local benchmark</p></div>
                      <div className="border-t border-slate-200 p-3 sm:border-l sm:border-t-0"><div className="card-title">Current unlocked price</div><div className="mt-1 text-xl font-black text-emerald-800">{unlocked?taka(unlocked):'Not unlocked yet'}</div><p className="mt-1 text-xs text-slate-500">Current demand · {currentQty} unit{currentQty===1?'':'s'}</p></div>
                      <div className="border-t border-slate-200 p-3 xl:border-l xl:border-t-0"><div className="card-title">Next price unlock</div><div className="mt-1 text-xl font-black">{nextThreshold?`${nextThreshold} units → ${taka(nextPrice)}`:'Top tier reached'}</div><p className="mt-1 text-xs font-bold text-slate-600">{nextThreshold?`${unitsNeeded} more unit${unitsNeeded===1?'':'s'} needed`:'No better configured tier remains'}</p></div>
                      <div className="border-t border-slate-200 p-3 sm:border-l xl:border-t-0"><div className="card-title">{final?'Final price':'Potential saving'}</div><div className="mt-1 text-xl font-black text-emerald-700">{final?taka(final):(unlockedSaving===null?'Pending':taka(unlockedSaving))}</div><p className="mt-1 text-xs font-bold text-emerald-700">{finalSaving!==null?`Save ${taka(finalSaving)}/unit`:(unlockedSaving!==null?`Up to ${taka(unlockedSaving)}/unit at current unlock`:'First price unlock is still ahead')}</p></div>
                    </div>
                    <PriceTargetProgress currentQuantity={currentQty} households={householdCount} unlockedThreshold={unlockedThreshold} unlockedPrice={unlocked} nextThreshold={nextThreshold} nextPrice={nextPrice} benchmarkPrice={bench}/>
                    <div className="pool-price-note mt-3 rounded-xl border p-3 text-sm">{unlocked?<><b>Your unlocked maximum price is {taka(unlocked)}.</b> It can stay the same or improve after final supplier negotiation. It will not increase.</>:nextThreshold?<><b>First price unlocks at {nextThreshold} units.</b> {unitsNeeded} more unit{unitsNeeded===1?'':'s'} needed.</>:<><b>No planning price tier is available yet.</b> Operations will publish a tier before accepting demand.</>}</div>
                    {irevs.filter((r:any)=>r.comment).slice(0,2).map((r:any,index:number)=><blockquote key={`${r.user_id}-${index}`} className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm"><b className="text-amber-700">★ {r.rating}/5</b> <span className="text-slate-700">“{r.comment}”</span></blockquote>)}

                    {completedItemIds.has(item.id)&&<form action={submitPoolItemReview} className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3"><input type="hidden" name="pool_item_id" value={item.id}/><div className="grid gap-2 sm:grid-cols-[140px_1fr]"><select className="input" name="rating" defaultValue={ownItemReview?.rating??5} required>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n===1?'':'s'}</option>)}</select><input className="input" name="comment" maxLength={800} defaultValue={ownItemReview?.comment??''} placeholder="Review this item"/></div><SubmitButton className="btn-secondary">{ownItemReview?'Update item review':'Review item'}</SubmitButton></form>}

                    {pool.status==='open'&&!pool.is_paused?<form action={commitToPool} className="mt-4 grid gap-2 border-t border-slate-200 pt-4 sm:grid-cols-[minmax(0,180px)_auto] sm:items-end"><input type="hidden" name="pool_item_id" value={item.id}/><label><span className="label">Quantity</span><input className="input" type="number" name="quantity" min={item.min_quantity} max={item.max_quantity} defaultValue={own?.quantity??1} required/></label><SubmitButton className="w-full sm:w-auto">{own?'Update commitment':'I want this'}</SubmitButton></form>:<p className="muted mt-4 border-t border-slate-200 pt-4">{pool.is_paused?'Commitment changes are temporarily paused. Your existing commitment is preserved.':`Commitments are closed while this pool is in ${stageLabel(String(pool.status))}.`}</p>}
                  </div>
                </div>
              </article>
            })}{poolItems.length===0&&<div className="card"><p className="muted">No items have been added to this pool yet.</p></div>}</div>
          </div>
        </section>
      })}

      <div className="card border-slate-200 p-4"><div className="card-title">Price promise</div><p className="mt-2 text-sm leading-6 text-slate-600"><b className="text-slate-900">Demand unlocks a maximum price.</b> When your community reaches a tier, that unlocked price can stay the same or improve after final supplier negotiation—it cannot increase. Final savings use the final customer price; verified product savings are credited only after successful fulfilment; delivery charges are separate.</p></div>
    </div>
  </AppShell>
}