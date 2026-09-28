import { AppShell } from '@/components/app-shell'
import { ShareButton } from '@/components/share-button'
import { ReferralShare } from '@/components/referral-share'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function CommunityPage(){
  const {profile,roles,supabase}=await requireOnboardedUser()
  const [{data:community},{data:summaryRows},{data:referralRows}]=await Promise.all([
    supabase.from('communities').select('*').eq('id',profile.community_id).single(),
    supabase.rpc('get_my_community_summary'),
    supabase.rpc('get_my_referral_summary'),
  ])
  const summary=summaryRows?.[0] as any
  const referral=referralRows?.[0] as any
  const households=Number(summary?.household_count??0),activePools=Number(summary?.active_pool_count??0),total=Number(summary?.month_verified_saving??0)
  const successful=Number(referral?.successful_referrals??0),pending=Number(referral?.pending_referrals??0),coins=Number(referral?.coins??0)
  const rawCycleCoins=coins%100,progressCoins=coins>0&&rawCycleCoins===0?100:rawCycleCoins,freeMonths=Number(referral?.conceptual_free_months??0),toNext=progressCoins===100?0:100-progressCoins
  const text=`${community.name} · 2-TAKA-R-BAZAR\n${households} participating households\nVerified community saving this month: ${taka(total)}`
  return <AppShell roles={roles}><div className="grid gap-5">
    <section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Community</p><h1 className="mt-1 text-3xl font-black">My community</h1><p className="muted">Aggregate community activity only—individual household purchases stay private.</p></section>
    <div className="card"><div className="card-title">Community</div><div className="metric text-2xl">{community.name}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div><div className="card-title">Households</div><b className="text-2xl">{households}</b></div><div><div className="card-title">Active pools</div><b className="text-2xl">{activePools}</b></div><div><div className="card-title">Saving this month</div><b className="text-2xl text-emerald-700">{taka(total)}</b></div></div><div className="mt-5"><ShareButton title={`${community.name} · 2-TAKA-R-BAZAR`} text={text}/></div></div>
    <section className="card grid gap-4">
      <div><div className="card-title">Invite neighbours</div><h2 className="mt-1 text-2xl font-black">Grow this community together</h2><p className="muted mt-1">A signup alone earns nothing. When a referred neighbour collects their first genuine order, you earn exactly 10 Coins.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4"><div className="card-title">Your referral code</div><div className="mt-2 font-mono text-2xl font-black tracking-wider">{referral?.referral_code??'—'}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4"><div className="card-title">Successful referrals</div><div className="mt-2 text-2xl font-black">{successful} / 10</div><p className="muted mt-1">{pending} pending · reward waits for first collection</p></div>
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4"><div className="card-title">2-Taka Coins</div><div className="mt-2 text-2xl font-black">{coins} Coins</div><p className="muted mt-1">{freeMonths} free month{freeMonths===1?'':'s'} earned conceptually</p></div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-600" style={{width:`${Math.min(100,progressCoins)}%`}}/></div>
      <p className="text-sm font-bold text-slate-700">{toNext===0?'You have reached another 100-Coin milestone.':`${Math.ceil(toNext/10)} more successful neighbour referral${Math.ceil(toNext/10)===1?'':'s'} → 1 month free when membership launches.`}</p>
      {referral?.referral_code&&<ReferralShare code={referral.referral_code}/>}<p className="text-xs text-slate-500">Pilot rule: Coins accumulate only. They are not consumed and do not activate paid membership during the first 3–4 months.</p>
    </section>
  </div></AppShell>
}
