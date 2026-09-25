import { completeOnboarding } from '@/app/actions/auth'
import { SubmitButton } from '@/components/submit-button'
import { requireUser } from '@/lib/auth'

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { supabase, user } = await requireUser()
  const { error, notice } = await searchParams
  const [{ data: communities }, { data: pickupPoints }] = await Promise.all([
    supabase.from('communities').select('id,name').eq('active', true).order('sort_order'),
    supabase.from('pickup_points').select('id,name,community_id,communities(name)').eq('active', true).order('name'),
  ])
  return <main className="mx-auto max-w-xl px-4 py-8"><section className="card">
    <img src="/brand-logo.webp" alt="2-TAKA-R-BAZAR" className="mb-5 w-48" />
    <h1 className="text-3xl font-black">Set up your household</h1><p className="muted mt-2">Choose the community and pickup point you use. Your verified mobile stays private and is used only for account and order operations.</p>
    {notice && <div className="success mt-4">{notice}</div>}{error && <div className="error mt-4">{error}</div>}
    <form action={completeOnboarding} className="mt-6 grid gap-4">
      <label><span className="label">Full name</span><input className="input" name="full_name" required /></label>
      <label><span className="label">Verified mobile</span><input className="input bg-slate-100" value={user.phone ?? ''} readOnly aria-readonly="true" /></label>
      <label><span className="label">Household label</span><input className="input" name="household_name" placeholder="e.g. Siraji Family" required /></label>
      <label><span className="label">Community</span><select className="input" name="community_id" required><option value="">Choose community</option>{communities?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label><span className="label">Preferred pickup point</span><select className="input" name="pickup_point_id" required><option value="">Choose pickup point</option>{pickupPoints?.map((p: any) => <option key={p.id} value={p.id}>{p.communities?.name} · {p.name}</option>)}</select></label>
      <label><span className="label">Building / road / landmark (optional)</span><input className="input" name="address_hint" /></label>
      <label><span className="label">Google Maps share URL (optional)</span><input className="input" name="google_maps_url" type="url" placeholder="https://maps.app.goo.gl/..." /></label>
      <SubmitButton>Finish setup</SubmitButton>
    </form>
  </section></main>
}
