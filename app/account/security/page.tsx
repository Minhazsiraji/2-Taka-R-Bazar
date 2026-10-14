import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {SubmitButton} from '@/components/submit-button'
import {setMyPassword} from '@/app/actions/auth'
import {hasRecentAuthentication} from '@/lib/password-setup.mjs'

export const dynamic='force-dynamic'
const verifyLink='/login?method=otp&next=%2Faccount%2Fsecurity'

export default async function AccountSecurityPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const [query,supabase]=await Promise.all([searchParams,createClient()])
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)redirect(verifyLink)
  const {data,error}=await supabase.auth.getClaims()
  const recent=!error&&hasRecentAuthentication(data?.claims)
  return <main className="min-h-screen bg-white text-black"><PublicHeader actionHref="/account" actionLabel="Account"/>
    <section className="card mx-auto my-8 max-w-lg p-5">
      <h1 className="mb-5 text-2xl font-black">Account security / অ্যাকাউন্টের নিরাপত্তা</h1>
      {query.error&&<p className="error mb-4" role="alert">{query.error}</p>}
      <h2 className="text-xl font-black">Set or change your password</h2>
      <p className="mt-3 text-sm">Use your existing account. After saving, sign in with the same verified mobile number and your new password.</p>
      <p className="mt-2 text-sm">Your identity, community and staff permissions stay attached to this account. Enter and save the password privately.</p>
      {query.notice&&<p className="success mt-4" role="status">{query.notice}</p>}
      {recent?<form action={setMyPassword} className="mt-5 grid gap-4">
        <label>New password<input className="input mt-1 w-full" type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <label>Confirm new password<input className="input mt-1 w-full" type="password" name="confirm_password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <details><summary className="cursor-pointer text-sm">Current password, if required by your account</summary><label className="mt-2 block">Current password<input className="input mt-1 w-full" name="current_password" type="password" autoComplete="current-password" maxLength={256}/></label></details>
        <p className="text-sm">Use 12 or more characters. Verification is valid for 15 minutes; a password manager can save your new password.</p>
        <SubmitButton>Save my password</SubmitButton>
      </form>:<div className="mt-5"><p className="mb-4 text-sm">Verify your mobile again before changing your password.</p><Link className="btn-primary" href={verifyLink}>Verify mobile with OTP</Link></div>}
      <nav className="mt-6 flex flex-wrap gap-4 text-sm"><Link className="underline" href="/account">Back to account</Link><Link className="underline" href="/super-admin">Super Admin</Link></nav>
    </section>
    <PublicFooter/>
  </main>
}
