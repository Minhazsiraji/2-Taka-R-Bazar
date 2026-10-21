import Link from 'next/link'
import {signInGoogle, signInPhonePassword} from '@/app/actions/auth'
import {BdPhoneInput} from '@/components/bd-phone-input'
import {CustomerHeader as PublicHeader} from '@/components/customer-header'
import {CustomerFooter as PublicFooter} from '@/components/customer-footer'
import {SubmitButton} from '@/components/submit-button'
import {safeAuthReturnPath} from '@/lib/auth-intent'
import {getAuthProviders} from '@/lib/auth-providers'

export const dynamic = 'force-dynamic'
export default async function LoginPage({searchParams}: {searchParams: Promise<{error?: string; notice?: string; next?: string}>}) {
  const [{error, notice, next}, providers] = await Promise.all([searchParams, getAuthProviders()])
  const returnTo = safeAuthReturnPath(next)
  return <main className="public-marketplace-flat customer-page-shell min-h-screen bg-slate-50 text-black">
    <PublicHeader actionHref="/signup" actionLabel="Join the pool"/>
    <div className="mx-auto flex auth-page-content max-w-6xl items-center justify-center px-4 py-6">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center"><h1 className="text-3xl font-black">Sign in</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600" lang="bn">সাইন ইন করুন</p>
          <p className="muted mt-3">Use Google or your Bangladesh mobile number and password.</p>
          <p className="mt-1 text-[12px] leading-5 text-slate-500" lang="bn">Google অথবা মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে সাইন ইন করুন।</p>
        </div>
        {notice && <div className="success mb-4">{notice}</div>}{error && <div className="error mb-4" role="alert">{error}</div>}
        <form action={signInGoogle} className="mb-5 grid gap-2">
          {returnTo && <input type="hidden" name="next" value={returnTo}/>}
          <SubmitButton className="btn-secondary w-full" disabled={!providers.google}>Continue with Google</SubmitButton>
          {!providers.google && <p className="text-center text-xs text-slate-500">Google sign-in is being configured.</p>}
        </form>
        <form action={signInPhonePassword} className="grid gap-4">
          {returnTo && <input type="hidden" name="next" value={returnTo}/>}
          <BdPhoneInput/>
          <label>Password<input className="input mt-1 w-full" name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
          <SubmitButton>Sign in with password</SubmitButton>
        </form>
        <p className="mt-4 text-sm">Already signed in on another window? <Link className="underline" href="/account/security">Set your password or link Google</Link> there. Existing members should link Google from their account before using Google sign-in.</p>
        <p className="mt-3 text-sm">Forgot your password? Use Google if already linked. If you have neither a linked Google account nor an active session, <a className="underline" href="mailto:support@2takarbazar.com">contact support for account recovery</a>.</p>
        {process.env.VERCEL_ENV === 'preview' && <Link className="btn-secondary mt-4 w-full" href="/preview-demo">Open synthetic Preview</Link>}
        <p className="mt-5 text-center text-sm">New here? <Link className="font-bold underline" href={'/signup' + (returnTo ? '?next=' + encodeURIComponent(returnTo) : '')}>Join the pool</Link></p>
      </section>
    </div><PublicFooter/>
  </main>
}
