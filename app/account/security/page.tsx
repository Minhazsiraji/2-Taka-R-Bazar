import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {SubmitButton} from '@/components/submit-button'
import {BdPhoneInput} from '@/components/bd-phone-input'
import {setMyPassword, linkMyGoogle} from '@/app/actions/auth'
import {getAuthProviders} from '@/lib/auth-providers'

export const dynamic = 'force-dynamic'
export default async function AccountSecurityPage({searchParams}: {searchParams: Promise<{error?: string; notice?: string}>}) {
  const [query, supabase, providers] = await Promise.all([searchParams, createClient(), getAuthProviders()])
  const {data: {user}} = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Faccount%2Fsecurity')
  const linkedGoogle = user.identities?.some(identity => identity.provider === 'google')
  return <main className="min-h-screen bg-white text-black"><PublicHeader actionHref="/account" actionLabel="Account"/>
    <section className="card mx-auto my-8 max-w-lg p-5">
      <h1 className="mb-5 text-2xl font-black">Account security / অ্যাকাউন্টের নিরাপত্তা</h1>
      {query.error && <p className="error mb-4" role="alert">{query.error}</p>}
      {query.notice && <p className="success mb-4" role="status">{query.notice}</p>}
      <h2 className="text-xl font-black">Set or change your password</h2>
      <p className="mt-3 text-sm">Your identity, community and staff permissions stay attached to this account. Enter and save the password privately.</p>
      {user.phone && <p className="mt-2 text-sm">Mobile login number: <b>{user.phone}</b></p>}
      <form action={setMyPassword} className="mt-5 grid gap-4">
        {!user.phone && <><BdPhoneInput/><p className="text-sm">Add a mobile login number to this Google account. It also becomes your order contact. This does not establish phone ownership or community eligibility.</p></>}
        <label>New password<input className="input mt-1 w-full" type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <label>Confirm new password<input className="input mt-1 w-full" type="password" name="confirm_password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <details><summary className="cursor-pointer text-sm">Current password, if required by your account</summary><label className="mt-2 block">Current password<input className="input mt-1 w-full" name="current_password" type="password" autoComplete="current-password" maxLength={256}/></label></details>
        <p className="text-sm">Use 12 or more characters. Save your new password in your password manager.</p>
        <SubmitButton disabled={!user.phone && !providers.mobilePassword}>Save my password</SubmitButton>
        {!user.phone && !providers.mobilePassword && <p className="text-sm">Mobile password setup is being configured.</p>}
      </form>
      <section className="mt-8 border-t border-slate-200 pt-5"><h2 className="text-xl font-black">Google login</h2>
        {linkedGoogle ? <p className="mt-3 text-sm">Google is linked to this account. You can use Continue with Google on the login page.</p> : <>
          <p className="mt-3 text-sm">Link Google while signed in here. This keeps the same account and permissions, including Super Admin access.</p>
          <form action={linkMyGoogle} className="mt-4"><SubmitButton className="btn-secondary" disabled={!providers.google}>Link Google to this account</SubmitButton></form>
          {!providers.google && <p className="mt-2 text-sm">Google sign-in is being configured.</p>}
        </>}
      </section>
      <nav className="mt-6 flex flex-wrap gap-4 text-sm"><Link className="underline" href="/account">Back to account</Link><Link className="underline" href="/super-admin">Super Admin</Link></nav>
    </section><PublicFooter/>
  </main>
}
