import Link from 'next/link'
import {signInGoogle, signUpPhonePassword} from '@/app/actions/auth'
import {BdPhoneInput} from '@/components/bd-phone-input'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {SubmitButton} from '@/components/submit-button'
import {safeAuthReturnPath} from '@/lib/auth-intent'
import {getAuthProviders} from '@/lib/auth-providers'

export const dynamic = 'force-dynamic'
export default async function SignupPage({searchParams}: {searchParams: Promise<{error?: string; notice?: string; ref?: string; next?: string}>}) {
  const [{error, notice, ref, next}, providers] = await Promise.all([searchParams, getAuthProviders()])
  const returnTo = safeAuthReturnPath(next)
  const referralCode = String(ref ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return <main className="min-h-screen bg-slate-50 text-black">
    <PublicHeader actionHref="/login" actionLabel="Sign in"/>
    <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-6xl items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-3xl font-black">Join the community pool</h1>
        <p className="muted mt-2">Register with Google or a Bangladesh mobile number and password. Mobile registration does not verify ownership of the number; community eligibility is checked separately.</p>
        {notice && <div className="success mt-4">{notice}</div>}{error && <div className="error mt-4" role="alert">{error}</div>}
        <form action={signUpPhonePassword} className="mt-6 grid gap-4">
          {returnTo && <input type="hidden" name="next" value={returnTo}/>}
          <input type="hidden" name="intent" value="signup"/>
          <label><span className="label">Referral code (optional)</span><input className="input uppercase" name="referral_code" defaultValue={referralCode} maxLength={12} placeholder="e.g. MZ8K2Q"/><p className="mt-1 text-xs text-slate-500">Your neighbour’s code is carried through either registration method.</p></label>
          <SubmitButton formAction={signInGoogle} formNoValidate className="btn-secondary w-full" disabled={!providers.google}>Continue with Google</SubmitButton>
          {!providers.google && <p className="text-xs text-slate-500">Google sign-in is being configured.</p>}
          <BdPhoneInput/>
          <label>Password<input className="input mt-1 w-full" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
          <label>Confirm password<input className="input mt-1 w-full" name="confirm_password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
          <SubmitButton disabled={!providers.mobileSignup}>Create account with password</SubmitButton>
          {!providers.mobileSignup && <p className="text-sm">Mobile registration is being configured. Existing members can still sign in with their password.</p>}
        </form>
        <p className="mt-5 text-center text-sm">Already a member? <Link className="font-bold underline" href={'/login' + (returnTo ? '?next=' + encodeURIComponent(returnTo) : '')}>Sign in</Link></p>
      </section>
    </div><PublicFooter/>
  </main>
}
