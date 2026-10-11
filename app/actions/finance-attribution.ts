'use server'
import {requireAdmin,requireSuperAdmin} from '@/lib/auth'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
const path='/admin/finance-attribution'
const get=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
function gate(){
 const site=process.env.NEXT_PUBLIC_SUPABASE_URL??''
 if(process.env.VERCEL_ENV!=='preview'||process.env.FINANCE_WRITES_ENABLED!=='true'||!site||
 site!==process.env.FINANCE_PREVIEW_SUPABASE_URL||site.includes('sukabonfjcnaavjgjyuy')&&process.env.FINANCE_SHARED_DB_UAT_ENABLED!=='true')throw new Error('Financial writes locked outside approved Preview')
}
function outcome(message:string,error=false):never {revalidatePath(path);redirect(path+'?'+(error?'error':'notice')+'='+encodeURIComponent(message))}
export async function requestCampaignBudget(fd:FormData){
 const v=await requireAdmin()
 try{gate();const {error}=await v.supabase.rpc('finance_request_campaign_budget',{
 p_code:get(fd,'code'),p_month:get(fd,'month')+'-01',p_channel:get(fd,'channel'),p_amount:Number(get(fd,'amount')),p_reason:get(fd,'reason')});if(error)throw new Error(error.message)}catch(e){outcome(e instanceof Error?e.message:'Budget request failed',true)}
 outcome('Campaign budget submitted for independent review')
}
export async function reviewCampaignBudget(fd:FormData){
 const v=await requireSuperAdmin()
 try{gate();const {error}=await v.supabase.rpc('finance_review_campaign_budget',{
 p_id:get(fd,'budget_id'),p_approve:get(fd,'decision')==='approve',p_note:get(fd,'reason')});if(error)throw new Error(error.message)}catch(e){outcome(e instanceof Error?e.message:'Budget review failed',true)}
 outcome('Independent campaign budget review recorded')
}
export async function requestExpenseAttribution(fd:FormData){
 const v=await requireAdmin()
 try{gate();const rows=[]
 for(let i=0;i<50;i++){
  const amount=get(fd,'allocation_amount_'+i);if(!amount)continue
  rows.push({amount:Number(amount),cost_center:get(fd,'cost_center_'+i),budget_id:get(fd,'budget_id_'+i)||null,
   community_id:get(fd,'community_id_'+i)||null,pool_id:get(fd,'pool_id_'+i)||null,
   product_id:get(fd,'product_id_'+i)||null,staff_user_id:get(fd,'staff_user_id_'+i)||null})
 }
 const {error}=await v.supabase.rpc('finance_request_expense_attribution',{p_expense:get(fd,'expense_id'),p_rows:rows,p_reason:get(fd,'reason')});if(error)throw new Error(error.message)}catch(e){outcome(e instanceof Error?e.message:'Attribution request failed',true)}
 outcome('Exact expense allocation submitted for independent review')
}
export async function reviewExpenseAttribution(fd:FormData){
 const v=await requireSuperAdmin()
 try{gate();const {error}=await v.supabase.rpc('finance_review_expense_attribution',{
 p_id:get(fd,'attribution_id'),p_approve:get(fd,'decision')==='approve',p_note:get(fd,'reason')});if(error)throw new Error(error.message)}catch(e){outcome(e instanceof Error?e.message:'Attribution review failed',true)}
 outcome('Independent expense allocation review recorded')
}
