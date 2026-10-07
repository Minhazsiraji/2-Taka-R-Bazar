import { AppShell } from '@/components/app-shell'
import { CommunityLocationVerifier } from '@/components/community-location-verifier'
import { ProductImage } from '@/components/product-image'
import { SubmitButton } from '@/components/submit-button'
import { joinGroupDeal, leaveGroupDeal } from '@/app/actions/group-deals'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function GroupDealsPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {roles,supabase}=await requireOnboardedUser()
  const sp=await searchParams
  const [{data:deals,error:dealError},{data:locationRows}]=await Promise.all([
    supabase.rpc('get_my_group_deals'),
    supabase.rpc('get_my_location_status'),
  ])
  const location=locationRows?.[0] as any

  return <AppShell roles={roles}><div className="grid gap-5">
    <section>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Neighbour-powered buying</p>
      <h1 className="mt-1 text-2xl font-black sm:text-3xl">Group Deals</h1>
      <p className="muted mt-1">Join verified nearby buyers. A deal never unlocks below 5 qualified people; more qualified buyers can unlock a better price.</p>
    </section>

    {sp.error&&<div className="error">{sp.error}</div>}
    {sp.notice&&<div className="success">{sp.notice}</div>}
    {dealError&&<div className="error">Group Deals are temporarily unavailable.</div>}

    <CommunityLocationVerifier allowUatFallback={process.env.VERCEL_ENV==='preview'&&(roles.has('admin')||roles.has('super_admin'))}/>

    <div className="card p-4">
      <div className="card-title">Location gate</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="chip">{location?.configured?'Community map active':'Community map pending'}</span>
        <span className="chip">{location?.verified?'Verified':'Verification needed'}</span>
      </div>
      <p className="muted mt-2 text-sm">{location?.verified&&location?.expires_at
        ? 'Verified for this community until '+shortDate(location.expires_at)+'.'
        : 'Verify from the device you are actually using in the community before your commitment can count.'}</p>
    </div>

    {!deals?.length
      ? <div className="card p-5"><h2 className="text-xl font-black">No Group Deal is open for your community</h2><p className="muted mt-2">New verified deals will appear here when Operations opens them.</p></div>
      : <div className="grid gap-4">{deals.map((deal:any)=>{
          const joined=Number(deal.my_quantity||0)>0
          const buyers=Number(deal.buyer_count||0)
          const threshold=Number(deal.current_threshold||0)
          const next=Number(deal.next_threshold||0)
          const price=Number(deal.current_price||0)
          const saving=price>0?Math.max(0,Number(deal.market_price)-price):0
          const circleMembers=Number(deal.circle_members||0)
          const circleTarget=Number(deal.circle_target||0)
          return <article className="card min-w-0 p-0" key={deal.deal_id}>
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[180px_minmax(0,1fr)]">
              <ProductImage src={deal.image_url} name={deal.product_name}/>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="chip capitalize">{String(deal.status).replaceAll('_',' ')}</span>
                  <span className="chip">{buyers} qualified buyers</span>
                </div>
                <h2 className="mt-2 text-xl font-black sm:text-2xl">{deal.title}</h2>
                <p className="muted mt-1">{deal.product_name}{deal.brand?' · '+deal.brand:''} · {deal.package_size}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-3"><div className="card-title">Market reference</div><b className="text-xl">{taka(Number(deal.market_price))}</b></div>
                  <div className="rounded-xl border border-slate-200 p-3"><div className="card-title">Unlocked price</div><b className="text-xl text-emerald-700">{price>0?taka(price):'Needs 5 buyers'}</b>{price>0&&<p className="muted text-xs">Save up to {taka(saving)} / unit</p>}</div>
                  <div className="rounded-xl border border-slate-200 p-3"><div className="card-title">Next unlock</div><b className="text-xl">{next?String(deal.buyers_needed)+' more':threshold?'Best listed tier':'Waiting'}</b>{next>0&&<p className="muted text-xs">{next} buyers → {taka(Number(deal.next_price))}</p>}</div>
                </div>

                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><b>Nearby circle</b><span className="chip">{joined?String(circleMembers)+'/'+String(circleTarget):'Auto-assigned after joining'}</span></div>
                  <p className="muted mt-1 text-sm">We group verified neighbours automatically within up to {deal.circle_radius_m} metres; exact neighbour locations stay private. A circle cannot produce a valid deal below 5 qualified buyers.</p>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  {deal.status==='open'&&!joined&&<form action={joinGroupDeal} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="group_deal_id" value={deal.deal_id}/>
                    <label><span className="label">Quantity</span><input className="input w-28" type="number" name="quantity" min="1" max="100" defaultValue="1" required/></label>
                    <SubmitButton>Join secure group</SubmitButton>
                  </form>}
                  {deal.status==='open'&&joined&&<>
                    <div><div className="card-title">Your commitment</div><b>{deal.my_quantity} unit(s)</b></div>
                    <form action={leaveGroupDeal}><input type="hidden" name="group_deal_id" value={deal.deal_id}/><SubmitButton className="btn-secondary">Leave group</SubmitButton></form>
                  </>}
                  {deal.status!=='open'&&joined&&<span className="chip">Your qualified quantity: {deal.my_quantity}</span>}
                </div>
                <p className="muted mt-3 text-xs">Closes {shortDate(deal.closes_at)} · Target fulfilment {shortDate(deal.pickup_at)}. Final fulfilment/payment workflow remains Operations-controlled.</p>
              </div>
            </div>
          </article>
        })}</div>}
  </div></AppShell>
}
