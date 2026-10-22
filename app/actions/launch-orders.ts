'use server'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
import {requireAdmin} from '@/lib/auth'
const value=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
export async function submitLaunchOrder(fd:FormData){
 const db=await createClient();const {data:{user}}=await db.auth.getUser()
 if(!user)redirect('/login?next=%2Fcheckout')
 let items:unknown=[];try{items=JSON.parse(value(fd,'items'))}catch{redirect('/checkout?error=Invalid+cart')}
 const {data,error}=await db.rpc('launch_submit_order',{p_items:items,p_request_key:value(fd,'request_key'),p_name:value(fd,'contact_name'),p_phone:value(fd,'contact_phone'),p_address:value(fd,'address'),p_method:value(fd,'fulfillment'),p_terms:fd.get('terms')==='on'})
 if(error)redirect('/checkout?error='+encodeURIComponent(error.message))
 revalidatePath('/');revalidatePath('/admin/launch-orders')
 redirect('/launch-orders/'+data+'?placed=1')
}
export async function submitLaunchPayment(fd:FormData){
 const db=await createClient()
 const id=value(fd,'order_id')
 if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/account/orders')
 const {error}=await db.rpc('launch_submit_payment',{p_order:id,p_recipient:value(fd,'recipient_id'),p_reference:value(fd,'reference')})
 if(error)redirect('/launch-orders/'+id+'?error='+encodeURIComponent(error.message))
 revalidatePath('/launch-orders/'+id);revalidatePath('/admin/launch-orders')
 redirect('/launch-orders/'+id)
}
export async function reviewLaunchOrder(fd:FormData){
 const {supabase}=await requireAdmin()
 const {error}=await supabase.rpc('launch_review_order',{p_order:value(fd,'order_id'),p_decision:value(fd,'decision'),p_delivery_fee:Number(value(fd,'delivery_fee')||0),p_note:value(fd,'note')})
 revalidatePath('/');revalidatePath('/admin/launch-orders');revalidatePath('/account/orders')
 redirect('/admin/launch-orders'+(error?'?error='+encodeURIComponent(error.message):''))
}
