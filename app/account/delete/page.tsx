import Link from 'next/link'
import {requireUser} from '@/lib/auth'
import {CommerceFrame} from '@/components/commerce-frame'
import {requestAccountDeletion} from './actions'
export const dynamic='force-dynamic'
export const metadata={title:'Delete my account — 2-TAKA-R-BAZAR'}
export default async function DeleteAccountPage({searchParams}:{searchParams:Promise<{error?:string;requested?:string}>}){
 const [{supabase,user},params]=await Promise.all([requireUser(),searchParams])
 const {data:requests}=await supabase.from('customer_account_deletion_requests').select('id,status,requested_at,completed_at').eq('customer_id',user.id).order('requested_at',{ascending:false}).limit(1)
 const latest=requests?.[0]
 return <CommerceFrame title="Account deletion / অ্যাকাউন্ট মুছে ফেলা">
  <section className="glass-panel rounded-3xl border border-white/80 p-5">
   <h1 className="text-xl font-black">Delete your entire 2TBR account</h1>
   <p className="mt-3">You can request the permanent deletion of your account and associated personal information. An authorized team member will review unsettled orders, transfers, returns, and any records we are legally required to keep, then process the request. This is not merely a temporary account suspension.</p>
   <p className="mt-3">আপনার অ্যাকাউন্ট এবং সংশ্লিষ্ট ব্যক্তিগত তথ্য স্থায়ীভাবে মুছে ফেলার অনুরোধ করতে পারবেন। চলমান অর্ডার ও আইনগত সংরক্ষণ যাচাই করে অনুরোধটি সম্পন্ন করা হবে।</p>
   <p className="mt-3 text-sm">We will communicate the completion outcome using your registered contact. Continue to use your existing account while the deletion request is pending, unless separately instructed.</p>
   {params.error&&<p role="alert" className="mt-3 text-red-700">{params.error}</p>}
   {params.requested==='1'&&<p role="status" className="mt-3 font-semibold">Your deletion request has been recorded. / আপনার অনুরোধ জমা হয়েছে।</p>}
   {latest&&<p className="mt-4">Request #{latest.id.slice(0,8).toUpperCase()} · {latest.status} · {new Date(latest.requested_at).toLocaleDateString('en-BD')}</p>}
   {!latest||!['pending','processing'].includes(latest.status)?
    <form action={requestAccountDeletion} className="mt-5">
     <label className="mb-3 flex gap-2"><input type="checkbox" required name="confirm_request"/><span>I understand this asks for permanent account deletion, subject to lawful record retention.</span></label>
     <button className="btn-danger" type="submit">Request permanent account deletion / স্থায়ীভাবে মুছতে অনুরোধ</button>
    </form>:
    <p className="mt-4 font-semibold">Your deletion request is being processed. You do not need to submit another.</p>}
   <Link className="mt-5 inline-block underline" href="/account">Back to my account</Link>
  </section>
 </CommerceFrame>
}
