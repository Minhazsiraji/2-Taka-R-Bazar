'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, requirePickupOperator, requireUser } from '@/lib/auth'

const t=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
const n=(fd:FormData,k:string)=>Number(t(fd,k))
const go=(path:string,message:string,type:'notice'|'error'='notice'):never=>redirect(path+(path.includes('?')?'&':'?')+type+'='+encodeURIComponent(message))

function dispatchItems(fd:FormData){
  const products=fd.getAll('product_id').map(v=>String(v).trim())
  const quantities=fd.getAll('quantity').map(v=>Number(String(v)))
  const items=products.map((product_id,i)=>({product_id,quantity:quantities[i]}))
    .filter(x=>x.product_id&&Number.isInteger(x.quantity)&&x.quantity>0)
  if(!items.length) throw new Error('Add at least one product and quantity')
  return items
}

function receiptItems(fd:FormData){
  const products=fd.getAll('product_id').map(v=>String(v).trim())
  const received=fd.getAll('received_quantity').map(v=>Number(String(v)))
  const damaged=fd.getAll('damaged_quantity').map(v=>Number(String(v)||'0'))
  const returned=fd.getAll('returned_quantity').map(v=>Number(String(v)||'0'))
  return products.map((product_id,i)=>({
    product_id,
    received_quantity:received[i],
    damaged_quantity:damaged[i]||0,
    returned_quantity:returned[i]||0,
  }))
}

export async function createSupplyDispatch(fd:FormData){
  const {supabase}=await requireUser()
  let items
  try{items=dispatchItems(fd)}catch(e:any){go('/supply',e.message,'error')}
  const sourceKind=t(fd,'source_kind'),sourceId=t(fd,'source_id')
  const {data,error}=await supabase.rpc('create_supply_dispatch',{
    p_source_kind:sourceKind,p_source_id:sourceId,p_source_reference:t(fd,'source_reference'),p_destination_community_id:t(fd,'community_id'),
    p_items:items,p_notes:t(fd,'notes')||null,
  })
  if(error)go('/supply',error.message,'error')
  revalidatePath('/supply')
  go('/supply?source_kind='+encodeURIComponent(sourceKind)+'&source_id='+encodeURIComponent(sourceId),'Dispatch created: '+String(data))
}

export async function sealSupplyDispatch(fd:FormData){
  const {supabase}=await requireUser()
  const dispatchId=t(fd,'dispatch_id')
  const {data,error}=await supabase.rpc('seal_supply_dispatch',{
    p_dispatch_id:dispatchId,p_package_count:n(fd,'package_count'),p_seal_reference:t(fd,'seal_reference')||null,
  })
  if(error)go('/supply',error.message,'error')
  const jar=await cookies()
  jar.set('supply_handover_code',JSON.stringify({dispatchId,code:String(data)}),{
    httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/supply',maxAge:300,
  })
  revalidatePath('/supply')
  go('/supply','Dispatch sealed. Show the one-time handover code only to the receiving Community Ops officer.')
}

export async function carrierAcknowledgeSupplyDispatch(fd:FormData){
  const {supabase}=await requireUser()
  const {error}=await supabase.rpc('carrier_acknowledge_supply_dispatch',{p_dispatch_id:t(fd,'dispatch_id')})
  if(error)go('/supply',error.message,'error')
  revalidatePath('/supply')
  go('/supply','Carrier custody acknowledged')
}

export async function receiveSupplyDispatch(fd:FormData){
  const {supabase}=await requirePickupOperator()
  const day=t(fd,'day_id')
  const {data,error}=await supabase.rpc('receive_supply_dispatch',{
    p_day_id:day,
    p_dispatch_id:t(fd,'dispatch_id'),
    p_handover_code:t(fd,'handover_code'),
    p_observed_package_count:n(fd,'observed_package_count'),
    p_observed_seal_reference:t(fd,'observed_seal_reference')||null,
    p_items:receiptItems(fd),
    p_receiver_note:t(fd,'receiver_note')||null,
  })
  const base='/community-ops?day='+encodeURIComponent(day)
  if(error)go(base,error.message,'error')
  const result=String(data)
  revalidatePath('/community-ops');revalidatePath('/admin/supply-control');revalidatePath('/supply')
  if(result==='verified')go(base,'Supply batch verified. Sender and receiver records matched and stock was posted.')
  if(result==='variance')go(base,'Supply batch received with a variance. Stock is held from verified inventory until Admin resolves it.','error')
  if(result==='invalid_code')go(base,'Invalid handover code. Repeated failures trigger a security hold.','error')
  if(result==='security_hold')go(base,'Dispatch is on security hold. Admin review is required.','error')
  go(base,'Handover code has already been used. Admin review is required.','error')
}

export async function adminCreateSupplyLocation(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_create_supply_location',{
    p_name:t(fd,'name'),p_location_type:t(fd,'location_type'),p_address:t(fd,'address')||null,
  })
  if(error)go('/admin/supply-control',error.message,'error')
  revalidatePath('/admin/supply-control');go('/admin/supply-control','Internal supply location created')
}

export async function adminAssignSupplyLocationMember(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_assign_supply_location_member',{
    p_location_id:t(fd,'location_id'),p_user_id:t(fd,'user_id'),p_role:t(fd,'role'),
  })
  if(error)go('/admin/supply-control',error.message,'error')
  revalidatePath('/admin/supply-control');revalidatePath('/supply')
  go('/admin/supply-control','Store/warehouse account assigned')
}

export async function adminLinkSupplierSupplyAccount(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_link_supplier_account',{
    p_supplier_id:t(fd,'supplier_id'),p_user_id:t(fd,'user_id'),p_role:t(fd,'role'),
  })
  if(error)go('/admin/supply-control',error.message,'error')
  revalidatePath('/admin/supply-control');revalidatePath('/supply')
  go('/admin/supply-control','Supplier account linked')
}

export async function adminAuthorizeSupplyDispatch(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_authorize_supply_dispatch',{
    p_dispatch_id:t(fd,'dispatch_id'),p_note:t(fd,'note')||null,
  })
  if(error)go('/admin/supply-control',error.message,'error')
  revalidatePath('/admin/supply-control');revalidatePath('/supply')
  go('/admin/supply-control','Supplier dispatch authorized for sealing')
}

export async function adminAssignSupplyCarrier(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_assign_supply_carrier',{
    p_dispatch_id:t(fd,'dispatch_id'),p_user_id:t(fd,'user_id'),
  })
  if(error)go('/admin/supply-control',error.message,'error')
  revalidatePath('/admin/supply-control');revalidatePath('/supply')
  go('/admin/supply-control','Carrier assigned')
}

export async function adminResolveSupplyVariance(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_resolve_supply_variance',{
    p_dispatch_id:t(fd,'dispatch_id'),p_resolution:t(fd,'resolution'),
    p_responsibility:t(fd,'responsibility'),p_reason:t(fd,'reason'),
    p_day_id:t(fd,'day_id')||null,
  })
  if(error)go('/admin/supply-control',error.message,'error')
  revalidatePath('/admin/supply-control');revalidatePath('/community-ops');revalidatePath('/supply')
  go('/admin/supply-control','Supply exception resolution saved')
}
