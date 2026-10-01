'use server'

import { requireAdmin } from '@/lib/auth'

export type BroadcastInput={title:string;message:string;communityId:string|null;priority:string;href:string;poolId:string|null}
export async function sendAdminBroadcast(input:BroadcastInput){
 const {supabase}=await requireAdmin()
 const title=input.title.trim(), body=input.message.trim()
 if(!title||!body) return {ok:false,error:'Title and message are required.'}
 if(title.length>80||body.length>500) return {ok:false,error:'Message is too long.'}
 const priority=input.priority==='urgent'||input.priority==='important'?'high':'normal'
 const {data,error}=await supabase.rpc('admin_broadcast_notification',{
  p_title:title,p_body:body,p_href:input.href||'/notifications',p_priority:priority,
  p_community_id:input.communityId||null,p_pool_id:input.poolId||null
 })
 if(error) return {ok:false,error:error.message}
 return {ok:true,count:Number(data??0)}
}
