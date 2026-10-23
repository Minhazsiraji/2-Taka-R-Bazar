import 'server-only'
import {simpleStorefrontOffers,simpleFeaturedPools,type SimpleOffer} from './simple-offers'
import {scopeCommunityOffer,scopeCommunityPool} from './approved-card-view'
import type {PublicVendorBookingProduct} from './public-vendor-booking'
import {createClient} from '@/lib/supabase/server'
import {withCommerceOffers} from '@/lib/commerce/storefront'
import {publicShowcaseImageUrl,type ShowcaseProduct} from '@/lib/showcase-media'
import type {StorefrontOffer} from '@/lib/storefront'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import type {ProductSeoPublic} from '@/lib/product-seo-public'
import {productFromPublicSources,publishedLiveOffers,publishedLivePools,uuidPattern,type PublicLiveProduct} from '@/lib/approved-live-detail-data'

/** Read-only public RPCs; no service-role access, private table or writes.
 * Fail closed on public-offer RPC errors: never substitute demo records for real ones. */
export async function loadLivePublishedProduct(id:string,requestedArea?:string):Promise<PublicLiveProduct|null>{
 if(!uuidPattern.test(id))return null
 const supabase=await createClient()
 const [rawOffers,showcase,slugResult,vendorResult,simpleResult]=await Promise.all([
  supabase.rpc('get_public_storefront_offers',{p_community_id:null}),
  supabase.rpc('get_public_own_product_showcase',{p_product_id:id,p_featured_only:false}),
  supabase.rpc('get_public_product_seo_slug_for_id',{p_product_id:id}),
  supabase.rpc('get_public_launch_catalog',{p_product_id:id}),
  supabase.rpc('get_public_simple_offers'),
 ])
 const vendor=(vendorResult.error?[]:vendorResult.data??[]).find((p:PublicVendorBookingProduct)=>p.product_id===id) as PublicVendorBookingProduct|undefined
 const simple=simpleStorefrontOffers((simpleResult.error?[]:simpleResult.data??[]) as SimpleOffer[]).filter(o=>o.product_id===id)
 if(rawOffers.error&&!vendor&&!simple.length)return null
 let offers:StorefrontOffer[]=[]
 try{offers=await withCommerceOffers((rawOffers.data??[]) as StorefrontOffer[],id)}
 catch{offers=(rawOffers.data??[]) as StorefrontOffer[]}
 const {data:membership}=await supabase.rpc('get_my_community_summary')
 const selectedCommunity=membership?.[0]?.community_id??''
 const published=publishedLiveOffers([...offers,...simple]).filter(o=>o.product_id===id)
 // A public area chosen on the homepage must remain visible on details for guests
 // and accounts without onboarding. Authenticated members always see their own
 // nominated community, which the database independently enforces when joining.
 const viewedArea=selectedCommunity||(requestedArea&&uuidPattern.test(requestedArea)&&
  published.some(o=>(o.community_ids??[o.community_id]).includes(requestedArea)&&
   o.community_progress?.some(c=>c.community_id===requestedArea))?requestedArea:'')
 offers=published.map(o=>scopeCommunityOffer(o,viewedArea))
 const slug=typeof slugResult.data==='string'?slugResult.data:''
 let seo:ProductSeoPublic|null=null
 if(!slugResult.error&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=120){
  const result=await supabase.rpc('get_public_product_seo',{p_slug:slug,p_limit:1,p_offset:0})
  if(!result.error&&result.data?.[0]?.product_id===id)seo=result.data[0] as ProductSeoPublic
 }
 const publicShowcase=(showcase.error?null:showcase.data?.[0]??null) as ShowcaseProduct|null
 const product=productFromPublicSources(id,offers,seo,publicShowcase)??(vendor&&Number.isFinite(vendor.approved_unit_price)&&vendor.approved_unit_price>0?{
  id,name:vendor.name,nameBn:vendor.name,sku:null,unit:vendor.package_size,category:vendor.category,brand:null,
  image:vendor.image_url,alt:vendor.name,retail:null,listingPrice:vendor.approved_unit_price,
  description:'',descriptionBn:'',seo:null,offers,
 }:null)
 if(!product)return null
 const candidates=[product.image,publicShowcase?.image_url,...(publicShowcase?.gallery_urls??[])]
 return {...product,listingStock:vendor?.available_quantity,listingOldPrice:vendor?.old_price,launchEnabled:vendor?.launch_enabled,listingPrice:vendor?.approved_unit_price??product.listingPrice??null,image:candidates.find(x=>x&&publicShowcaseImageUrl(x))??null}
}
export async function loadLivePublishedPool(id:string,requestedArea?:string):Promise<DemoFeaturedPool|null>{
 if(!uuidPattern.test(id))return null
 const client=await createClient()
 const [legacy,simple]=await Promise.all([client.rpc('get_public_featured_pools',{p_community_id:null}),client.rpc('get_public_simple_offers')])
 const pools=[...(legacy.error?[]:legacy.data??[]) as DemoFeaturedPool[],...simpleFeaturedPools((simple.error?[]:simple.data??[]) as SimpleOffer[])]
 const {data:membership}=await client.rpc('get_my_community_summary')
 const selectedCommunity=membership?.[0]?.community_id??''
 const publicPools=publishedLivePools(pools,selectedCommunity)
 const viewedArea=selectedCommunity||(requestedArea&&uuidPattern.test(requestedArea)&&
  publicPools.some(p=>(p.community_ids??[p.community_id]).includes(requestedArea)&&
   p.bundle.some(b=>b.offer.community_progress?.some(c=>c.community_id===requestedArea)))?requestedArea:'')
 const found=publicPools.map(p=>scopeCommunityPool(p,viewedArea)).find(p=>p.id===id)
 if(!found)return null
 const offerLines=found.bundle.filter(l=>l.offer&&!l.offer.is_demo&&!l.offer.commerce_synthetic)
  .map(line=>({...line,offer:{...line.offer,image_url:line.offer.image_url&&publicShowcaseImageUrl(line.offer.image_url)?line.offer.image_url:null}}))
 return {...found,bundle:offerLines}
}
