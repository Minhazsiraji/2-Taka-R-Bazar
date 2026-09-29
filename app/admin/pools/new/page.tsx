import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { SubmitButton } from '@/components/submit-button'
import { createPoolV2 } from '@/app/actions/pools'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { supabase } = await requireAdmin()
  const [{ data: communities }, { data: pickups }] = await Promise.all([
    supabase.from('communities').select('id,name').eq('active', true).order('sort_order'),
    supabase.from('pickup_points').select('id,community_id,name,address').eq('active', true).order('name'),
  ])
  const communityById = new Map((communities ?? []).map((x: any) => [x.id, x.name]))

  return <AdminShell><div className="grid gap-5">
    <div className="flex items-center gap-2 text-sm"><Link className="font-bold text-cyan-800 underline" href="/admin/pools">← Pools</Link><span className="text-slate-400">/</span><span>Create pool</span></div>
    <section><div className="card-title">Pool setup</div><h1 className="text-2xl font-bold sm:text-3xl">Create a new draft pool</h1><p className="muted mt-1">Create the schedule first. Products and planning tiers are added in Advanced workflow while the pool is still Draft.</p></section>
    <form action={createPoolV2} className="card form-grid p-5">
      <label><span className="label">Pool cycle</span><select className="input" name="cadence" defaultValue="weekly"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label><span className="label">Visible to community</span><select className="input" name="community_id" required><option value="">Choose community</option>{(communities ?? []).map((c: any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className="label">Pool title</span><input className="input" name="title" placeholder="Amin Model Town Monthly Grocery Pool" required/></label>
      <label><span className="label">Opens at</span><input className="input" type="datetime-local" name="opens_at"/></label>
      <label><span className="label">Commitment closes</span><input className="input" type="datetime-local" name="commitment_closes_at"/></label>
      <label><span className="label">Confirmation closes</span><input className="input" type="datetime-local" name="confirmation_closes_at"/></label>
      <label><span className="label">Supplier delivery target</span><input className="input" type="datetime-local" name="supplier_delivery_at"/></label>
      <label><span className="label">Customer pickup starts</span><input className="input" type="datetime-local" name="pickup_at"/></label>
      <label><span className="label">Designated receiving point</span><select className="input" name="receiving_pickup_point_id"><option value="">Choose point</option>{(pickups ?? []).map((p: any)=><option key={p.id} value={p.id}>{communityById.get(p.community_id)} · {p.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className="label">Operational notes</span><textarea className="input min-h-24" name="notes"/></label>
      <div className="md:col-span-2 flex flex-wrap gap-2"><SubmitButton className="btn-primary">Create draft pool</SubmitButton><Link className="btn-secondary" href="/admin/pools">Cancel</Link></div>
    </form>
  </div></AdminShell>
}
