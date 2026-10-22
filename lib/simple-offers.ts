import type {StorefrontOffer} from './storefront'
import type {DemoFeaturedPool} from './featured-pools'
import type {PublicVendorBookingProduct} from './public-vendor-booking'

export type SimpleOfferItem={product_id:string;name:string;brand:string|null;category:string;package_size:string;unit:string;image_url:string|null;price:number;old_price:number;available_quantity:number}
export type SimpleOffer={id:string;kind:'SOLO'|'GROUP_DEAL'|'COMMUNITY_POOL';community_ids?:string[];community_id:string;community_name:string;title:string;closes_at:string|null;items:SimpleOfferItem[];buyer_count:number;pending_buyers?:number;buyer_target?:number|null}
export function simpleStorefrontOffers(rows:SimpleOffer[]):StorefrontOffer[]{
 return rows.flatMap(o=>o.items.map(p=>({offer_id:o.id,offer_kind:o.kind,community_id:o.community_id,community_ids:o.community_ids??[o.community_id],
  product_id:p.product_id,product_name:p.name,brand:p.brand,category:p.category,package_size:p.package_size,unit:p.unit,image_url:p.image_url,
  offer_title:o.community_name,reference_price:p.old_price,confirmed_price:p.price,solo_price:o.kind==='SOLO'?p.price:null,
  upcoming_price:null,buyer_count:o.buyer_count,quantity_joined:0,next_threshold:null,closes_at:o.closes_at,price_status:'final' as const,
  commerce_available_quantity:p.available_quantity,launch_offer_id:o.id,
 })))
}
export function simpleFeaturedPools(rows:SimpleOffer[]):DemoFeaturedPool[]{
 return rows.filter(o=>o.kind==='COMMUNITY_POOL').map(o=>({id:o.id,slug:'special',isDemo:false,community_id:o.community_id,community_ids:o.community_ids??[o.community_id],
  title:{en:o.title,bn:o.title},subtitle:{en:o.community_name,bn:o.community_name},description:{en:'',bn:''},
  image:o.items[0]?.image_url??'',featuredProductIds:o.items.slice(0,3).map(p=>p.product_id),
  bundle:simpleStorefrontOffers([o]).map(offer=>({offer,qty:1})),minHouseholds:0,sampleHouseholds:o.buyer_count,
  collection:{en:o.community_name,bn:o.community_name},
 }))
}
/** Includes group-only products for a cart without promoting them to Direct. */
export function simpleCartCatalog(rows:SimpleOffer[]):PublicVendorBookingProduct[]{
 return rows.flatMap(o=>o.items.map(p=>({product_id:p.product_id,name:p.name,category:p.category,package_size:p.package_size,image_url:p.image_url,
  approved_unit_price:p.price,old_price:p.old_price,available_quantity:p.available_quantity,launch_enabled:true,offer_id:o.id,
  supplier_name:'',supplier_handover_days:0,offer_title:o.title,offer_kind:o.kind,community_id:o.community_id,community_ids:o.community_ids??[o.community_id],
 })))
}
