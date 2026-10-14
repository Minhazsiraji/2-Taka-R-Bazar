import Link from 'next/link'
import {requireSuperAdmin} from '@/lib/auth'
import {getAuthProviders} from '@/lib/auth-providers'
import {SuperAdminShell} from '@/components/super-admin-shell'

export const dynamic = 'force-dynamic'
export default async function AuthSetupPage() {
  await requireSuperAdmin()
  const status = await getAuthProviders()
  return <SuperAdminShell>
    <h1 className="text-3xl font-black">Login setup</h1>
    <p className="muted mt-3">Google and mobile/password access. Existing accounts and staff roles are preserved.</p>
    <section className="card mt-6"><h2 className="text-xl font-black">Current provider status</h2>
      <dl className="mt-4 grid gap-2"><dt>Google provider</dt><dd>{status.google ? 'Enabled — complete a Google login test' : 'Not enabled or unavailable'}</dd><dt>Mobile registration without SMS</dt><dd>{status.mobileSignup ? 'Ready' : 'Needs configuration'}</dd><dt>Provider settings</dt><dd>{status.available ? 'Loaded' : 'Could not be checked; new registration is held safely'}</dd></dl>
    </section>
    <section className="card mt-6"><h2 className="text-xl font-black">One-time private configuration</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5">
        <li>In Supabase Authentication → Sign In / Providers → Phone, keep phone login enabled and turn Confirm phone off. This enables native mobile/password registration without sending SMS.</li>
        <li>In Google Auth Platform, create a Web application OAuth client. Set the JavaScript origin to <code>https://2takarbazar.com</code> and the authorised redirect URI to <code className="break-all">https://sukabonfjcnaavjgjyuy.supabase.co/auth/v1/callback</code>.</li>
        <li>Enter the Google client ID and client secret privately in Supabase’s Google provider and enable it. Do not put the secret in source code or chat.</li>
        <li>In Supabase URL Configuration, set Site URL to <code>https://2takarbazar.com</code> and allow <code>https://2takarbazar.com/auth/callback</code>. Enable manual identity linking in Authentication settings.</li>
        <li>While signed in to your existing owner account, save your password and choose Link Google to this account. Repeat from the second real account. Then test both login methods after signing out.</li>
      </ol>
      <p className="mt-4 text-sm">No SMS credit purchase is needed for these login flows. Community, household and Finance approvals remain independent.</p>
    </section>
    <nav className="mt-6 flex flex-wrap gap-4"><Link className="btn-primary" href="/account/security">My password & Google link</Link><a className="btn-secondary" href="https://supabase.com/dashboard/project/sukabonfjcnaavjgjyuy/auth/providers" target="_blank" rel="noopener noreferrer">Open Supabase providers</a><a className="btn-secondary" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer">Open Google clients</a></nav>
  </SuperAdminShell>
}
