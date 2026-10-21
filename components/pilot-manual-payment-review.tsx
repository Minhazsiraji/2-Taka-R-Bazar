import Link from 'next/link'
import {createClient} from '@/lib/supabase/server'
import {reviewPilotPaymentReference} from '@/app/actions/vendor-offers'
type Claim={id:string;booking_id:string;recipient_id:string;reference_code:string;claimed_amount:number;status:string;submitted_at:string;review_note:string|null}
export async function PilotManualPaymentReview(){
 const db=await createClient()
 const {data,error}=await db.from('pilot_booking_payment_claims')
  .select('id,booking_id,recipient_id,reference_code,claimed_amount,status,submitted_at,review_note')
  .order('submitted_at',{ascending:false}).limit(75)
 const claims=(data??[]) as Claim[]
 return <section className="card">
  <p className="card-title">MANUAL PAYMENT · HUMAN VERIFICATION</p>
  <h2 className="mt-1 text-xl font-black">Customer transfer reference review</h2>
  <p className="muted mt-2 text-sm">A customer-entered transaction ID is not proof of payment. Review the original transaction using your bKash or bank account directly. Approving here records an independently reviewed <b>claim</b>, not a Treasury cash receipt, Finance journal or automatic order payment.</p>
  <Link href="/admin/payment-recipients" className="mt-2 inline-block text-sm font-bold underline">Owner-only receiving account setup →</Link>
  {error?<p role="status" className="notice mt-3">Manual payment reference review is awaiting the qualified database migration. No automatic payment approval is available.</p>:
   claims.length===0?<p className="muted mt-3 text-sm">No transfer references submitted yet.</p>:
   <div className="mt-4 grid gap-3">{claims.map(claim=><article key={claim.id} className="rounded-xl border p-3">
    <p className="font-black">Booking {claim.booking_id.slice(0,8).toUpperCase()} · Reference {claim.reference_code}</p>
    <p className="mt-1 text-sm">Claimed amount: ৳{Number(claim.claimed_amount).toLocaleString('en-BD')} · {claim.status} · {new Date(claim.submitted_at).toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})}</p>
    {claim.review_note&&<p className="mt-2 text-sm">Review note: {claim.review_note}</p>}
    {claim.status==='pending'&&<form action={reviewPilotPaymentReference} className="mt-3 grid gap-2">
     <input type="hidden" name="claim_id" value={claim.id}/>
     <label className="grid gap-1 text-sm font-bold">Independent original-transaction verification notes
      <textarea className="input" name="review_note" required minLength={10} maxLength={500}
       placeholder="State bank/bKash statement reference, checked date, recipient and confirmed amount. Never approve from a screenshot alone."/>
     </label>
     <div className="flex flex-wrap gap-2">
      <button type="submit" className="btn-primary" name="decision" value="approve">Verify reference after external check</button>
      <button type="submit" className="btn-secondary" name="decision" value="reject">Reject invalid/unconfirmed reference</button>
     </div>
    </form>}
   </article>)}</div>}
 </section>
}
