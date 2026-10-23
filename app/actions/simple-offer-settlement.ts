'use server'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
import {requireAdmin} from '@/lib/auth'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const field=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const account='/account/commitments',staff='/admin/offer-settlement'
const fail=(path:string,message:string):never=>redirect(path+'?error='+encodeURIComponent(message))
async function customerDb(){
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)redirect('/login?next=%2Faccount%2Fcommitments')
 return db
}
export async function selectQuoteDelivery(fd:FormData){
 const quote=field(fd,'quote_id'),method=field(fd,'fulfillment')
 if(!uuid.test(quote)||!['pickup','home_delivery'].includes(method))fail(account,'Choose a valid quote and delivery method')
 const db=await customerDb()
 const {error}=await db.rpc('customer_set_simple_sale_quote_delivery',{
  p_quote:quote,p_fulfillment:method,
  p_pickup_point:method==='pickup'?field(fd,'pickup_point_id')||null:null,
  p_home_address:method==='home_delivery'?field(fd,'home_address'):null
 })
 if(error)fail(account,error.message)
 revalidatePath(account);revalidatePath(staff);redirect(account+'?delivery_saved=1')
}
export async function decideQuote(fd:FormData){
 const id=field(fd,'quote_id'),decision=field(fd,'decision')
 if(!uuid.test(id)||!['accept','cancel'].includes(decision))fail(account,'Invalid decision')
 const db=await customerDb()
 const {error}=await db.rpc('customer_decide_simple_sale_quote',{
  p_quote:id,p_decision:decision,p_name:field(fd,'contact_name')||null,
  p_phone:field(fd,'contact_phone')||null,p_terms:fd.get('terms')==='on'
 })
 if(error)fail(account,error.message)
 revalidatePath(account);revalidatePath(staff);redirect(account)
}
export async function submitQuotePayment(fd:FormData){
 const id=field(fd,'quote_id'),recipient=field(fd,'recipient_id')
 if(!uuid.test(id)||!uuid.test(recipient))fail(account,'Choose a valid official recipient')
 const db=await customerDb()
 const {error}=await db.rpc('customer_submit_simple_sale_payment',{
  p_quote:id,p_recipient:recipient,p_reference:field(fd,'reference')
 })
 if(error)fail(account,error.message)
 revalidatePath(account);revalidatePath(staff);redirect(account)
}
export async function quoteDeliveryFee(fd:FormData){
 const id=field(fd,'quote_id'),fee=field(fd,'delivery_fee')
 if(!uuid.test(id)||! /^\d{1,5}(?:\.\d{1,2})?$/.test(fee))fail(staff,'Enter a valid delivery fee')
 const {supabase:db}=await requireAdmin()
 const {error}=await db.rpc('admin_quote_simple_sale_delivery',{p_quote:id,p_delivery_fee:Number(fee)})
 if(error)fail(staff,error.message)
 revalidatePath(account);revalidatePath(staff);redirect(staff)
}
export async function requestPaymentCorrection(fd:FormData){
 const id=field(fd,'quote_id'),reason=field(fd,'reason')
 if(!uuid.test(id)||reason.length<10||reason.length>500)fail(staff,'Enter a clear reason (10–500 characters)')
 const {supabase:db}=await requireAdmin()
 const {error}=await db.rpc('admin_request_simple_sale_payment_correction',{p_quote:id,p_reason:reason})
 if(error)fail(staff,error.message)
 revalidatePath(account);revalidatePath(staff);redirect(staff)
}
export async function verifyQuotePayment(fd:FormData){
 const id=field(fd,'quote_id'),verified=Number(field(fd,'verified_amount'))
 if(!uuid.test(id)||fd.get('independent_confirmation')!=='on'||!Number.isFinite(verified)||verified<=0)fail(staff,'Independently verify the official transfer and exact received amount')
 const amount=field(fd,'verified_amount')
 if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(amount))fail(staff,'Enter the exact verified amount')
 const {supabase:db}=await requireAdmin()
 const {data:quote,error:quoteError}=await db.from('simple_sale_cycle_quotes').select('product_total,delivery_fee,status').eq('id',id).single()
 if(quoteError||quote?.status!=='payment_submitted'||quote.delivery_fee===null||Math.round((Number(quote.product_total)+Number(quote.delivery_fee))*100)!==Math.round(verified*100))fail(staff,'The verified transfer amount must match the accepted final total')
 const {data,error}=await db.rpc('admin_verify_simple_sale_payment',{p_quote:id,p_verified_amount:verified,p_bank_confirmed:true})
 if(error)fail(staff,error.message)
 revalidatePath(account);revalidatePath(staff);revalidatePath('/admin/launch-orders')
 redirect(staff+'?verified='+encodeURIComponent(String(data)))
}
