'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'

const t=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
const n=(fd:FormData,k:string)=>Number(t(fd,k))
const isoOrNull=(v:string)=>v?new Date(v).toISOString():null
function fail(message:string):never{redirect(`/admin/pools?error=${encodeURIComponent(message)}`)}
function done(message:string):never{revalidatePath('/admin','layout');redirect(`/admin/pools?notice=${encodeURIComponent(message)}`)}

export async function enterPlanningTier(fd:FormData){
  const {supabase,user}=await requireAdmin()
  const poolItemId=t(fd,'pool_item_id'),supplierId=t(fd,'supplier_id'),threshold=n(fd,'threshold_quantity'),quoted=n(fd,'quoted_unit_price'),delivery=n(fd,'delivery_cost')||0,landed=n(fd,'landed_unit_price'),ceiling=n(fd,'customer_ceiling_price')
  const {data:item}=await supabase.from('pool_items').select('id,pool_id,pools(status,supplier_delivery_at)').eq('id',poolItemId).single()
  if(!item||((item as any).pools?.status)!=='draft')fail('Planning tiers are entered while the pool is Draft')
  if(!supplierId||!Number.isInteger(threshold)||threshold<1||!(quoted>0)||!(landed>0)||!(ceiling>0))fail('Complete supplier, threshold and positive planning prices')
  if(ceiling<landed)fail('Customer ceiling cannot be below delivered supplier cost')
  const {error}=await supabase.from('supplier_quotes').insert({
    pool_item_id:poolItemId,supplier_id:supplierId,quote_phase:'planning_tier',threshold_quantity:threshold,quantity:threshold,
    quoted_unit_price:quoted,delivery_cost:delivery,landed_unit_price:landed,customer_ceiling_price:ceiling,
    delivery_included:true,delivery_target_at:(item as any).pools?.supplier_delivery_at??null,valid_until:t(fd,'valid_until')||null,notes:t(fd,'notes')||null,created_by:user.id,
  })
  if(error)fail(error.message)
  done(`Planning tier saved: ${threshold} units unlock up to ৳${ceiling.toLocaleString('en-BD')}`)
}
export async function enterFinalSupplierQuote(fd:FormData){
  const {supabase,user}=await requireAdmin()
  const poolItemId=t(fd,'pool_item_id'),supplierId=t(fd,'supplier_id'),quoted=n(fd,'quoted_unit_price'),delivery=n(fd,'delivery_cost')||0,landed=n(fd,'landed_unit_price')
  const {data:item}=await supabase.from('pool_items').select('id,pool_id,frozen_committed_quantity,pools(status,supplier_delivery_at)').eq('id',poolItemId).single()
  const status=(item as any)?.pools?.status,qty=Number((item as any)?.frozen_committed_quantity??0)
  if(!item||!['pricing','final_price'].includes(status))fail('Final supplier quotes are entered only after demand is frozen in Pricing')
  if(!supplierId||qty<1||!(quoted>0)||!(landed>0))fail('Complete supplier and positive final delivered prices')
  const {error}=await supabase.from('supplier_quotes').insert({
    pool_item_id:poolItemId,supplier_id:supplierId,quote_phase:'final',quantity:qty,
    quoted_unit_price:quoted,delivery_cost:delivery,landed_unit_price:landed,available_quantity:qty,
    delivery_included:true,delivery_target_at:(item as any).pools?.supplier_delivery_at??null,
    payment_terms:t(fd,'payment_terms')||null,valid_until:t(fd,'valid_until')||null,notes:t(fd,'notes')||null,created_by:user.id,
  })
  if(error)fail(error.message)
  done(`Final supplier quote saved for frozen quantity ${qty}`)
}

export async function recordSupplierReceipt(fd:FormData){
  const {supabase}=await requireAdmin()
  const qty=n(fd,'received_quantity')
  if(!Number.isInteger(qty)||qty<0)fail('Received quantity must be zero or a positive whole number')
  const {error}=await supabase.rpc('record_supplier_receipt',{p_pool_item_id:t(fd,'pool_item_id'),p_received_quantity:qty,p_notes:t(fd,'notes')||null})
  if(error)fail(error.message)
  done('Supplier delivery receipt recorded')
}
