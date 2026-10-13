import {matchConfidentCommunity} from './smart-location.mjs'
export type StorefrontArea = {
  community_id: string
  community_name: string
  community_slug: string
  center_latitude: number | null
  center_longitude: number | null
  match_radius_m: number | null
}
export type StorefrontOffer = {
  offer_id: string
  offer_kind: 'GROUP_DEAL'|'COMMUNITY_POOL'|'SOLO'
  community_id: string
  product_id: string
  product_name: string
  brand: string|null
  category: string
  package_size: string
  unit: string
  image_url: string|null
  offer_title: string
  reference_price: number|null
  confirmed_price: number|null
  upcoming_price: number|null
  buyer_count: number
  quantity_joined: number
  next_threshold: number|null
  closes_at: string|null
  price_status: 'unlocked'|'awaiting_threshold'|'final'|'pending_final_price'
  commerce_solo_id?: string
  commerce_solo_available?: boolean
  commerce_group_id?: string
  commerce_group_phase?: string
  commerce_synthetic?: boolean
  max_per_account?: number|null
  max_per_household?: number|null
  is_demo?: boolean
  solo_price?: number | null
  product_name_bn?: string
  category_bn?: string
}
export function distanceMeters(lat1:number,lon1:number,lat2:number,lon2:number){
  const dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180
  const r=6371000,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return 2*r*Math.asin(Math.min(1,Math.sqrt(a)))
}
export function chooseAreaByLocation(areas:StorefrontArea[],latitude:number,longitude:number,accuracy:number){
  // Browse suggestions only. Neither GPS nor a manually selected area proves residency.
  return matchConfidentCommunity(areas,latitude,longitude,accuracy,distanceMeters) as StorefrontArea|null
}
export function formatPrice(value:number|null|undefined){
  return value!=null&&Number(value)>0?`৳${Number(value).toLocaleString('en-BD',{maximumFractionDigits:2})}`:'Price pending'
}
