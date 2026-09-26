'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'

const t=(fd:FormData,k:string)=>String(fd.get(k)??'').trim()
const isoOrNull=(v:string)=>v?new Date(v).toISOString():null
function fail(message:string):never{redirect(`/admin/pools?error=${encodeURIComponent(message)}`)}
function done(message:string):never{revalidatePath('/admin','layout');redirect(`/admin/pools?notice=${encodeURIComponent(message)}`)}

function validateTimeline(opensAt:string|null,commitmentCloses:string|null,confirmationCloses:string|null,pickupAt:string|null){
  const ts=(v:string|null)=>v?new Date(v).getTime():null
  const open=ts(opensAt),commit=ts(commitmentCloses),confirm=ts(confirmationCloses),pickup=ts(pickupAt)
  if(open!==null&&commit!==null&&commit<=open) fail('Commitment close must be after pool open time')
  if(commit!==null&&confirm!==null&&confirm<=commit) fail('Confirmation close must be after commitment close')
  if(confirm!==null&&pickup!==null&&pickup<=confirm) fail('Pickup target must be after confirmation close')
}

export async function createPoolV2(fd:FormData){
  const {supabase,user}=await requireAdmin()
  const cadence=t(fd,'cadence')==='monthly'?'monthly':'weekly'
  const payload={
    community_id:t(fd,'community_id'),title:t(fd,'title'),cadence,status:'draft',
    opens_at:isoOrNull(t(fd,'opens_at')),commitment_closes_at:isoOrNull(t(fd,'commitment_closes_at')),
    confirmation_closes_at:isoOrNull(t(fd,'confirmation_closes_at')),pickup_at:isoOrNull(t(fd,'pickup_at')),
    notes:t(fd,'notes')||null,created_by:user.id,
  }
  if(!payload.community_id||!payload.title)fail('Community and title required')
  validateTimeline(payload.opens_at,payload.commitment_closes_at,payload.confirmation_closes_at,payload.pickup_at)
  const {error}=await supabase.from('pools').insert(payload)
  if(error)fail(error.message)
  done(`${cadence==='weekly'?'Weekly':'Monthly'} draft pool created`)
}

export async function updateDraftPool(fd:FormData){
  const {supabase}=await requireAdmin()
  const poolId=t(fd,'pool_id')
  const {data:pool,error:lookupError}=await supabase.from('pools').select('id,status').eq('id',poolId).single()
  if(lookupError||!pool)fail('Pool not found')
  if(pool.status!=='draft')fail('Return the pool to Draft before editing its setup')
  const payload={
    title:t(fd,'title'),cadence:t(fd,'cadence')==='monthly'?'monthly':'weekly',
    opens_at:isoOrNull(t(fd,'opens_at')),commitment_closes_at:isoOrNull(t(fd,'commitment_closes_at')),
    confirmation_closes_at:isoOrNull(t(fd,'confirmation_closes_at')),pickup_at:isoOrNull(t(fd,'pickup_at')),
    notes:t(fd,'notes')||null,
  }
  if(!payload.title)fail('Pool title is required')
  validateTimeline(payload.opens_at,payload.commitment_closes_at,payload.confirmation_closes_at,payload.pickup_at)
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
