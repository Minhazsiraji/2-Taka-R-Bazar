import 'server-only'
import {createClient} from '@/lib/supabase/server'
import {withCommerceOffers} from '@/lib/commerce/storefront'
import {publicShowcaseImageUrl,type ShowcaseProduct} from '@/lib/showcase-media'
import type {StorefrontOffer} from '@/lib/storefront'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import type {ProductSeoPublic} from '@/lib/product-seo-public'
import {productFromPublicSources,publishedLiveOffers,publishedLivePools,uuidPattern,type PublicLiveProduct} from '@/lib/approved-live-detail-data'

/** Read-only public RPCs; no service-role access, private table or writes.
 * Fail closed on public-offer RPC errors: never substitute demo records for real ones. */
export async function loadLivePublishedProduct(id:string):Promise<PublicLiveProduct|null>{
 if(!uuidPattern.test(id))return null
 const supabase=await createClient()
 const [rawOffers,showcase,slugResult]=await Promise.all([
  supabase.rpc('get_public_storefront_offers',{p_community_id:null}),
  supabase.rpc('get_public_own_product_showcase',{p_product_id:id,p_featured_only:false}),
  supabase.rpc('get_public_product_seo_slug_for_id',{p_product_id:id}),
 ])
 if(rawOffers.error)return null
 let offers:StorefrontOffer[]=[]
 try{offers=await withCommerceOffers((rawOffers.data??[]) as StorefrontOffer[],id)}
 catch{offers=(rawOffers.data??[]) as StorefrontOffer[]}
 offers=publishedLiveOffers(offers).filter(o=>o.product_id===id)
 const slug=typeof slugResult.data==='string'?slugResult.data:''
 let seo:ProductSeoPublic|null=null
 if(!slugResult.error&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=120){
  const result=await supabase.rpc('get_public_product_seo',{p_slug:slug,p_limit:1,p_offset:0})
  if(!result.error&&result.data?.[0]?.product_id===id)seo=result.data[0] as ProductSeoPublic
 }
 const publicShowcase=(showcase.error?null:showcase.data?.[0]??null) as ShowcaseProduct|null
 const product=productFromPublicSources(id,offers,seo,publicShowcase)
 if(!product)return null
 const candidates=[product.image,publicShowcase?.image_url,...(publicShowcase?.gallery_urls??[])]
 return {...product,image:candidates.find(x=>x&&publicShowcaseImageUrl(x))??null}
}
export async function loadLivePublishedPool(id:string):Promise<DemoFeaturedPool|null>{
 if(!uuidPattern.test(id))return null
 const client=await createClient()
 const {data,error}=await client.rpc('get_public_featured_pools',{p_community_id:null})
 if(error||!Array.isArray(data))return null
 const found=publishedLivePools(data as DemoFeaturedPool[]).find(p=>p.id===id)
 if(!found)return null
 const offerLines=found.bundle.filter(l=>l.offer&&!l.offer.is_demo&&!l.offer.commerce_synthetic)
 return {...found,bundle:offerLines}
}
