import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {requireOnboardedUser} from '@/lib/auth'
import {CustomerHeader} from '@/components/customer-header'
import {CustomerFooter} from '@/components/customer-footer'
import {submitPilotBooking} from '@/app/actions/pilot-booking'

export const dynamic='force-dynamic'
type Props={searchParams:Promise<{product?:string;error?:string}>}
const valid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export default async function PilotBookPage({searchParams}:Props){
 const query=await searchParams
 const selectedId=valid(query.product??'')?query.product!:''
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)redirect('/login?next='+encodeURIComponent('/pilot-book'+(selectedId?'?product='+selectedId:'')))
 const {supabase,profile}=await requireOnboardedUser()
 const {data:products,error}=await supabase.from('products')
  .select('id,name,sku,package_size,unit')
  .eq('active',true).eq('is_demo',false).order('name').limit(200)
 const items=products??[]
 const current=items.find(p=>p.id===selectedId)
 const isOpen=Date.now()<Date.parse('2026-12-31T18:00:00.000Z')
 return <main className="public-marketplace-flat customer-page-shell min-h-screen">
  <CustomerHeader actionHref="/account" actionLabel="My dashboard"/>
  <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
   <Link href="/" className="text-sm underline">← Back to shopping / বাজারে ফিরুন</Link>
   <section className="card mt-5">
    <p className="text-xs font-bold uppercase tracking-wider text-teal-700">2TBR · Pilot through 31 December 2026</p>
    <h1 className="mt-2 text-2xl font-black">Book your products / পণ্য বুক করুন</h1>
    <p className="muted mt-3 text-sm leading-6">
     Tell us what you need. Our team will verify actual stock, agree the final product price and delivery arrangements, then confirm your booking.
     No online payment is taken here, and requesting a product does not guarantee stock or a fixed price.
    </p>
    <p className="mt-2 text-sm" lang="bn">আপনার পণ্য, পরিমাণ ও ডেলিভারির তথ্য দিন। আমরা যোগাযোগ করে দাম, স্টক ও ডেলিভারি নিশ্চিত করব। এখন কোনো টাকা নেওয়া হবে না।</p>
    {!isOpen?<p className="error mt-4" role="alert">The 2026 booking pilot is closed. / পাইলট বুকিং বন্ধ।</p>:
     error?<p className="error mt-4" role="alert">Product list is temporarily unavailable. Please retry shortly.</p>:items.length===0?<p className="mt-4" role="status">No products open for booking right now.</p>:
     <form className="mt-6 grid gap-4" action={submitPilotBooking}>
      <input type="hidden" name="request_key" value={randomUUID()}/>
      {query.error&&<p className="error" role="alert">{query.error}</p>}
      <label className="grid gap-1.5 font-semibold">Product / পণ্য
       <select required name="product_id" defaultValue={current?.id??''} className="input">
        <option value="" disabled>Select a product / পণ্য বাছুন</option>
        {items.map(p=><option key={p.id} value={p.id}>{p.name} · {p.package_size} · SKU {p.sku}</option>)}
       </select>
      </label>
      <label className="grid gap-1.5 font-semibold">Quantity / পরিমাণ
       <input className="input" required type="number" name="quantity" min="1" max="20" step="1" defaultValue="1"/>
      </label>
      <fieldset className="grid gap-2 rounded-xl border p-3">
       <legend className="px-2 font-bold">How would you receive it? / সংগ্রহের পদ্ধতি</legend>
       <label className="flex gap-2"><input type="radio" name="fulfillment_method" value="pickup" defaultChecked/> Community pickup (point confirmed by staff) / পিকআপ</label>
       <label className="flex gap-2"><input type="radio" name="fulfillment_method" value="home_delivery"/> Home delivery (fees confirmed by staff) / হোম ডেলিভারি</label>
      </fieldset>
      <label className="grid gap-1.5 font-semibold">Delivery address (required for home delivery) / ঠিকানা
       <textarea className="input min-h-20" name="delivery_address" maxLength={350} placeholder="House, road, block, area and landmark"/>
      </label>
      <label className="grid gap-1.5 font-semibold">Special instruction (optional) / অতিরিক্ত নির্দেশনা
       <textarea className="input min-h-20" name="customer_note" maxLength={500} placeholder="Preferred time or product requirements"/>
      </label>
      <p className="rounded-xl border p-3 text-sm">We will contact <b>{profile.full_name}</b> at <b>{profile.phone}</b>. Your selected community is used for service-area review. To update your details, visit <Link className="underline" href="/profile">Profile</Link>.</p>
      <label className="flex items-start gap-2 text-sm">
       <input type="checkbox" name="terms_accepted" required className="mt-1"/>
       <span>I agree to the <Link href="/terms" className="underline">Terms</Link>, <Link href="/return-policy" className="underline">Return Policy</Link> and <Link href="/refund-policy" className="underline">Refund Policy</Link>, and understand this is a booking request, not a paid or confirmed order.</span>
      </label>
      <button className="btn-primary w-full py-3" type="submit">Submit booking request / বুকিং পাঠান</button>
      <Link className="text-center underline" href="/pilot-bookings">View my bookings / আমার বুকিং</Link>
     </form>}
   </section>
  </div>
  <CustomerFooter/>
 </main>
}
