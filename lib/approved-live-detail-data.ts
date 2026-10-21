import type {StorefrontOffer} from '@/lib/storefront'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import type {ShowcaseProduct} from '@/lib/showcase-media'
import type {PublishedCatalogProduct} from '@/lib/published-product-catalog'
import type {ProductSeoPublic} from '@/lib/product-seo-public'

// This is a PUBLIC, display-only adapter. The source RPCs control publication and
// visibility; this module never makes a SQL query or creates a checkout price.
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type PublicLiveOffer=StorefrontOffer
export type PublicLivePool=DemoFeaturedPool
export type PublicLiveProduct={
 id:string;name:string;nameBn:string;sku:string|null;unit:string;
 category:string;brand:string|null;image:string|null;alt:string;
 retail:number|null;description:string;descriptionBn:string;
 seo:ProductSeoPublic|null;offers:PublicLiveOffer[];
}
export const validMoney=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:null
export const priceText=(n:number|null,bn=false)=>n==null?(bn?'দাম প্রকাশিত হয়নি':'Price not published'):'৳'+new Intl.NumberFormat(bn?'bn-BD':'en-BD',{maximumFractionDigits:2}).format(n)
export const safeTime=(v:string|null|undefined)=>v&&Number.isFinite(new Date(v).getTime())?v:null
export function publishedLiveOffers(offers:StorefrontOffer[],area=''){
 return offers.filter(o=>Boolean(o.product_id&&o.offer_id&&o.community_id)&&
  !o.is_demo&&!o.commerce_synthetic&&(!area||o.community_id===area))
}
export function publishedLivePools(pools:DemoFeaturedPool[],area=''){
 return pools.filter(p=>Boolean(p.id&&uuidPattern.test(p.id))&&!p.isDemo&&
  (!area||p.community_id===area)&&Array.isArray(p.bundle)&&p.bundle.some(line=>line.offer&&!line.offer.is_demo&&!line.offer.commerce_synthetic))
}
export function productFromPublicSources(id:string,offers:PublicLiveOffer[],seo:ProductSeoPublic|null,
 showcase:ShowcaseProduct|null):PublicLiveProduct|null{
 if(!uuidPattern.test(id)||(!offers.length&&!seo)||seo&&seo.product_id!==id)return null
 const first=offers[0]
 const name=seo?.title_en||showcase?.name||first?.product_name
 if(!name)return null
 const image=seo?.image_url||showcase?.image_url||first?.image_url||null
 const retail=validMoney(first?.reference_price)??null
 return {id,name,nameBn:seo?.title_bn||showcase?.name_bn||first?.product_name_bn||name,
  sku:seo?.sku||null,unit:seo?.package_size||showcase?.package_size||first?.package_size||'',
  category:seo?.category||showcase?.category||first?.category||'',
  brand:seo?.brand_type==='UNBRANDED_LOOSE'?null:(seo?.brand??showcase?.brand??first?.brand??null),
  image,alt:seo?.alt_en||name,retail,
  description:seo?.description_en||showcase?.description||'',
  descriptionBn:seo?.description_bn||showcase?.description_bn||'',
  seo,offers}
}
export function bestSoloPrice(offers:PublicLiveOffer[]):number|null{
 const available=offers.filter(o=>o.offer_kind==='SOLO'&&o.commerce_solo_available&&!o.commerce_synthetic)
 return validMoney(available[0]?.solo_price)??null
}
export function confirmedOfferPrice(offer:PublicLiveOffer):number|null{
 // upcoming_price is never presented as earned or confirmed.
 if(offer.offer_kind==='SOLO')return validMoney(offer.solo_price??offer.confirmed_price)
 return ['unlocked','final'].includes(offer.price_status)?validMoney(offer.confirmed_price):null
}
export function poolBasketTotals(lines:PublicLiveOffer[],qty:Record<string,number>){
 const seen=new Set<string>()
 const selected=lines.filter(o=>{if(seen.has(o.product_id))return false;seen.add(o.product_id)
  return Number.isInteger(qty[o.product_id])&&qty[o.product_id]>0&&qty[o.product_id]<=20})
 const units=selected.reduce((sum,o)=>sum+qty[o.product_id],0)
 const sumVerified=(get:(o:PublicLiveOffer)=>number|null)=>{
  if(!units)return 0
  const prices=selected.map(get)
  return prices.every(n=>n!==null)?selected.reduce((sum,o,i)=>sum+prices[i]!*qty[o.product_id],0):null
 }
 const retail=sumVerified(o=>validMoney(o.reference_price))
 const current=sumVerified(o=>confirmedOfferPrice(o))
 // Public Pool RPC currently does not expose authoritative starting/next-tier prices.
 // Do not derive them from retail prices or artificial percentages.
 const opening:number|null=null,next:number|null=null
 return {selected,units,retail,current,opening,next,
  saving:retail!==null&&current!==null?Math.max(0,retail-current):null}
}
export type LiveHomepageData={
 offers:PublicLiveOffer[];pools:PublicLivePool[];
 products:ShowcaseProduct[];catalog:PublishedCatalogProduct[]
}
export function hasPublishedLiveContent(data:LiveHomepageData){
 return publishedLiveOffers(data.offers).length>0||
  publishedLivePools(data.pools).length>0||data.catalog.length>0||
  data.products.some(p=>!p.is_demo)
}
