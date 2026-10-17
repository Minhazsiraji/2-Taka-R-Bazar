'use server'
import {randomUUID} from 'node:crypto'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {requireAdmin,requireOnboardedUser} from '@/lib/auth'

const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const uuid=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s)
function fail(route:string,message:string):never{
 redirect(route+(route.includes('?')?'&':'?')+'error='+encodeURIComponent(message))
}
export async function submitPilotBooking(fd:FormData){
 const {supabase}=await requireOnboardedUser()
 const product=text(fd,'product_id')
 const route='/pilot-book'+(uuid(product)?'?product='+encodeURIComponent(product):'')
 const quantity=Number(text(fd,'quantity'))
 const method=text(fd,'fulfillment_method')
 const address=text(fd,'delivery_address')
 const note=text(fd,'customer_note')
 const key=text(fd,'request_key')
 if(!uuid(product)||!uuid(key)||!Number.isInteger(quantity)||quantity<1||quantity>20)
  fail(route,'Select an available product and a quantity between 1 and 20.')
 if(!['pickup','home_delivery'].includes(method))
  fail(route,'Choose pickup or delivery.')
 if(method==='home_delivery'&&(address.length<10||address.length>350))
  fail(route,'Enter your complete delivery address (10–350 characters).')
 if(note.length>500)fail(route,'Keep the booking note within 500 characters.')
 if(fd.get('terms_accepted')!=='on')
  fail(route,'Please accept the current terms to send a booking request.')
 const {data,error}=await supabase.rpc('pilot_request_booking',{
  p_product_id:product,p_quantity:quantity,p_method:method,
  p_delivery_address:method==='home_delivery'?address:null,
  p_customer_note:note,p_request_key:key,
  p_terms_accepted:true,
 })
 if(error||!data)fail(route,error?.message??'Booking could not be saved. Please retry.')
 revalidatePath('/pilot-bookings')
 revalidatePath('/admin/pilot-bookings')
 redirect('/pilot-bookings?notice='+encodeURIComponent('Booking request received. Our team will confirm the price, stock and pickup/delivery arrangements.'))
}
export async function staffUpdatePilotBooking(fd:FormData){
 const {supabase}=await requireAdmin()
 const id=text(fd,'booking_id'),status=text(fd,'status'),note=text(fd,'staff_note')
 const price=text(fd,'unit_price'),fee=text(fd,'delivery_fee')
 if(!uuid(id)||!['contacted','confirmed','cancelled'].includes(status)||note.length>500)
  fail('/admin/pilot-bookings','Invalid booking update.')
 if(status==='confirmed'&&(!price||!fee||!Number.isFinite(Number(price))||Number(price)<=0||!Number.isFinite(Number(fee))||Number(fee)<0))
  fail('/admin/pilot-bookings','Enter the agreed unit price and delivery fee (enter 0 for free pickup).')
 const {error}=await supabase.rpc('pilot_staff_update_booking',{
  p_booking_id:id,p_status:status,
  p_unit_price:status==='confirmed'?Number(price):null,
  p_delivery_fee:status==='confirmed'?Number(fee):null,
  p_staff_note:note,
 })
 if(error)fail('/admin/pilot-bookings',error.message)
 revalidatePath('/admin/pilot-bookings')
 revalidatePath('/pilot-bookings')
 redirect('/admin/pilot-bookings?notice='+encodeURIComponent('Booking status updated. No payment or Finance journal has been created.'))
}
export async function cancelPilotBooking(fd:FormData){
 const {supabase}=await requireOnboardedUser()
 const id=text(fd,'booking_id')
 if(!uuid(id))fail('/pilot-bookings','Invalid booking.')
 const {error}=await supabase.rpc('pilot_cancel_my_booking',{p_booking_id:id})
 if(error)fail('/pilot-bookings',error.message)
 revalidatePath('/pilot-bookings')
 revalidatePath('/admin/pilot-bookings')
 redirect('/pilot-bookings?notice='+encodeURIComponent('Booking request cancelled.'))
}
