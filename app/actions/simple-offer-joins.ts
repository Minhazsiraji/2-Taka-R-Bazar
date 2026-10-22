'use server'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type JoinResult={ok:boolean;joined?:boolean;code?:'SIGN_IN'|'AREA'|'UNAVAILABLE'|'SERVER';message:string}
const failure=(message:string):JoinResult=>{
 if(/sign in/i.test(message))return {ok:false,code:'SIGN_IN',message:'Sign in to join this deal. Cart selections are not commitments.'}
 if(/community|account/i.test(message))return {ok:false,code:'AREA',message}
 if(/not available|does not belong/i.test(message))return {ok:false,code:'UNAVAILABLE',message}
 return {ok:false,code:'SERVER',message:'Could not record your Group Deal commitment. Please retry.'}
}
export async function joinSimpleSaleDeal(offerId:string,productId:string,areaId=''):Promise<JoinResult>{
 if(!uuid.test(offerId)||!uuid.test(productId)||areaId&&!uuid.test(areaId))return failure('This Group Deal is not available')
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return failure('Sign in to join this deal')
 const {data,error}=await db.rpc('join_simple_sale_group_deal',{p_offer:offerId,p_product:productId,p_area:areaId||null})
 if(error)return failure(error.message)
 revalidatePath('/');revalidatePath('/notifications');revalidatePath('/preview-live/product/'+productId)
 return {ok:true,joined:Boolean(data),message:data?'Joined this Group Deal. Complete checkout to request an order; no payment was taken.':'Already joined. Your participation is counted once.'}
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
