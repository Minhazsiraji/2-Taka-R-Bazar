'use server'

import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {requireAdmin} from '@/lib/auth'

function value(fd:FormData,key:string){return String(fd.get(key)??'').trim()}
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
const target='/admin/delivery-locations'
function error(message:string):never{redirect(target+'?error='+encodeURIComponent(message))}
function success(message:string):never{revalidatePath(target);redirect(target+'?notice='+encodeURIComponent(message))}

export async function registerDeliveryBuilding(fd:FormData){
 const {supabase}=await requireAdmin()
 const community=value(fd,'community_id'),zone=value(fd,'zone_code'),code=value(fd,'building_code')
 const name=value(fd,'display_name'),evidence=value(fd,'evidence_note')
 if(!uuid.test(community)||!zone||!code||name.length<2||evidence.length<10)
  error('Provide the community, zone, building identifier and evidence note.')
 const {error:failure}=await supabase.rpc('admin_register_delivery_building',{
  p_community_id:community,p_zone_code:zone,p_building_code:code,
  p_display_name:name,p_evidence_note:evidence,
 })
 if(failure)error('Building registration failed. Check identifiers and permissions.')
 success('Verified building registered for internal delivery grouping.')
}

export async function reviewDeliveryAddress(fd:FormData){
 const {supabase}=await requireAdmin()
 const addressId=value(fd,'address_id'),buildingId=value(fd,'building_id')
 const approved=value(fd,'decision')==='approve',evidence=value(fd,'evidence_note')
 if(!uuid.test(addressId)||evidence.length<10||(approved&&!uuid.test(buildingId)))
  error('Select an address and verified building, with an evidence note.')
 const {error:failure}=await supabase.rpc('admin_review_delivery_address',{
  p_address_id:addressId,p_building_id:approved?buildingId:null,
  p_approve:approved,p_evidence_note:evidence,
 })
 if(failure)error('Address review failed. Verify your authorization and community details.')
 success(approved?'Address verified for trusted building-level grouping.':'Address rejected; customer must update it.')
}
