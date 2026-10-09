'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, requirePickupOperator } from '@/lib/auth'

const t=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
const n=(fd:FormData,k:string)=>Number(t(fd,k))
const go=(path:string,message:string,type:'notice'|'error'='notice'):never=>redirect(`${path}?${type}=${encodeURIComponent(message)}`)
const dayPath=(id:string)=>`/community-ops?day=${encodeURIComponent(id)}`

export async function startCommunityOpsDay(fd:FormData){
  const {supabase}=await requirePickupOperator()
  const community=t(fd,'community_id'),businessDate=t(fd,'business_date')||null
  if(!community)go('/community-ops','Choose a community','error')
  const {data,error}=await supabase.rpc('start_community_ops_day',{p_community_id:community,p_business_date:businessDate})
  if(error)go('/community-ops',error.message,'error')
  revalidatePath('/community-ops')
  redirect(dayPath(String(data)))
}

export async function refreshCommunityOpsManifest(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id')
  const {data,error}=await supabase.rpc('refresh_community_ops_manifest',{p_day_id:day})
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops')
  go(dayPath(day),`Manifest refreshed · ${Number(data??0)} new order(s)`)
}

export async function recordCommunityInbound(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id')
  const payload={
    p_day_id:day,p_product_id:t(fd,'product_id'),p_source_type:t(fd,'source_type'),
    p_source_name:t(fd,'source_name')||null,p_expected_quantity:n(fd,'expected_quantity'),
    p_received_quantity:n(fd,'received_quantity'),p_damaged_quantity:n(fd,'damaged_quantity')||0,
    p_returned_quantity:n(fd,'returned_quantity')||0,p_exception_code:t(fd,'exception_code')||null,
    p_exception_reason:t(fd,'exception_reason')||null,p_notes:t(fd,'notes')||null,
  }
  const {error}=await supabase.rpc('record_community_ops_inbound',payload)
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops');go(dayPath(day),'Inbound receipt recorded')
}

export async function recordCommunityStockAdjustment(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id')
  const {error}=await supabase.rpc('record_community_ops_stock_adjustment',{
    p_day_id:day,p_product_id:t(fd,'product_id'),p_disposition:t(fd,'disposition'),
    p_quantity:n(fd,'quantity'),p_reason:t(fd,'reason'),p_notes:t(fd,'notes')||null,
  })
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops');go(dayPath(day),'Stock disposition recorded')
}

export async function verifyCommunityOrder(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id'),order=t(fd,'order_id')
  const {error}=await supabase.rpc('verify_community_ops_order',{p_day_id:day,p_order_id:order,p_notes:t(fd,'notes')||null})
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops');go(dayPath(day),'Order goods verified')
}

export async function completeCommunityOrder(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id'),order=t(fd,'order_id')
  const rawCost=t(fd,'actual_delivery_cost')
  const {error}=await supabase.rpc('complete_community_ops_order',{
    p_day_id:day,p_order_id:order,p_product_cash:n(fd,'product_cash')||0,p_delivery_cash:n(fd,'delivery_cash')||0,
    p_actual_delivery_cost:rawCost===''?null:Number(rawCost),p_notes:t(fd,'notes')||null,
  })
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops');revalidatePath('/orders');revalidatePath('/savings')
  go(dayPath(day),'Customer handover completed and cash reconciled')
}

export async function recordCommunityOrderException(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id'),order=t(fd,'order_id')
  const {error}=await supabase.rpc('record_community_ops_order_exception',{
    p_day_id:day,p_order_id:order,p_exception_code:t(fd,'exception_code'),p_exception_reason:t(fd,'exception_reason'),
    p_product_cash:n(fd,'product_cash')||0,p_delivery_cash:n(fd,'delivery_cash')||0,p_notes:t(fd,'notes')||null,
  })
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops');revalidatePath('/admin/issues')
  go(dayPath(day),'Exception recorded and sent to the issue queue')
}

export async function submitCommunityOpsReport(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id')
  const {error}=await supabase.rpc('submit_community_ops_report',{p_day_id:day,p_report_note:t(fd,'report_note')||null})
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops');revalidatePath('/admin/community-ops')
  go(dayPath(day),'Daily community report submitted')
}

export async function submitCommunityCashHandover(fd:FormData){
  const {supabase}=await requirePickupOperator();const day=t(fd,'day_id')
  const {error}=await supabase.rpc('submit_community_ops_cash_handover',{
    p_day_id:day,p_product_cod:n(fd,'product_cod'),p_delivery_fees:n(fd,'delivery_fees'),p_note:t(fd,'note')||null,
  })
  if(error)go(dayPath(day),error.message,'error')
  revalidatePath('/community-ops');revalidatePath('/admin/community-ops')
  go(dayPath(day),'Cash handover submitted to Admin/Accounts')
}

export async function assignCommunityOperator(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_assign_community_operator',{p_user_id:t(fd,'user_id'),p_community_id:t(fd,'community_id')})
  if(error)go('/admin/community-ops',error.message,'error')
  revalidatePath('/admin/community-ops');go('/admin/community-ops','Community officer assigned')
}

export async function removeCommunityOperator(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_remove_community_operator',{p_user_id:t(fd,'user_id'),p_community_id:t(fd,'community_id')})
  if(error)go('/admin/community-ops',error.message,'error')
  revalidatePath('/admin/community-ops');go('/admin/community-ops','Community officer assignment removed')
}

export async function adminAcceptCommunityCash(fd:FormData){
  const {supabase}=await requireAdmin();const day=t(fd,'day_id')
  const {error}=await supabase.rpc('admin_accept_community_ops_cash',{
    p_day_id:day,p_product_cod_received:n(fd,'product_cod_received'),p_delivery_fees_received:n(fd,'delivery_fees_received'),
    p_accept_exceptions:fd.get('accept_exceptions')==='on',p_note:t(fd,'note')||null,
  })
  if(error)go('/admin/community-ops',error.message,'error')
  revalidatePath('/admin/community-ops');revalidatePath('/community-ops')
  go('/admin/community-ops','Community cash reconciliation accepted and day closed')
}
