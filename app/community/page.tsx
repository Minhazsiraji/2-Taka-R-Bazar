import { AppShell } from '@/components/app-shell'
import { ShareButton } from '@/components/share-button'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function CommunityPage(){
  const {profile,roles,supabase}=await requireOnboardedUser()
  const [{data:community},{data:summaryRows}]=await Promise.all([
    supabase.from('communities').select('*').eq('id',profile.community_id).single(),
    supabase.rpc('get_my_community_summary'),
  ])
  const summary=summaryRows?.[0] as any
  const households=Number(summary?.household_count??0)
  const activePools=Number(summary?.active_pool_count??0)
  const total=Number(summary?.month_verified_saving??0)
  const text=`${community.name} BazarPool\n${households} participating households\nVerified community saving this month: ${taka(total)}`
  return <AppShell roles={roles}><div className="grid gap-5"><section><h1 className="text-3xl font-black">My community</h1><p className="muted">Only aggregate activity is shown—never individual household purchases.</p></section><div className="card"><div className="card-title">Community</div><div className="metric text-2xl">{community.name}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div><div className="card-title">Households</div><b className="text-2xl">{households}</b></div><div><div className="card-title">Active pools</div><b className="text-2xl">{activePools}</b></div><div><div className="card-title">Saving this month</div><b className="text-2xl text-emerald-700">{taka(total)}</b></div></div><div className="mt-5"><ShareButton title={`${community.name} · 1TAKA BazarPool`} text={text}/></div></div></div></AppShell>
}
