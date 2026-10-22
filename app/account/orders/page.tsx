import Link from 'next/link'
import {CommerceFrame} from '@/components/commerce-frame'
import {requireUser} from '@/lib/auth'
import {orderStatusLabel,paymentStatusLabel} from '@/lib/commerce/labels'
import {taka as formatPrice} from '@/lib/format'

export const dynamic='force-dynamic'

type CommerceOrder={
 id:string;order_code:string;status:string;fulfillment_method:string
 payment_status:string;total_amount:number;created_at:string
}
type PilotBooking={
 id:string;product_name:string;quantity:number;status:string
 fulfillment_method:string;confirmed_unit_price:number|null
 confirmed_delivery_fee:number|null;staff_note:string|null;created_at:string
}
const pilotStatus:Record<string,string>={
 requested:'অনুরোধ পাওয়া গেছে / Requested',
 contacted:'যোগাযোগ করা হয়েছে / Contacted',
 confirmed:'বুকিং নিশ্চিত / Booking confirmed',
 cancelled:'বাতিল / Cancelled',
}

export default async function CommerceOrdersPage(){
 const {supabase,user}=await requireUser()
 // Separate customer-visible read models. Pilot booking is NOT a paid
 // Commerce order and must never create an order, inventory or Finance row here.
 const [commerce,pilot,launch]=await Promise.all([
  supabase.rpc('commerce_orders_list',{p_staff:false}),
  supabase.from('pilot_booking_requests')
   .select('id,product_name,quantity,status,fulfillment_method,confirmed_unit_price,confirmed_delivery_fee,staff_note,created_at')
   .eq('customer_id',user.id).order('created_at',{ascending:false}).limit(50),
  supabase.from('launch_orders').select('id,status,total_amount,payment_status,created_at').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(50),
 ])
 const orders=(commerce.data??[]) as CommerceOrder[]
 const bookings=(pilot.data??[]) as PilotBooking[]
 return <CommerceFrame launch={Boolean(launch.data?.length)} title="আমার অর্ডার ও বুকিং / My orders & bookings" error={commerce.error?'Commerce orders could not be loaded. Please try again.':undefined}>
{(launch.data??[]).map(o=><article className="glass-panel mb-4 rounded-3xl border border-white/80 p-5" key={o.id}><Link className="font-bold underline" href={'/launch-orders/'+o.id}>Order #{o.id.slice(0,8).toUpperCase()}</Link><p>{o.status} · {o.payment_status} · ৳{o.total_amount}</p></article>)}
  <section aria-labelledby="pilot-orders-heading" className="mb-6">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div><h2 id="pilot-orders-heading" className="text-xl font-black">পাইলট বুকিং / Pilot bookings</h2>
     <p className="mt-1 text-sm">A confirmed booking is an agreed request, not proof of payment or delivery. / বুকিং নিশ্চিত মানেই পেমেন্ট বা ডেলিভারি সম্পন্ন নয়।</p></div>
    <Link className="btn-secondary text-sm" href="/pilot-book">Book a product / পণ্য বুক করুন</Link>
   </div>
   {pilot.error?
    <p role="alert" className="rounded-xl border border-red-300 p-4">Pilot bookings could not be loaded. Please refresh to try again. / বুকিং লোড হয়নি।</p>:
    bookings.length===0?
     <p className="rounded-xl border p-4">No pilot booking requests yet. / এখনো পাইলট বুকিং নেই।</p>:
     <div className="grid gap-3">{bookings.map(b=>{
      const quoted=b.status==='confirmed'&&b.confirmed_unit_price!=null&&b.confirmed_delivery_fee!=null
      const total=quoted?Number(b.confirmed_unit_price)*b.quantity+Number(b.confirmed_delivery_fee):null
      return <article key={b.id} className="rounded-2xl border border-teal-200 p-4">
       <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold">PILOT BOOKING · Ref {b.id.slice(0,8).toUpperCase()}</p>
         <h3 className="mt-1 font-black">{b.product_name} × {b.quantity}</h3>
         <p className="mt-1 text-xs">{new Date(b.created_at).toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})}</p>
        </div>
        <strong className="rounded-full border px-3 py-1 text-xs">{pilotStatus[b.status]??b.status}</strong>
       </div>
       <p className="mt-3 text-sm">{b.fulfillment_method==='pickup'?'Community pickup / কমিউনিটি পিকআপ':'Home delivery / হোম ডেলিভারি'}</p>
       {quoted&&<p className="mt-2 font-bold">Agreed total: {formatPrice(total!)} · Payment not yet recorded / পেমেন্ট রেকর্ড হয়নি</p>}
       {!quoted&&b.status!=='cancelled'&&<p className="mt-2 text-sm">Final price and fulfillment awaiting staff confirmation / চূড়ান্ত দাম ও সংগ্রহের তথ্য নিশ্চিত হয়নি।</p>}
       {b.staff_note&&<p className="mt-2 rounded-xl border p-3 text-sm">Pickup / delivery instructions: {b.staff_note}</p>}
       <Link className="mt-3 inline-block font-semibold underline" href="/pilot-bookings">View booking details & updates / বুকিং বিস্তারিত দেখুন →</Link>
      </article>
     })}</div>}
  </section>
  <section aria-labelledby="commerce-orders-heading">
   <h2 id="commerce-orders-heading" className="mb-2 text-xl font-black">সাধারণ কেনাকাটার অর্ডার / Commerce orders</h2>
   <p className="mb-4 text-sm">Full financial checkout remains under qualification; pilot bookings are listed separately above.</p>
   <div className="grid gap-3">{orders.map(o=><Link className="rounded-2xl border p-4" href={'/account/orders/'+o.id} key={o.id}>
    <strong>{o.order_code}</strong>
    <p>{orderStatusLabel(o.status,o.fulfillment_method)} · {paymentStatusLabel(o.payment_status)}</p>
    <p className="mt-2 font-black">{formatPrice(o.total_amount)}</p>
   </Link>)}</div>
   {!commerce.error&&orders.length===0&&<p className="mt-3">No Commerce orders yet. Your pilot bookings appear above. / এখনো সাধারণ কেনাকাটার অর্ডার নেই।</p>}
   <Link className="mt-5 inline-block underline" href="/orders">আগের পুল অর্ডার / Earlier Pool orders</Link>
  </section>
 </CommerceFrame>
}
