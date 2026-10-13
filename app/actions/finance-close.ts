'use server'
import {requireSuperAdmin} from '@/lib/auth'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
const path='/super-admin/finance-report'
const get=(f:FormData,k:string)=>String(f.get(k)??'').trim()
async function run(fd:FormData,review:boolean){
 const {supabase}=await requireSuperAdmin();let error=''
 try{
 const site=process.env.NEXT_PUBLIC_SUPABASE_URL??''
 if(process.env.VERCEL_ENV!=='preview'||process.env.FINANCE_WRITES_ENABLED!=='true'||!site||site!==process.env.FINANCE_PREVIEW_SUPABASE_URL||site.includes('sukabonfjcnaavjgjyuy')&&process.env.FINANCE_SHARED_DB_UAT_ENABLED!=='true')throw new Error('Financial writes locked outside approved Preview')
 const r=review?await supabase.rpc('finance_review_period_close',{p_id:get(fd,'close_id'),p_approve:get(fd,'decision')==='approve',p_note:get(fd,'reason')}):await supabase.rpc('finance_request_period_close',{p_month:get(fd,'month')+'-01',p_reason:get(fd,'reason'),p_suspense_explanation:get(fd,'suspense_explanation')})
 if(r.error)throw new Error(r.error.message)
 }catch(e){error=e instanceof Error?e.message:'Period close failed'}
 revalidatePath(path);redirect(path+'?month='+encodeURIComponent(get(fd,'month'))+'&'+(error?'error='+encodeURIComponent(error):'notice=Independent+close+request+recorded'))
}
export async function requestPeriodClose(fd:FormData){return run(fd,false)}
export async function reviewPeriodClose(fd:FormData){return run(fd,true)}
