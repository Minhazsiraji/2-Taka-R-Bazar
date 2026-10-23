'use server'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export async function saveSimpleSaleDeliveryPreference(input:{
 offerId:string;fulfillment:'pickup'|'home_delivery';pickupPointId?:string;homeAddress?:string
}):Promise<{ok:boolean;message:string}>{
 if(!uuid.test(input.offerId)||!['pickup','home_delivery'].includes(input.fulfillment))
  return {ok:false,message:'Select a valid offer and delivery method.'}
 if(input.fulfillment==='pickup'&&!uuid.test(input.pickupPointId??''))
  return {ok:false,message:'Choose a pickup point from your community.'}
 if(input.fulfillment==='home_delivery'&&(input.homeAddress?.trim().length??0)<10)
  return {ok:false,message:'Enter your home delivery address.'}
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return {ok:false,message:'Sign in to save your delivery preference.'}
 const {error}=await db.rpc('save_simple_sale_delivery_preference',{
  p_offer:input.offerId,p_fulfillment:input.fulfillment,
  p_pickup_point:input.fulfillment==='pickup'?input.pickupPointId:null,
  p_home_address:input.fulfillment==='home_delivery'?input.homeAddress?.trim():null
 })
 if(error)return {ok:false,message:/pickup|community|address|no longer|join/i.test(error.message)?error.message:'Unable to save delivery preference. Please retry.'}
 revalidatePath('/cart')
 return {ok:true,message:'Delivery preference saved. The delivery fee and final tier price are not yet quoted. No order or payment was created.'}
}
