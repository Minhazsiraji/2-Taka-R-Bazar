'use server'

import { createHash,randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin,requireSuperAdmin } from '@/lib/auth'

const route='/admin/procurement'
const get=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
function requireIsolated() {
 const site=process.env.NEXT_PUBLIC_SUPABASE_URL??''
 if(process.env.VERCEL_ENV!=='preview'||process.env.FINANCE_WRITES_ENABLED!=='true'||
 !site||site!==process.env.FINANCE_PREVIEW_SUPABASE_URL||site.includes('sukabonfjcnaavjgjyuy')) {
 throw new Error('Procurement and Treasury writes locked: isolated preview database must be configured')
 }
}
function outcome(message:string,type:'error'|'notice'='notice'):never {
 revalidatePath(route)
 revalidatePath('/super-admin/treasury')
 revalidatePath('/super-admin/finance')
 redirect(route+'?'+type+'='+encodeURIComponent(message))
}
const describe=(e:unknown)=>e instanceof Error?e.message:'Procurement action failed'
async function uploadDocument(supabase:Awaited<ReturnType<typeof requireAdmin>>['supabase'],id:string,fd:FormData){
 const file=fd.get('invoice_file')
 if(!(file instanceof File)||file.size<=0||file.size>1_500_000)throw new Error('Upload a PDF/JPEG/PNG supplier invoice up to 1.5 MB')
 // File format is checked by its bytes, not merely the browser MIME declaration.
 const ext:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}
 const suffix=ext[file.type]
 if(!suffix)throw new Error('Only PDF, JPEG or PNG invoices are permitted')
 const bytes=Buffer.from(await file.arrayBuffer())
 const magic=bytes.subarray(0,8).toString('hex')
 if(!(suffix==='pdf'&&bytes.subarray(0,5).toString('ascii')==='%PDF-'||
 suffix==='jpg'&&magic.startsWith('ffd8ff')||
 suffix==='png'&&magic.startsWith('89504e470d0a1a0a')))
 throw new Error('Supplier invoice contents do not match declared file format')
 const digest=createHash('sha256').update(bytes).digest('hex')
 const location=id+'/'+randomUUID()+'.'+suffix
 const {error}=await supabase.storage.from('finance-evidence').upload(location,bytes,{contentType:file.type,upsert:false})
 if(error)throw new Error('Private supplier evidence upload failed: '+error.message)
 return {location,digest}
}
export async function procurementCreatePO(fd:FormData) {
 const v=await requireAdmin()
 try {
 requireIsolated()
 const {error}=await v.supabase.rpc('procurement_submit_po',{p_quote_id:get(fd,'quote_id'),p_note:get(fd,'note')||null})
 if(error)throw new Error(error.message)
 }catch(e){outcome(describe(e),'error')}
 outcome('Purchase order submitted for independent approval')
}
export async function procurementReviewPO(fd:FormData) {
 const v=await requireSuperAdmin()
 try {
 requireIsolated()
 const {error}=await v.supabase.rpc('procurement_review_po',{
 p_po_id:get(fd,'po_id'),p_approve:get(fd,'decision')==='approve',p_note:get(fd,'note')
 })
 if(error)throw new Error(error.message)
 }catch(e){outcome(describe(e),'error')}
 outcome('PO review recorded with independent approval audit')
}
export async function procurementLinkDispatch(fd:FormData) {
 const v=await requireAdmin()
 try {
 requireIsolated()
 const {error}=await v.supabase.rpc('procurement_link_dispatch',{p_po_id:get(fd,'po_id'),p_dispatch_id:get(fd,'dispatch_id')})
 if(error)throw new Error(error.message)
 }catch(e){outcome(describe(e),'error')}
 outcome('Supplier dispatch linked to authorized PO and item')
}
export async function procurementSubmitBill(fd:FormData) {
 const v=await requireAdmin()
 try {
 requireIsolated()
 const proof=await uploadDocument(v.supabase,v.user.id,fd)
 const quantity=Number(get(fd,'quantity')),unitPrice=Number(get(fd,'unit_price'))
 if(!Number.isInteger(quantity)||quantity<1||!Number.isFinite(unitPrice)||unitPrice<=0)throw new Error('Invalid invoice quantity or unit price')
 const {error}=await v.supabase.rpc('procurement_submit_bill',{
 p_po_id:get(fd,'po_id'),p_invoice_ref:get(fd,'invoice_reference'),
 p_invoice_date:get(fd,'invoice_date'),p_quantity:quantity,p_unit_price:unitPrice,
 p_evidence_path:proof.location,p_evidence_sha256:proof.digest
 })
 if(error)throw new Error(error.message)
 }catch(e){outcome(describe(e),'error')}
 outcome('Supplier invoice submitted for independent three-way matching')
}
export async function procurementReviewBill(fd:FormData) {
 const v=await requireSuperAdmin()
 try {
 requireIsolated()
 const {error}=await v.supabase.rpc('procurement_review_bill',{
 p_bill_id:get(fd,'bill_id'),p_approve:get(fd,'decision')==='approve',p_note:get(fd,'note')
 })
 if(error)throw new Error(error.message)
 }catch(e){outcome(describe(e),'error')}
 outcome('Supplier bill reviewed; approved goods post inventory asset and supplier payable')
}
export async function procurementRequestPayment(fd:FormData) {
 const v=await requireAdmin()
 try {
 requireIsolated()
 const {error}=await v.supabase.rpc('treasury_request_supplier_payment',{
 p_bill_id:get(fd,'bill_id'),p_bank_account:get(fd,'account_id'),
 p_reference:get(fd,'external_reference'),p_payment_date:get(fd,'payment_date')
 })
 if(error)throw new Error(error.message)
 }catch(e){outcome(describe(e),'error')}
 outcome('Supplier payment submitted to Super Admin Treasury approval inbox')
}
export async function procurementPostCommunityCash(fd:FormData) {
 const v=await requireSuperAdmin()
 try {
 requireIsolated()
 const {error}=await v.supabase.rpc('treasury_post_verified_community_cash',{
 p_day_id:get(fd,'day_id'),p_cash_account:get(fd,'cash_account_id'),
 p_reference:get(fd,'cash_custody_reference')
 })
 if(error)throw new Error(error.message)
 }catch(e){outcome(describe(e),'error')}
 outcome('Accepted COD and delivery-fee cash posted separately; revenue remains unrecognized until order/COGS reconciliation')
}
