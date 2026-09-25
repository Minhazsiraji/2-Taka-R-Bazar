import { AppShell } from '@/components/app-shell'
import { SubmitButton } from '@/components/submit-button'
import { updateProfile, signOut } from '@/app/actions/auth'
import { requireOnboardedUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { user, profile, roles, supabase } = await requireOnboardedUser()
  const { error, notice } = await searchParams
  const [{ data: community }, { data: points }] = await Promise.all([
    supabase.from('communities').select('name').eq('id', profile.community_id).single(),
    supabase.from('pickup_points').select('id,name').eq('community_id', profile.community_id).eq('active', true),
  ])

  return <AppShell roles={roles}><div className="grid gap-5">
    <section><h1 className="text-3xl font-black">Profile</h1><p className="muted">Community: {community?.name}</p></section>
    {error && <div className="error">{error}</div>}{notice && <div className="success">{notice}</div>}
    <form action={updateProfile} className="card grid gap-4">
      <label><span className="label">Full name</span><input className="input" name="full_name" defaultValue={profile.full_name ?? ''} required /></label>
      <label><span className="label">Verified mobile</span><input className="input bg-slate-100" value={user.phone ?? profile.phone ?? ''} readOnly aria-readonly="true" /></label>
      <p className="-mt-2 text-xs text-slate-500">Mobile changes require a new OTP verification flow.</p>
      <label><span className="label">Household label</span><input className="input" name="household_name" defaultValue={profile.household_name ?? ''} required /></label>
      <label><span className="label">Pickup point</span><select className="input" name="pickup_point_id" defaultValue={profile.pickup_point_id ?? ''} required><option value="">Choose pickup point</option>{points?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span className="label">Building / road / landmark</span><input className="input" name="address_hint" defaultValue={profile.address_hint ?? ''} /></label>
      <label><span className="label">Google Maps share URL</span><input className="input" type="url" name="google_maps_url" defaultValue={profile.google_maps_url ?? ''} /></label>
      <SubmitButton>Save profile</SubmitButton>
    </form>    <form action={signOut}><SubmitButton className="btn-secondary">Sign out</SubmitButton></form>
  </div></AppShell>
}
