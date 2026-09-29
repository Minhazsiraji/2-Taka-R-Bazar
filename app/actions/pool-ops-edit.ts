'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'

const t=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
const isoOrNull=(v:string)=>v?new Date(v).toISOString():null
const target=(poolId:string,message:string,key:'error'|'notice')=>`/admin/pools/edit?pool=${encodeURIComponent(poolId)}&${key}=${encodeURIComponent(message)}`
function fail(poolId:string,message:string):never{redirect(target(poolId,message,'error'))}
function done(poolId:string,message:string):never{revalidatePath('/admin','layout');revalidatePath('/pool');revalidatePath(`/admin/pools/${poolId}`);redirect(target(poolId,message,'notice'))}

function validateTimeline(poolId:string,commitmentCloses:string|null,confirmationCloses:string|null,supplierDeliveryAt:string|null,pickupAt:string|null){
  const ts=(v:string|null)=>v?new Date(v).getTime():null
  const commit=ts(commitmentCloses),confirm=ts(confirmationCloses),delivery=ts(supplierDeliveryAt),pickup=ts(pickupAt)
  if(commit!==null&&confirm!==null&&confirm<=commit)fail(poolId,'Confirmation close must be after commitment close')
  if(confirm!==null&&delivery!==null&&delivery<=confirm)fail(poolId,'Supplier delivery must be after customer confirmation closes')
  if(delivery!==null&&pickup!==null&&pickup<=delivery)fail(poolId,'Customer pickup must start after supplier delivery')
}

export async function updateActivePoolDetails(fd:FormData){
  const {supabase}=await requireAdmin()
  const poolId=t(fd,'pool_id')
  const {data:pool,error:lookupError}=await supabase.from('pools').select('id,status,community_id').eq('id',poolId).single()
  if(lookupError||!pool)fail(poolId,'Pool not found')
  if(!['open','pricing','final_price','confirmation'].includes(pool.status))fail(poolId,'Only an active pre-order pool can be edited here')

  const payload={
    title:t(fd,'title'),
    commitment_closes_at:isoOrNull(t(fd,'commitment_closes_at')),
    confirmation_closes_at:isoOrNull(t(fd,'confirmation_closes_at')),
    supplier_delivery_at:isoOrNull(t(fd,'supplier_delivery_at')),
    pickup_at:isoOrNull(t(fd,'pickup_at')),
    receiving_pickup_point_id:t(fd,'receiving_pickup_point_id')||null,
    notes:t(fd,'notes')||null,
  }
  if(!payload.title)fail(poolId,'Pool title is required')
  validateTimeline(poolId,payload.commitment_closes_at,payload.confirmation_closes_at,payload.supplier_delivery_at,payload.pickup_at)
  if(payload.receiving_pickup_point_id){
    const {data:point}=await supabase.from('pickup_points').select('id').eq('id',payload.receiving_pickup_point_id).eq('community_id',pool.community_id).eq('active',true).maybeSingle()
    if(!point)fail(poolId,'Receiving point must be active and belong to this community')
  }
  const {error}=await supabase.from('pools').update(payload).eq('id',poolId)
  if(error)fail(poolId,error.message)
  done(poolId,'Active pool operational details updated')
}
