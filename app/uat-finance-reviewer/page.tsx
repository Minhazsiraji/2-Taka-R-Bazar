import {signInFinanceUatReviewer} from '@/app/actions/finance-uat-login'
import Link from 'next/link'
export const dynamic='force-dynamic'
export const metadata={robots:{index:false,follow:false,noarchive:true}}
export default async function UatFinanceReviewer({searchParams}:{searchParams:Promise<{error?:string}>}){
 const enabled=process.env.VERCEL_ENV==='preview'&&process.env.FINANCE_SHARED_DB_UAT_ENABLED==='true'&&process.env.FINANCE_WRITES_ENABLED==='true'
 const params=await searchParams
 return <main className="mx-auto max-w-lg p-6 sm:p-12">
  <h1 className="text-2xl font-black">Temporary finance UAT checker</h1>
  <p className="my-4 text-sm">Only for independent Treasury approval testing. This reviewer is a separate account from the finance transaction maker. No phone number, SMS or OTP is required for this temporary test login.</p>
  {!enabled?<p className="rounded-xl bg-amber-50 p-4">This sign-in is unavailable outside the authorized Finance Preview.</p>:<>
   {params.error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">{params.error}</p>}
   <form action={signInFinanceUatReviewer} className="grid gap-3 rounded-2xl border border-slate-200 p-5">
    <label className="text-sm font-semibold">Temporary UAT reviewer password<input type="password" name="password" minLength={12} required autoComplete="off" className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label>
    <button type="submit" className="rounded-xl bg-teal-700 p-3 font-semibold text-white">Sign in as separate reviewer</button>
   </form>
   <p className="mt-4 text-xs text-slate-600">Use a private/incognito browser window so your original maker session stays separate. This reviewer must not be used for normal operations.</p>
  </>}
  <p className="mt-5"><Link href="/login" className="underline">Regular phone OTP login</Link></p>
 </main>
}
