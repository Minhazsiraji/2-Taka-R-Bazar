import type { Metadata } from 'next'
import { PriceComparison } from '@/components/price-comparison'
import { AppShell } from '@/components/app-shell'
import { CommunityLocationVerifier } from '@/components/community-location-verifier'
import { GroupDealUnlockProgress } from '@/components/group-deal-unlock-progress'
import { ProductImage } from '@/components/product-image'
import { ShareUnlockButton } from '@/components/share-unlock-button'
import { SubmitButton } from '@/components/submit-button'
import { joinGroupDeal, leaveGroupDeal, requestFailedGroupDealInitialPrice } from '@/app/actions/group-deals'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic='force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } }

export default async function GroupDealsPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {roles,supabase}=await requireOnboardedUser()
  const sp=await searchParams
  const [{data:deals,error:dealError},{data:locationRows},{data:failedDeals,error:failedDealError}]=await Promise.all([
    supabase.rpc('get_my_group_deals'),
    supabase.rpc('get_my_location_status'),
    supabase.rpc('get_my_failed_group_deals'),
  ])
  const location=locationRows?.[0] as any

  return <AppShell roles={roles}>
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <section>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Neighbour-powered buying</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Group Deals</h1>
        <p className="muted mt-1 text-sm">Real nearby people unlock the price together. One verified person counts once, no matter how many units they buy.</p>
      </section>

      {sp.error&&<div className="error">{sp.error}</div>}
      {sp.notice&&<div className="success">{sp.notice}</div>}
      {dealError&&<div className="error">Group Deals are temporarily unavailable.</div>}
      {failedDealError&&<div className="error">Recent cancelled Group Deals are temporarily unavailable.</div>}

      {location?.verified
        ? <div className="cx-glass-subcard flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2"><span aria-hidden="true">📍</span><div><b>Community location verified</b><p className="muted text-xs">Nearby matching is active; your exact GPS point stays private.</p></div></div>
            <span className="chip border-emerald-200 bg-white text-emerald-700">Verified ✓</span>
          </div>
        : <CommunityLocationVerifier
            allowUatFallback={process.env.VERCEL_ENV==='preview'&&(roles.has('admin')||roles.has('super_admin'))}
            initialVerified={false}
          />}


      {(failedDeals??[]).length>0&&<section className="grid gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">Closed without unlock</p>
          <h2 className="mt-1 text-xl font-black">Deals that missed the minimum buyer count</h2>
          <p className="muted mt-1 text-sm">No order or payment was created. If you still want the product, you can ask our team about buying it at the original market/reference price.</p>
        </div>
        {(failedDeals??[]).map((deal:any)=><article className="card cx-glass-card min-w-0 p-4 sm:p-5" key={deal.deal_id}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <ProductImage src={deal.image_url} name={deal.product_name} className="cx-product-photo"/>
              <div className="min-w-0">
                <span className="chip border-rose-200 bg-rose-50 text-rose-700">Cancelled</span>
                <h3 className="mt-2 text-base font-black sm:text-lg">{deal.product_name}</h3>
                <p className="muted mt-1 text-xs">{deal.brand?deal.brand+' · ':''}{deal.package_size}</p>
                <p className="mt-1 text-xs font-bold text-slate-600">{deal.title}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs font-bold text-slate-500">Initial price</div>
              <div className="text-xl font-black">{taka(Number(deal.initial_price))}</div>
            </div>
          </div>
          <div className="cx-glass-subcard mt-4 rounded-xl p-3">
            <div className="text-sm font-black text-rose-700">{deal.cancellation_reason}</div>
            <p className="muted mt-1 text-xs">The minimum verified-buyer threshold was not reached before the closing time. Your commitment was cancelled automatically, no order was created, and no payment is due.</p>
          </div>
          {deal.request_id
            ? <div className="mt-4 flex flex-wrap items-center gap-2"><span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Request {String(deal.request_status).replaceAll('_',' ')}</span><span className="muted text-xs">Our team has your request and can contact you using your account details.</span></div>
            : <form action={requestFailedGroupDealInitialPrice} className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
                <input type="hidden" name="group_deal_id" value={deal.deal_id}/>
                <label><span className="label">Quantity</span><input className="input" type="number" name="quantity" min="1" max="100" defaultValue={deal.my_quantity||1} required/></label>
                <label><span className="label">Note (optional)</span><input className="input" name="note" maxLength={500} placeholder="Any preferred contact time or note"/></label>
                <SubmitButton>I still want this product</SubmitButton>
              </form>}
        </article>)}
      </section>}

      {!deals?.length
        ? <div className="card cx-glass-card p-6 text-center"><h2 className="text-xl font-black">No Group Deal is open right now</h2><p className="muted mt-2 text-sm">New verified nearby opportunities will appear here when Operations opens them.</p></div>
        : <div className="grid gap-3">{deals.map((deal:any)=>{
            const joined=Number(deal.my_quantity||0)>0
            const buyers=Number(deal.buyer_count||0)
            const next=Number(deal.next_threshold||0)
            const price=Number(deal.current_price||0)
            const saving=price>0?Math.max(0,Number(deal.market_price)-price):0
            const circleMembers=Number(deal.circle_members||0)
            const circleTarget=Number(deal.circle_target||0)
            const unlockProgressBuyers=buyers===0&&joined?Math.min(circleMembers,next):Math.min(buyers,next)
            const unlockBuyersNeeded=next?Math.max(next-unlockProgressBuyers,0):0

            return <article className="card cx-glass-card cx-compact-product min-w-0 p-4 sm:p-5" key={deal.deal_id}>
              <div className="cx-product-heading">
                <ProductImage src={deal.image_url} name={deal.product_name} className="cx-product-photo"/>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip capitalize">{String(deal.status).replaceAll('_',' ')}</span>
                    <span className="chip">{buyers} qualified</span>
                    {joined&&<span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Joined</span>}
                  </div>
                  <h2 className="mt-2 text-base font-black leading-tight sm:text-xl">{deal.product_name}</h2>
                  <p className="muted mt-1 text-xs">{deal.brand?deal.brand+' · ':''}{deal.package_size} · closes {shortDate(deal.closes_at)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-600">{deal.title}</p>
                </div>
              </div>

              <PriceComparison market={taka(Number(deal.market_price))} current={price>0?taka(price):'Unlocking'} currentLabel="Current price" savingLabel={price>0?'You save':'Next unlock'} saving={price>0?taka(saving):next?unlockBuyersNeeded+' more':'—'} note={price>0?'per unit':next?taka(Number(deal.next_price)):'top tier'}/>

              <GroupDealUnlockProgress
                qualifiedBuyers={buyers}
                circleMembers={circleMembers}
                nextThreshold={next}
                nextPrice={Number(deal.next_price||0)}
                marketPrice={Number(deal.market_price||0)}
                joined={joined}
              />

              <div className="cx-compact-strip mt-3">
                <span className="cx-compact-chip">👥 Nearby circle {joined?String(circleMembers)+'/'+String(circleTarget):'auto-match after joining'}</span>
                <span className="cx-compact-chip">📍 within {deal.circle_radius_m} m</span>
                {joined&&<span className="cx-compact-chip">Your qty {deal.my_quantity}</span>}
              </div>

              {next>0&&<div className="cx-glass-subcard mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl p-3">
                <div>
                  <div className="text-xs font-black text-slate-700">{unlockBuyersNeeded} more verified neighbour{unlockBuyersNeeded===1?'':'s'} can unlock {taka(Number(deal.next_price))}</div>
                  <div className="muted mt-1 text-[11px]">Sharing helps discovery; only separately verified people count.</div>
                </div>
                <ShareUnlockButton
                  title={String(deal.product_name)}
                  text={unlockBuyersNeeded+' more verified neighbours can unlock '+taka(Number(deal.next_price))+' for '+String(deal.product_name)+'.'}
                  label={unlockBuyersNeeded>0?'Invite neighbours':'Share deal'}
                />
              </div>}

              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
                {deal.status==='open'&&!joined&&<form action={joinGroupDeal} className="cx-quantity-form w-full">
                  <input type="hidden" name="group_deal_id" value={deal.deal_id}/>
                  <label><span className="label">Quantity</span><input className="input" type="number" name="quantity" min="1" max="100" defaultValue="1" required/></label>
                  <SubmitButton className="w-full sm:w-auto">Join group</SubmitButton>
                </form>}

                {deal.status==='open'&&joined&&<form action={leaveGroupDeal}>
                  <input type="hidden" name="group_deal_id" value={deal.deal_id}/>
                  <SubmitButton className="btn-secondary">Leave group</SubmitButton>
                </form>}

                {deal.status!=='open'&&joined&&<span className="chip">Qualified quantity: {deal.my_quantity}</span>}
              </div>

              <details className="mt-3 border-t border-slate-200 pt-3">
                <summary className="cursor-pointer text-sm font-black text-slate-600">How nearby matching works</summary>
                <p className="muted mt-2 text-sm leading-6">Verified neighbours are grouped automatically within up to {deal.circle_radius_m} metres. Exact coordinates are private. A circle cannot produce a valid deal below 5 qualified people. Target fulfilment: {shortDate(deal.pickup_at)}.</p>
              </details>
            </article>
          })}</div>}
    </div>
  </AppShell>
}
