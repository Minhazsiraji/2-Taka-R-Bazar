'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'

function t(fd:FormData,key:string){return String(fd.get(key)??'').trim()}
function fail(message:string):never{redirect(`/admin/group-deals?error=${encodeURIComponent(message)}`)}
function done(message:string):never{redirect(`/admin/group-deals?notice=${encodeURIComponent(message)}`)}

export async function createGroupDeal(fd:FormData){
  const {supabase}=await requireAdmin()
  const communities=fd.getAll('community_id').map(String).filter(Boolean)
  const tiersRaw=t(fd,'tiers')
  const tiers=tiersRaw.split(/[\n,]+/).map(v=>v.trim()).filter(Boolean).map((entry)=>{
    const [threshold,price]=entry.split(/[:=]/).map(v=>v.trim())
    return {threshold:Number(threshold),price:Number(price)}
  })
  if(!tiers.length||tiers.some(x=>!Number.isInteger(x.threshold)||!Number.isFinite(x.price)||x.price<=0)){
    fail('Use price tiers like 5: 950, 10: 930.')
  }
  const opensAt=t(fd,'opens_at'),closesAt=t(fd,'closes_at'),pickupAt=t(fd,'pickup_at')
  const {error}=await supabase.rpc('admin_create_group_deal',{
    p_product_id:t(fd,'product_id'),
    p_title:t(fd,'title'),
    p_market_price:Number(t(fd,'market_price')),
    p_opens_at:new Date(opensAt).toISOString(),
    p_closes_at:new Date(closesAt).toISOString(),
    p_pickup_at:new Date(pickupAt).toISOString(),
    p_min_group_size:Number(t(fd,'min_group_size')||5),
    p_circle_capacity:Number(t(fd,'circle_capacity')||10),
    p_circle_radius_m:Number(t(fd,'circle_radius_m')||750),
    p_max_quantity:Number(t(fd,'max_quantity')||20),
    p_community_ids:communities,
    p_tiers:tiers,
  })
  if(error)fail(error.message)
  done('Group Deal created as draft.')
}

export async function setGroupDealStatus(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_set_group_deal_status',{
    p_group_deal_id:t(fd,'group_deal_id'),
    p_status:t(fd,'status'),
    p_reason:t(fd,'reason')||null,
  })
  if(error)fail(error.message)
  done('Group Deal status updated.')
}

export async function updateCommunityGeo(fd:FormData){
  const {supabase}=await requireAdmin()
  const enabled=fd.get('location_matching_enabled')==='on'
  const lat=t(fd,'center_latitude'),lng=t(fd,'center_longitude')
  const {error}=await supabase.rpc('admin_update_community_geo',{
    p_community_id:t(fd,'community_id'),
    p_latitude:lat===''?null:Number(lat),
    p_longitude:lng===''?null:Number(lng),
    p_radius_m:Number(t(fd,'match_radius_m')||1500),
    p_enabled:enabled,
  })
  if(error)fail(error.message)
  done('Community location-matching gate updated.')
}

export async function linkSupplierProduct(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_link_supplier_product',{
    p_supplier_id:t(fd,'supplier_id'),
    p_product_id:t(fd,'product_id'),
    p_relationship_type:t(fd,'relationship_type')||'supplier',
    p_supplier_sku:t(fd,'supplier_sku')||null,
  })
  if(error)fail(error.message)
  done('Supplier linked to product.')
}

export async function linkSupplierAccount(fd:FormData){
  const {supabase}=await requireAdmin()
  const {error}=await supabase.rpc('admin_link_supplier_account',{
    p_supplier_id:t(fd,'supplier_id'),
    p_user_id:t(fd,'user_id'),
    p_role:t(fd,'role')||'analyst',
  })
  if(error)fail(error.message)
  done('Supplier account access linked.')
}


export async function setGroupDealPurchaseRequestStatus(fd:FormData){
  const {supabase}=await requireAdmin()
  const requestId=t(fd,'request_id')
  const status=t(fd,'status')
  const note=t(fd,'admin_note')
  if(!requestId||!status)fail('Choose a request and status')
  const {error}=await supabase.rpc('admin_set_group_deal_purchase_request_status',{
    p_request_id:requestId,
    p_status:status,
    p_admin_note:note||null,
  })
  if(error)fail(error.message)
  done('Customer purchase request updated.')
}
