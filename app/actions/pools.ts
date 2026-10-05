'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'

const t=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
const isoOrNull=(v:string)=>v?new Date(v).toISOString():null
const createReturnTo=(fd:FormData)=>t(fd,'return_to')==='/admin/pools/new'?'/admin/pools/new':'/admin/pools/workflow'
function fail(message:string,path='/admin/pools'):never{redirect(`${path}?error=${encodeURIComponent(message)}`)}
function done(message:string,path='/admin/pools'):never{revalidatePath('/admin','layout');redirect(`${path}?notice=${encodeURIComponent(message)}`)}
function created(title:string,id:string):never{revalidatePath('/admin','layout');redirect(`/admin/pools/workflow?notice=${encodeURIComponent(`${title} created successfully`)}&created=${encodeURIComponent(id)}#pool-${encodeURIComponent(id)}`)}

function validateTimeline(opensAt:string|null,commitmentCloses:string|null,confirmationCloses:string|null,supplierDeliveryAt:string|null,pickupAt:string|null,errorPath='/admin/pools'){
  const ts=(v:string|null)=>v?new Date(v).getTime():null
  const open=ts(opensAt),commit=ts(commitmentCloses),confirm=ts(confirmationCloses),delivery=ts(supplierDeliveryAt),pickup=ts(pickupAt)
  if(open!==null&&commit!==null&&commit<=open) fail('Commitment close must be after pool open time',errorPath)
  if(commit!==null&&confirm!==null&&confirm<=commit) fail('Confirmation close must be after commitment close',errorPath)
  if(confirm!==null&&delivery!==null&&delivery<=confirm) fail('Supplier delivery must be after customer confirmation closes',errorPath)
  if(delivery!==null&&pickup!==null&&pickup<=delivery) fail('Customer pickup must start after supplier delivery',errorPath)
}

export async function createPoolV2(fd:FormData){
  const {supabase,user}=await requireAdmin()
  const errorPath=createReturnTo(fd)
  const cadence=t(fd,'cadence')==='monthly'?'monthly':'weekly'
  const payload={
    community_id:t(fd,'community_id'),title:t(fd,'title'),cadence,status:'draft',
    opens_at:isoOrNull(t(fd,'opens_at')),commitment_closes_at:isoOrNull(t(fd,'commitment_closes_at')),
    confirmation_closes_at:isoOrNull(t(fd,'confirmation_closes_at')),supplier_delivery_at:isoOrNull(t(fd,'supplier_delivery_at')),pickup_at:isoOrNull(t(fd,'pickup_at')),
    receiving_pickup_point_id:t(fd,'receiving_pickup_point_id')||null,notes:t(fd,'notes')||null,created_by:user.id,
  }
  if(!payload.community_id||!payload.title)fail('Community and title required',errorPath)
  validateTimeline(payload.opens_at,payload.commitment_closes_at,payload.confirmation_closes_at,payload.supplier_delivery_at,payload.pickup_at,errorPath)
  if(payload.receiving_pickup_point_id){const {data:point}=await supabase.from('pickup_points').select('id').eq('id',payload.receiving_pickup_point_id).eq('community_id',payload.community_id).eq('active',true).maybeSingle();if(!point)fail('Receiving point must be active and belong to the selected community',errorPath)}
  const {data,error}=await supabase.from('pools').insert(payload).select('id').single()
  if(error||!data)fail(error?.message??'Pool could not be created',errorPath)
  created(payload.title,data.id)
}

export async function updateDraftPool(fd:FormData){
  const {supabase}=await requireAdmin()
  const poolId=t(fd,'pool_id')
  const {data:pool,error:lookupError}=await supabase.from('pools').select('id,status,community_id').eq('id',poolId).single()
  if(lookupError||!pool)fail('Pool not found')
  if(pool.status!=='draft')fail('Return the pool to Draft before editing its setup')
  const payload={
    title:t(fd,'title'),cadence:t(fd,'cadence')==='monthly'?'monthly':'weekly',
    opens_at:isoOrNull(t(fd,'opens_at')),commitment_closes_at:isoOrNull(t(fd,'commitment_closes_at')),
    confirmation_closes_at:isoOrNull(t(fd,'confirmation_closes_at')),supplier_delivery_at:isoOrNull(t(fd,'supplier_delivery_at')),pickup_at:isoOrNull(t(fd,'pickup_at')),
    receiving_pickup_point_id:t(fd,'receiving_pickup_point_id')||null,notes:t(fd,'notes')||null,
  }
  if(!payload.title)fail('Pool title is required')
  validateTimeline(payload.opens_at,payload.commitment_closes_at,payload.confirmation_closes_at,payload.supplier_delivery_at,payload.pickup_at)
  if(payload.receiving_pickup_point_id){const {data:point}=await supabase.from('pickup_points').select('id').eq('id',payload.receiving_pickup_point_id).eq('community_id',pool.community_id).eq('active',true).maybeSingle();if(!point)fail('Receiving point must be active and belong to this community')}
  const {error}=await supabase.from('pools').update(payload).eq('id',poolId)
  if(error)fail(error.message)
  done('Draft pool details updated')
}

export async function resetPoolToDraft(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_set_pool_status',{p_pool_id:t(fd,'pool_id'),p_status:'draft'})
  if(error)fail(error.message)
  done('Pool returned to Draft')
}

export async function setPoolPickupOptions(fd:FormData){
  const {supabase}=await requireAdmin()
  const poolId=t(fd,'pool_id')
  const selected=fd.getAll('pickup_point_ids').map(v=>String(v))
  const {data:pool,error:poolError}=await supabase.from('pools').select('id,community_id,status').eq('id',poolId).single()
  if(poolError||!pool)fail('Pool not found')
  if(!['draft','open','pricing','final_price','confirmation'].includes(pool.status))fail('Pickup options can no longer be changed for this pool')
  if(selected.length){
    const {data:valid,error}=await supabase.from('pickup_points').select('id').eq('community_id',pool.community_id).eq('active',true).in('id',selected)
    if(error)fail(error.message)
    if((valid??[]).length!==selected.length)fail('Every selected pickup point must be active and belong to the pool community')
  }
  const {error:deleteError}=await supabase.from('pool_pickup_points').delete().eq('pool_id',poolId)
  if(deleteError)fail(deleteError.message)
  if(selected.length){
    const {error}=await supabase.from('pool_pickup_points').insert(selected.map(pickup_point_id=>({pool_id:poolId,pickup_point_id})))
    if(error)fail(error.message)
  }
  done(selected.length?`${selected.length} pickup option(s) saved`:'Pool pickup options cleared')
}
