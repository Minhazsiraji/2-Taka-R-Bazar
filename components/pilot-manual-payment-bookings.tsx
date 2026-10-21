import {createClient} from '@/lib/supabase/server'
import {submitPilotPaymentReference} from '@/app/actions/vendor-offers'

type ConfirmedBooking={id:string;product_name:string;quantity:number;status:string;
 confirmed_unit_price:number|null;confirmed_delivery_fee:number|null}
type PaymentOption={id:string;method:string;account_name:string;account_number:string;bank_name:string|null;branch_name:string|null}
type Claim={id:string;booking_id:string;reference_code:string;status:string;claimed_amount:number}
const money=(v:number)=>'৳'+v.toLocaleString('en-BD',{maximumFractionDigits:2})
export async function PilotManualPaymentBookings({bookings,userId}:{bookings:ConfirmedBooking[];userId:string}){
 const confirmed=bookings.filter(x=>x.status==='confirmed'&&x.confirmed_unit_price!=null&&x.confirmed_delivery_fee!=null)
 if(!confirmed.length)return null
 const db=await createClient()
 const [optionsResult,claimsResult]=await Promise.all([
  db.rpc('pilot_payment_options',{p_booking:confirmed[0].id}),
  db.from('pilot_booking_payment_claims').select('id,booking_id,reference_code,status,claimed_amount')
   .eq('customer_id',userId).order('submitted_at',{ascending:false}).limit(100),
 ])
 const options=(optionsResult.data??[]) as PaymentOption[]
 const claims=(claimsResult.data??[]) as Claim[]
 return <section className="mt-6 grid gap-4">
  <h2 className="text-xl font-black">Manual payments / ম্যানুয়াল পেমেন্ট</h2>
  <p className="muted text-sm">After staff confirm your booking, transfer only its agreed total to an owner-approved 2TBR recipient. Submit your actual transfer reference for staff verification. A reference is not a Finance receipt, and payment is not automatically marked as received.</p>
  {(optionsResult.error||claimsResult.error)&&<p className="notice" role="status">Manual payment is awaiting its database release. No receiving account details are being offered. Do not transfer money using guessed account details.</p>}
  {confirmed.map(b=>{
   const total=Number(b.confirmed_unit_price)*b.quantity+Number(b.confirmed_delivery_fee)
   const past=claims.filter(c=>c.booking_id===b.id)
   const open=past.some(c=>['pending','verified'].includes(c.status))
   return <article key={b.id} className="card">
    <h3 className="font-black">{b.product_name} × {b.quantity} · Ref {b.id.slice(0,8).toUpperCase()}</h3>
    <p className="mt-2 text-lg font-black">Agreed payable total: {money(total)}</p>
    {!optionsResult.error&&!claimsResult.error&&options.length===0&&<p className="notice mt-3">No approved bKash or bank account has been activated. Please arrange payment with 2TBR staff instead. Do not send money to an unverified account.</p>}
    {options.length>0&&<div className="mt-3 grid gap-2">
     {options.map(op=><div key={op.id} className="rounded-xl border p-3 text-sm">
      <b>{op.method==='bkash'?'bKash':'Bank transfer'} · {op.account_name}</b>
      <p className="mt-1 break-all font-mono font-black">{op.account_number}</p>
      {op.method==='bank'&&<p>{op.bank_name}{op.branch_name?' · '+op.branch_name:''}</p>}
     </div>)}
    </div>}
    {past.map(c=><p key={c.id} className="mt-3 rounded-xl border p-3 text-sm">
     Reference: <b>{c.reference_code}</b> · {c.status==='verified'?'Staff checked; Finance reconciliation pending':c.status==='pending'?'Awaiting independent verification':'Rejected; contact staff'}
    </p>)}
    {options.length>0&&!open&&!optionsResult.error&&!claimsResult.error&&<form action={submitPilotPaymentReference} className="mt-3 grid gap-3">
     <input type="hidden" name="booking_id" value={b.id}/>
     <label className="grid gap-1 text-sm font-bold">Receiving account used
      <select className="input" name="recipient_id" required>
       {options.map(op=><option key={op.id} value={op.id}>{op.method==='bkash'?'bKash':'Bank'} · {op.account_name} · ••••{op.account_number.slice(-4)}</option>)}
      </select>
     </label>
     <label className="grid gap-1 text-sm font-bold">Actual transaction ID / transfer reference
      <input className="input" name="reference_code" required minLength={6} maxLength={80}
       pattern="[A-Za-z0-9/_-]{6,80}" placeholder="Reference from your payment provider"/>
     </label>
     <button type="submit" className="btn-primary">Submit transfer reference for staff review</button>
    </form>}
   </article>
  })}
 </section>
}
