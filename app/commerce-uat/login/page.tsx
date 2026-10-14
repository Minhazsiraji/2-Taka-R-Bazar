import {notFound} from 'next/navigation'
import {signInCommerceUat} from '@/app/actions/commerce-uat-auth'
import {commerceUatLoginEnabled} from '@/lib/commerce/uat-access.mjs'
import {SubmitButton} from '@/components/submit-button'
export const dynamic='force-dynamic'
export const metadata={robots:{index:false,follow:false,noarchive:true}}
export default async function CommerceUatLogin({searchParams}:{searchParams:Promise<{error?:string}>}){
 if(!commerceUatLoginEnabled())notFound()
 const {error}=await searchParams
 return <main className="mx-auto max-w-md px-4 py-12"><section className="card p-6">
  <h1 className="text-2xl font-bold">Preview test sign-in</h1>
  <p className="my-4 text-sm">Use your approved temporary test account's email and password. No SMS or OTP is sent. This sign-in does not grant staff or Finance permissions.</p>
  {error&&<p className="error mb-4" role="alert">{error}</p>}
  <form action={signInCommerceUat} className="grid gap-4">
   <label>Test email<input className="input mt-1 w-full" name="email" type="email" autoComplete="username" required maxLength={254}/></label>
   <label>Password<input className="input mt-1 w-full" name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
   <SubmitButton>Sign in to Preview</SubmitButton>
  </form>
 </section></main>
}
