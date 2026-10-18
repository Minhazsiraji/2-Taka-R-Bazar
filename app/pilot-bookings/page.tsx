import Link from 'next/link'
import {requireOnboardedUser} from '@/lib/auth'
import {CustomerHeader} from '@/components/customer-header'
import {CustomerFooter} from '@/components/customer-footer'
import {cancelPilotBooking} from '@/app/actions/pilot-booking'

export const dynamic='force-dynamic'
type Params={searchParams:Promise<{notice?:string;error?:string}>}
type Booking={id:string;product_name:string;quantity:number;fulfillment_method:string;delivery_address:string|null;status:string;created_at:string;confirmed_unit_price:number|null;confirmed_delivery_fee:number|null;staff_note:string|null}
const format=(amount:number)=>'৳'+Number(amount).toLocaleString('en-BD',{maximumFractionDigits:2})
export default async function MyPilotBookings({searchParams}:Params){
 const sp=await searchParams
 const {supabase,user}=await requireOnboardedUser()
 const {data,error}=await supabase.from('pilot_booking_requests')
  .select('id,product_name,quantity,fulfillment_method,delivery_address,status,created_at,confirmed_unit_price,confirmed_delivery_fee,staff_note')
  .eq('customer_id',user.id).order('created_at',{ascending:false}).limit(50)
 const bookings=(data??[]) as Booking[]
 return <main className="public-marketplace-flat customer-page-shell min-h-screen">
  <CustomerHeader actionHref="/account" actionLabel="My dashboard"/>
  <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
   <Link href="/" className="underline text-sm">← Back to shopping</Link>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
    <div><p className="text-xs font-bold uppercase text-teal-700">2TBR pilot</p><h1 className="text-3xl font-black">My bookings / আমার বুকিং</h1></div>
    <Link href="/pilot-book" className="btn-primary">Request another product</Link>
   </div>
   <p className="muted mt-3 text-sm">Bookings are requests until confirmed by our team. No online payment, stock reservation or automatic Finance entry is made on this page.</p>
   {sp.notice&&<p role="status" className="mt-4 rounded-xl border border-teal-300 p-3 text-sm">{sp.notice}</p>}
   {sp.error&&<p role="alert" className="error mt-4">{sp.error}</p>}
   {error?<p className="error mt-5" role="alert">Bookings could not be loaded. Please refresh.</p>:
    bookings.length===0?<section className="card mt-5">No booking requests yet. / এখনো কোনো বুকিং নেই।</section>:
    <div className="mt-5 grid gap-4">{bookings.map(item=><article className="card" key={item.id}>
     <div className="flex flex-wrap justify-between gap-3">
      <div><h2 className="text-lg font-black">{item.product_name} × {item.quantity}</h2><p className="muted mt-1 text-xs">{new Date(item.created_at).toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})} · Ref {item.id.slice(0,8).toUpperCase()}</p></div>
      <strong className="rounded-full border border-teal-200 px-3 py-1 text-sm uppercase">{item.status}</strong>
     </div>
     <p className="mt-3 text-sm">{item.fulfillment_method==='pickup'
      ?item.staff_note?'Community pickup · see confirmed arrangements below':'Community pickup · point to be agreed'
      :item.staff_note?'Home delivery · see confirmed arrangements below':'Home delivery · address to be confirmed'}</p>
     {item.delivery_address&&<p className="muted mt-1 text-sm">{item.delivery_address}</p>}
     {item.status==='confirmed'&&item.confirmed_unit_price!=null&&item.confirmed_delivery_fee!=null&&
      <p className="mt-3 rounded-xl border p-3 text-sm font-semibold">Agreed products: {format(item.confirmed_unit_price*item.quantity)} · Delivery: {format(item.confirmed_delivery_fee)} · Total: {format(item.confirmed_unit_price*item.quantity+item.confirmed_delivery_fee)}. Pay at collection / delivery, as agreed.</p>}
     {item.staff_note&&<p className="mt-2 rounded-xl border border-teal-200 p-3 text-sm"><b>Pickup / delivery instructions:</b> {item.staff_note}</p>}
     {['requested','contacted'].includes(item.status)&&<form action={cancelPilotBooking} className="mt-3">
      <input type="hidden" name="booking_id" value={item.id}/><button type="submit" className="btn-secondary text-sm">Cancel this request</button>
     </form>}
    </article>)}</div>}
  </div>
  <CustomerFooter/>
 </main>
}
