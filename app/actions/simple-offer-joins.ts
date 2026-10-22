'use server'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type JoinResult={ok:boolean;joined?:boolean;code?:'SIGN_IN'|'AREA'|'UNAVAILABLE'|'SERVER';message:string}
const failure=(message:string,context:'Group Deal'|'Pool'='Group Deal'):JoinResult=>{
 if(/sign in/i.test(message))return {ok:false,code:'SIGN_IN',message:'Sign in to join this deal. Cart selections are not commitments.'}
 if(/community|account/i.test(message))return {ok:false,code:'AREA',message}
 if(/not available|does not belong/i.test(message))return {ok:false,code:'UNAVAILABLE',message}
 return {ok:false,code:'SERVER',message:'Could not record your '+context+' commitment. Please retry.'}
}
export async function joinSimpleSaleDeal(offerId:string,productId:string,areaId=''):Promise<JoinResult>{
 if(!uuid.test(offerId)||!uuid.test(productId)||areaId&&!uuid.test(areaId))return failure('This Group Deal is not available')
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return failure('Sign in to join this deal')
 const {data,error}=await db.rpc('join_simple_sale_group_deal_quantified',{p_offer:offerId,p_product:productId,p_area:areaId||null,p_quantity:1})
 if(error)return failure(error.message)
 revalidatePath('/');revalidatePath('/notifications');revalidatePath('/preview-live/product/'+productId)
 return {ok:true,joined:Boolean(data),message:data?'Group Deal commitment saved. Wait for the final tier and delivery quote; no order or payment yet.':'Already joined. Your participation is counted once; no order or payment yet.'}
}
export async function joinSimpleSalePool(offerId:string,lines:{product_id:string;quantity:number}[]):Promise<JoinResult>{
 const productIds=lines.map(i=>i.product_id)
 if(!uuid.test(offerId)||productIds.length<1||productIds.length>6||
    new Set(productIds).size!==productIds.length||productIds.some(id=>!uuid.test(id))||
    lines.some(i=>!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100))
  return failure('Selected products are not available in this Pool','Pool')
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return failure('Sign in to join this Pool','Pool')
 const {data,error}=await db.rpc('join_simple_sale_pool_quantified',{p_offer:offerId,p_lines:lines,p_area:null})
 if(error)return failure(error.message,'Pool')
 revalidatePath('/');revalidatePath('/notifications');revalidatePath('/preview-live/pool/'+offerId)
 return {ok:true,joined:Boolean(data),message:data?'Pool commitment saved. A finalized quote and your explicit acceptance are required before payment or an order.':'You are already counted in this Pool. No order has been placed.'}
}
export async function setSimpleSaleCommitmentQuantity(offerId:string,productId:string,quantity:number):Promise<JoinResult>{
 if(!uuid.test(offerId)||!uuid.test(productId)||!Number.isInteger(quantity)||quantity<1||quantity>100)
  return failure('Choose a valid commitment quantity')
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return failure('Sign in first')
 const {error}=await db.rpc('set_simple_sale_commitment_quantity',{p_offer:offerId,p_product:productId,p_quantity:quantity})
 if(error)return failure(error.message)
 revalidatePath('/');revalidatePath('/cart')
 return {ok:true,message:'Commitment quantity saved. Final price remains pending.'}
}
export async function leaveSimpleSaleDeal(offerId:string,productId:string):Promise<JoinResult>{
 if(!uuid.test(offerId)||!uuid.test(productId))return failure('This Group Deal is not available')
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return {ok:true,message:'Local cart item removed.'}
 const {data,error}=await db.rpc('leave_simple_sale_group_deal',{p_offer:offerId,p_product:productId})
 if(error)return failure(error.message)
 revalidatePath('/');revalidatePath('/notifications');revalidatePath('/preview-live/product/'+productId)
 return {ok:true,joined:false,message:data?'Left the Group Deal. Your participation was removed.':'There was no active Group Deal participation.'}
}
