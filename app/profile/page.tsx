import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { SubmitButton } from '@/components/submit-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { updateProfile, signOut } from '@/app/actions/auth'
import { requireOnboardedUser } from '@/lib/auth'
import { LEGAL_LINKS } from '@/lib/legal'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { user, profile, roles, supabase } = await requireOnboardedUser()
  const { error, notice } = await searchParams
  const [{ data: community }, { data: points }] = await Promise.all([
    supabase.from('communities').select('name').eq('id', profile.community_id).single(),
    supabase.from('pickup_points').select('id,name').eq('community_id', profile.community_id).eq('active', true),
  ])

  const isSuperAdmin=roles.has('super_admin')
  const isAdmin=roles.has('admin')||isSuperAdmin
  const isPickup=roles.has('pickup_operator')||isSuperAdmin

  return <AppShell roles={roles}><div className="grid gap-4 sm:gap-5">
    <section><h1 className="text-2xl font-black sm:text-3xl">Profile</h1><p className="muted mt-1 text-sm">Community: {community?.name}</p></section>
    {error && <div className="error">{error}</div>}{notice && <div className="success">{notice}</div>}

    <form action={updateProfile} className="card cx-glass-card grid gap-4">
      <label><span className="label">Full name</span><input className="input" name="full_name" defaultValue={profile.full_name ?? ''} required /></label>
      <label><span className="label">Verified mobile</span><input className="input bg-slate-100" value={user.phone ?? profile.phone ?? ''} readOnly aria-readonly="true" /></label>
      <p className="-mt-2 text-xs text-slate-500">Mobile changes require a new OTP verification flow.</p>
      <label><span className="label">Household label</span><input className="input" name="household_name" defaultValue={profile.household_name ?? ''} required /></label>
      <label><span className="label">Default pickup point (optional)</span><select className="input" name="pickup_point_id" defaultValue={profile.pickup_point_id ?? ''}><option value="">No default — choose when confirming an order</option>{points?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <p className="-mt-2 text-xs text-slate-500">You can choose a different active pickup point each time you confirm a purchase.</p>
      <label><span className="label">Building / road / landmark</span><input className="input" name="address_hint" defaultValue={profile.address_hint ?? ''} /></label>
      <label><span className="label">Google Maps share URL</span><input className="input" type="url" name="google_maps_url" defaultValue={profile.google_maps_url ?? ''} /></label>
      <SubmitButton>Save profile</SubmitButton>
    </form>

    <section className="card cx-glass-card p-4">
      <div className="card-title">App preferences</div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><ThemeToggle/><Link href="/money" className="btn-secondary">💰 My Money</Link></div>
    </section>

    {(isAdmin||isPickup)&&<section className="card cx-glass-card p-4">
      <div className="card-title">Work tools</div>
      <p className="muted mt-1 text-sm">Customer shopping stays uncluttered. Operational tools live here instead of the mobile shopping header.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isPickup&&<Link href="/pickup-ops" className="btn-secondary">Pickup Ops</Link>}
        {isAdmin&&<Link href="/admin" className="btn-secondary">Operations</Link>}
        {isSuperAdmin&&<Link href="/super-admin" className="btn-secondary">Super Admin</Link>}
      </div>
    </section>}

    <section className="card cx-glass-card p-4">
      <div className="card-title">Help & legal</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{LEGAL_LINKS.map(([href,label])=><Link key={href} href={href} className="rounded-xl border border-slate-200 bg-white/45 px-3 py-2 text-sm font-bold hover:bg-sky-50">{label}</Link>)}</div>
    </section>

    <form action={signOut}><SubmitButton className="btn-secondary">Sign out</SubmitButton></form>
  </div></AppShell>
}
