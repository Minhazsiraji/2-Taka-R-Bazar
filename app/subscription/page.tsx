import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { requireOnboardedUser } from '@/lib/auth'

export const dynamic='force-dynamic'

export default async function SubscriptionPage(){
  const {roles}=await requireOnboardedUser()
  return <AppShell roles={roles}><div className="grid gap-5">
    <section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Business model update</p><h1 className="mt-1 text-3xl font-black">No subscription fee</h1><p className="muted mt-2 max-w-2xl">2-TAKA-R-BAZAR now earns through procurement efficiency and product margin instead of charging households a recurring membership fee.</p></section>
    <div className="card"><div className="card-title">Customer access</div><h2 className="mt-1 text-xl font-black">Community Pool access does not require membership payment</h2><p className="muted mt-2">Join your community pools, confirm the final product price, then choose FREE community collection or optional home delivery. Product savings and delivery charges are shown separately.</p><Link href="/pool" className="btn-primary mt-4 inline-flex">Browse community pools</Link></div>
  </div></AppShell>
}
