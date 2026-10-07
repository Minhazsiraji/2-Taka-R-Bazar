'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOnboardedUser } from '@/lib/auth'

function text(fd:FormData,key:string){return String(fd.get(key)??'').trim()}

export async function verifyCommunityLocation(fd:FormData){
  const {supabase}=await requireOnboardedUser()
  const latitude=Number(text(fd,'latitude'))
  const longitude=Number(text(fd,'longitude'))
  const accuracy=Number(text(fd,'accuracy'))
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)){
    return {ok:false,message:'Location reading is invalid.'}
  }
  const {data,error}=await supabase.rpc('verify_my_community_location',{
    p_latitude:latitude,p_longitude:longitude,p_accuracy_m:accuracy,
  })
  if(error)return {ok:false,message:'Location verification is temporarily unavailable.'}
  const result=data?.[0] as any
  revalidatePath('/group-deals')
  return {
    ok:Boolean(result?.verified),
    configured:Boolean(result?.configured),
    message:String(result?.reason??(result?.verified?'Location verified.':'Location could not be verified.')),
    distance:result?.distance_meters==null?null:Number(result.distance_meters),
    accuracy:result?.accuracy_meters==null?null:Number(result.accuracy_meters),
  }
}

export async function joinGroupDeal(fd:FormData){
  const {supabase}=await requireOnboardedUser()
  const dealId=text(fd,'group_deal_id')
  const quantity=Number(text(fd,'quantity'))
  if(!dealId||!Number.isInteger(quantity)||quantity<1)redirect('/group-deals?error=Choose+a+valid+quantity')
  const {data,error}=await supabase.rpc('join_group_deal',{p_group_deal_id:dealId,p_quantity:quantity})
  if(error)redirect('/group-deals?error=Group+Deal+service+is+temporarily+unavailable')
  const result=data?.[0] as any
  if(!result?.accepted)redirect(`/group-deals?error=${encodeURIComponent(result?.message??'Group Deal could not be joined')}`)
  revalidatePath('/group-deals');revalidatePath('/home')
  redirect(`/group-deals?notice=${encodeURIComponent(`Joined securely. Your nearby circle is ${result.circle_members}/${result.circle_target}; community demand is ${result.community_buyers} buyers.`)}`)
}

export async function leaveGroupDeal(fd:FormData){
  const {supabase}=await requireOnboardedUser()
  const dealId=text(fd,'group_deal_id')
  if(!dealId)redirect('/group-deals?error=Group+Deal+not+found')
  const {data,error}=await supabase.rpc('leave_group_deal',{p_group_deal_id:dealId})
  if(error)redirect('/group-deals?error=Group+Deal+service+is+temporarily+unavailable')
  revalidatePath('/group-deals');revalidatePath('/home')
  redirect(`/group-deals?notice=${encodeURIComponent(String(data??'Commitment updated.'))}`)
}
