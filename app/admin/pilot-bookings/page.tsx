import Link from 'next/link'
import {requireAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {staffUpdatePilotBooking,staffSendPilotServiceUpdate} from '@/app/actions/pilot-booking'
import {PilotManualPaymentReview} from '@/components/pilot-manual-payment-review'

export const dynamic='force-dynamic'
type Props={searchParams:Promise<{notice?:string;error?:string}>}
type Booking={id:string;product_id:string;product_name:string;quantity:number;contact_name:string;contact_phone:string;
 community_id:string;fulfillment_method:string;delivery_address:string|null;customer_note:string;
 status:string;staff_note:string;confirmed_unit_price:number|null;confirmed_delivery_fee:number|null;
 created_at:string}
export default async function PilotBookingInbox({searchParams}:Props){
 const sp=await searchParams
 const {supabase}=await requireAdmin()
 const [{data:records,error},{data:communities},{data:drafts}]=await Promise.all([
  supabase.from('pilot_booking_requests')
   .select('id,product_id,product_name,quantity,contact_name,contact_phone,community_id,fulfillment_method,delivery_address,customer_note,status,staff_note,confirmed_unit_price,confirmed_delivery_fee,created_at')
   .order('created_at',{ascending:false}).limit(150),
  supabase.from('communities').select('id,name'),
  supabase.from('vendor_offer_drafts').select('product_id,proposed_sale_price').eq('status','draft'),
 ])
 const communityMap=new Map((communities??[]).map(c=>[c.id,c.name]))
 const bookings=(records??[]) as Booking[]
 const ownerPriceByProduct=new Map((drafts??[]).map(d=>[d.product_id,Number(d.proposed_sale_price)]))
 const pending=bookings.filter(b=>b.status==='requested').length
 return <AdminShell><div className="grid gap-4">
  <section className="card">
   <p className="card-title">PILOT OPERATIONS · through 31 December 2026</p>
   <h1 className="mt-1 text-2xl font-black">Customer booking inbox</h1>
   <p className="muted mt-2">Customer requests, not paid Commerce orders. Contact promptly, confirm actual stock, agree the exact price and fees, then arrange delivery. Financial settlement must be recorded in the Finance workflow separately.</p>
   <div className="mt-3 flex flex-wrap gap-3"><span className="chip">{pending} new requests</span><span className="chip">{bookings.length} recent bookings</span><Link className="btn-secondary" href="/admin/pilot-bookings">Refresh inbox</Link><Link className="btn-primary" href="/admin/launch-orders">Customer orders</Link><Link className="btn-secondary" href="/admin/orders">Legacy orders</Link></div>
  </section>
  {sp.notice&&<p role="status" className="rounded-xl border border-teal-300 p-3">{sp.notice}</p>}
  {sp.error&&<p role="alert" className="error">{sp.error}</p>}
  {error?<section className="card error" role="alert">Pilot booking inbox could not be loaded; verify migration, permissions or connectivity.</section>:
   bookings.length===0?<section className="card">No bookings yet. Share the pilot booking link with customers.</section>:
   <div className="grid gap-4">{bookings.map(b=><article key={b.id} className="card">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div><div className="card-title">{new Date(b.created_at).toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})} · {b.id.slice(0,8).toUpperCase()}</div><h2 className="mt-1 text-lg font-black">{b.product_name} × {b.quantity}</h2><p className="text-sm">{b.contact_name} · {communityMap.get(b.community_id)??'Community not found'}</p></div>
     <strong className="rounded-full border px-3 py-1 text-sm uppercase">{b.status}</strong>
    </div>
    <p className="mt-3 text-sm"><b>Contact:</b> <a className="font-semibold underline" href={'tel:'+b.contact_phone.replace(/[^+\d]/g,'')}>{b.contact_phone}</a></p>
    <p className="mt-1 text-sm"><b>Fulfillment:</b> {b.fulfillment_method==='pickup'?'Pickup (confirm point/time)':'Home delivery'}</p>
    {b.delivery_address&&<p className="mt-1 text-sm"><b>Address:</b> {b.delivery_address}</p>}
    {b.customer_note&&<p className="mt-1 text-sm"><b>Customer note:</b> {b.customer_note}</p>}
    {b.status==='confirmed'&&<p className="mt-2 rounded-xl border p-3 text-sm">Agreed unit price: ৳{b.confirmed_unit_price} · Delivery: ৳{b.confirmed_delivery_fee} · Total: ৳{Number(b.confirmed_unit_price)*b.quantity+Number(b.confirmed_delivery_fee)}</p>}
    {b.staff_note&&<p className="muted mt-2 text-sm"><b>Last staff note:</b> {b.staff_note}</p>}
    {!['cancelled','confirmed'].includes(b.status)&&<form action={staffUpdatePilotBooking} className="mt-4 grid gap-3 rounded-xl border p-3">
     <input type="hidden" name="booking_id" value={b.id}/>
     {ownerPriceByProduct.has(b.product_id)&&<p className="rounded-lg border p-2 text-sm">Owner's unpublished proposal: <b>৳{ownerPriceByProduct.get(b.product_id)}</b> per package. Staff must independently confirm price, vendor supply and fees before booking acceptance.</p>}
     <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-bold">Agreed price per unit (৳)
       <input className="input" type="number" name="unit_price" min="0.01" step="0.01" defaultValue={b.confirmed_unit_price??ownerPriceByProduct.get(b.product_id)??''} placeholder="Confirm before accepting"/></label>
      <label className="grid gap-1 text-sm font-bold">Delivery fee (৳; 0 for free pickup)
       <input className="input" type="number" name="delivery_fee" min="0" step="0.01" defaultValue={b.confirmed_delivery_fee??''} placeholder="0 for free pickup"/></label>
     </div>
     <label className="grid gap-1 text-sm font-bold">Customer-facing update / agreed timing
      <textarea className="input" name="staff_note" maxLength={500} defaultValue={b.staff_note??''} placeholder="A message the customer will see: pickup point/time or cancellation details"/></label>
     <div className="flex flex-wrap gap-2">
      {b.status==='requested'&&<button type="submit" className="btn-secondary" name="status" value="contacted">Mark contacted</button>}
      {b.status!=='confirmed'&&<button type="submit" className="btn-primary" name="status" value="confirmed">Confirm booking</button>}
      <button type="submit" className="btn-secondary" name="status" value="cancelled">Cancel booking</button>
     </div>
    </form>}
    {b.status==='confirmed'&&<div className="mt-4 grid gap-3 rounded-xl border border-teal-200 p-3">
      <p className="text-sm font-bold">Confirm pickup point & time / সংগ্রহের স্থান ও সময়</p>
      <p className="muted text-sm">Send a customer-visible update without changing the agreed price, booking status or Finance records. If the text is unchanged, no new notification is sent.</p>
      <form action={staffSendPilotServiceUpdate} className="grid gap-3">
       <input type="hidden" name="booking_id" value={b.id}/>
       <label className="grid gap-1 text-sm font-semibold">Pickup location, scheduled time or delivery instructions
        <textarea required minLength={5} maxLength={500} className="input min-h-24" name="staff_note" defaultValue={b.staff_note??''} placeholder="Example: Collect at the agreed community point tomorrow at 6:00 PM. Please bring your booking reference."/>
       </label>
       <button type="submit" className="btn-primary">{b.staff_note?'Update instructions & notify customer':'Save instructions & notify customer'}</button>
      </form>
      <form action={staffUpdatePilotBooking}>
       <input type="hidden" name="booking_id" value={b.id}/>
       <input type="hidden" name="status" value="cancelled"/>
       <input type="hidden" name="staff_note" value="Booking cancelled by staff; please contact support."/>
       <button type="submit" className="btn-secondary">Cancel confirmed booking</button>
      </form>
    </div>}
   </article>)}</div>}
  <PilotManualPaymentReview/>
 </div></AdminShell>
}
