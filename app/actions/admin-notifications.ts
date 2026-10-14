'use server'

import {revalidatePath} from 'next/cache'
import {safeNotificationHref} from '@/lib/notification-links.mjs'
import { requireAdmin } from '@/lib/auth'

export type BroadcastInput={title:string;message:string;communityId:string|null;priority:string;href:string;poolId:string|null;requestId:string}
export async function sendAdminBroadcast(input:BroadcastInput){
 const {supabase}=await requireAdmin()
 if(!input||typeof input.title!=='string'||typeof input.message!=='string')return {ok:false,error:'Title and message are required.'}
 const title=input.title.trim(), body=input.message.trim()
 if(!title||!body) return {ok:false,error:'Title and message are required.'}
 if(title.length>80||body.length>500) return {ok:false,error:'Message is too long.'}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId))return {ok:false,error:'Review this announcement again before sending.'}
 const priority=input.priority==='urgent'||input.priority==='important'?'high':'normal'
 const {data,error}=await supabase.rpc('admin_broadcast_notification',{
  p_title:title,p_body:body,p_href:safeNotificationHref(input.href),p_priority:priority,
  p_community_id:input.communityId||null,p_pool_id:input.poolId||null,p_request_id:input.requestId
 })
 if(error) return {ok:false,error:error.message}
 revalidatePath('/admin/notifications')
 return {ok:true,count:Number(data??0)}
}
