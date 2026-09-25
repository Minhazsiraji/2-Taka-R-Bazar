import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requireOnboardedUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { taka, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { user, profile, roles, supabase } = await requireOnboardedUser()
  const admin = createAdminClient()
  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const [{ data: savings }, { data: activePool }, { data: readyOrder }, { data: community }] = await Promise.all([
    supabase.from('savings_ledger').select('amount,verified_at').eq('customer_id', user.id).order('verified_at', { ascending: false }),
    supabase.from('pools').select('id,title,status,pickup_at').eq('community_id', profile.community_id).in('status',['open','pricing','final_price','confirmation','ordered','ready_for_pickup']).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('orders').select('id,order_code,status,pickup_points(name,address,google_maps_url)').eq('customer_id', user.id).eq('status','ready_for_pickup').order('ready_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('communities').select('id,name').eq('id', profile.community_id).maybeSingle(),
  ])
  const lifetime = (savings ?? []).reduce((sum: number, row: any) => sum + Number(row.amount), 0)
  const thisMonth = (savings ?? []).filter((row: any) => row.verified_at >= monthStart).reduce((sum: number,row:any)=>sum+Number(row.amount),0)
  const [{ count: householdCount }, { data: communitySavings }] = await Promise.all([
    admin.from('profiles').select('id',{count:'exact',head:true}).eq('community_id',profile.community_id).not('onboarding_completed_at','is',null),
    admin.from('savings_ledger').select('amount').eq('community_id',profile.community_id).gte('verified_at',monthStart),
  ])
  const communityMonthSaving = (communitySavings ?? []).reduce((s:number,r:any)=>s+Number(r.amount),0)

  return <AppShell roles={roles}><div className="grid gap-5">
    <section><p className="muted">Hello, {profile.full_name}</p><h1 className="text-3xl font-black">Your BazarPool</h1></section>
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="card sm:col-span-2"><div className="card-title">My savings · this month</div><div className="metric text-emerald-700">{taka(thisMonth)} saved</div><p className="muted mt-2">Lifetime: <b>{taka(lifetime)}</b>. Only collected orders count.</p><Link className="mt-4 inline-flex font-bold text-emerald-700" href="/savings">See savings history →</Link></div>
      <div className="card"><div className="card-title">My community</div><div className="mt-2 text-xl font-black">{community?.name}</div><p className="muted mt-2">{householdCount ?? 0} participating households</p><p className="muted">{taka(communityMonthSaving)} verified saving this month</p></div>
    </section>
    <section className="grid gap-3 md:grid-cols-2">
      <div className="card"><div className="flex items-start justify-between gap-3"><div><div className="card-title">Current pool</div><h2 className="mt-2 text-xl font-black">{activePool?.title ?? 'No active pool right now'}</h2></div>{activePool && <StatusPill status={activePool.status} />}</div>{activePool ? <><p className="muted mt-2">Pickup target: {shortDate(activePool.pickup_at)}</p><Link className="btn-primary mt-4" href="/pool">Open pool</Link></> : <p className="muted mt-3">Operations will publish the next local pool here.</p>}</div>
      <div className="card"><div className="card-title">Next pickup</div>{readyOrder ? <><h2 className="mt-2 text-xl font-black">{readyOrder.order_code}</h2><p className="muted mt-2">{(readyOrder.pickup_points as any)?.name}<br/>{(readyOrder.pickup_points as any)?.address}</p><Link className="btn-secondary mt-4" href="/pickup">Pickup details</Link></> : <p className="muted mt-3">Nothing is ready for pickup yet.</p>}</div>
    </section>
    <div className="notice">A <b>commitment</b> only tells us your intended quantity. It becomes a purchase only after the final price is published and you explicitly confirm.</div>
  </div></AppShell>
}
