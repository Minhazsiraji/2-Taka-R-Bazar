'use server'
import {requireAdmin,requireSuperAdmin} from '@/lib/auth'
import {uploadFinanceOriginal} from '@/lib/finance/upload-original'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
const route='/admin/finance-customers'
const get=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
function gate(){const site=process.env.NEXT_PUBLIC_SUPABASE_URL??'';if(process.env.VERCEL_ENV!=='preview'||process.env.FINANCE_WRITES_ENABLED!=='true'||!site||site!==process.env.FINANCE_PREVIEW_SUPABASE_URL||site.includes('sukabonfjcnaavjgjyuy')&&process.env.FINANCE_SHARED_DB_UAT_ENABLED!=='true')throw new Error('Financial writes locked outside approved Preview')}
function outcome(message:string,error=false):never{revalidatePath(route);revalidatePath('/super-admin/finance');revalidatePath('/super-admin/treasury');redirect(route+'?'+(error?'error':'notice')+'='+encodeURIComponent(message))}
export async function requestCustomerSale(fd:FormData){const v=await requireAdmin()
 try{gate();const proof=await uploadFinanceOriginal(v.supabase,v.user.id,fd.get('original_file'));const rows=[]
 for(let i=0;i<50;i++){const qty=get(fd,'quantity_'+i);if(qty)rows.push({line_id:get(fd,'line_id_'+i),bill_id:get(fd,'bill_id_'+i),quantity:Number(qty)})}
 const {error}=await v.supabase.rpc('finance_request_customer_sale',{p_source_kind:get(fd,'source_kind'),p_source:get(fd,'source_id'),p_rows:rows,p_reason:get(fd,'reason'),p_path:proof.path,p_sha256:proof.hash});if(error)throw new Error(error.message)
 }catch(e){outcome(e instanceof Error?e.message:'Customer sale request failed',true)}outcome('Customer sale submitted for independent revenue and inventory review')}
export async function reviewCustomerEvent(fd:FormData){const v=await requireSuperAdmin()
 try{gate();const fn=get(fd,'kind')==='credit'?'finance_review_customer_credit':'finance_review_customer_sale'
 const {error}=await v.supabase.rpc(fn,{p_id:get(fd,'event_id'),p_approve:get(fd,'decision')==='approve',p_note:get(fd,'reason')});if(error)throw new Error(error.message)
 }catch(e){outcome(e instanceof Error?e.message:'Customer event review failed',true)}outcome('Independent customer accounting review recorded')}
export async function requestCustomerCredit(fd:FormData){const v=await requireAdmin()
 try{gate();const proof=await uploadFinanceOriginal(v.supabase,v.user.id,fd.get('original_file'));const rows=[]
 for(let i=0;i<50;i++){const quantity=Number(get(fd,'credit_quantity_'+i));if(quantity>0)rows.push({line_index:Number(get(fd,'line_index_'+i)),quantity})}
 const {error}=await v.supabase.rpc('finance_request_customer_credit',{p_sale:get(fd,'sale_id'),p_rows:rows,p_delivery_refund:Number(get(fd,'delivery_refund')),p_restock:get(fd,'restock')==='yes',p_date:get(fd,'business_date'),p_reason:get(fd,'reason'),p_path:proof.path,p_sha256:proof.hash});if(error)throw new Error(error.message)
 }catch(e){outcome(e instanceof Error?e.message:'Customer credit request failed',true)}outcome('Customer credit submitted for independent return and refund review')}
export async function requestCustomerCash(fd:FormData){const v=await requireAdmin()
 try{gate();const proof=await uploadFinanceOriginal(v.supabase,v.user.id,fd.get('original_file'))
 const {error}=await v.supabase.rpc('finance_request_customer_cash',{p_sale:get(fd,'sale_id'),p_kind:get(fd,'cash_kind'),p_account:get(fd,'account_id'),p_amount:Number(get(fd,'amount')),p_date:get(fd,'business_date'),p_reference:get(fd,'reference'),p_path:proof.path,p_sha256:proof.hash});if(error)throw new Error(error.message)
 }catch(e){outcome(e instanceof Error?e.message:'Customer cash request failed',true)}outcome('Customer cash submitted to independent Treasury approval inbox')}
export async function requestCustomerCod(fd:FormData){const v=await requireAdmin()
 try{gate();const {error}=await v.supabase.rpc('finance_request_cod_allocation',{p_sale:get(fd,'sale_id'),p_day:get(fd,'day_id')});if(error)throw new Error(error.message)}catch(e){outcome(e instanceof Error?e.message:'COD allocation failed',true)}outcome('COD allocation submitted; physical cash will not be posted twice')}
export async function reviewCustomerCod(fd:FormData){const v=await requireSuperAdmin()
 try{gate();const {error}=await v.supabase.rpc('finance_review_cod_allocation',{p_id:get(fd,'cod_id'),p_approve:get(fd,'decision')==='approve',p_note:get(fd,'reason')});if(error)throw new Error(error.message)}catch(e){outcome(e instanceof Error?e.message:'COD review failed',true)}outcome('Independent COD allocation review recorded')}
