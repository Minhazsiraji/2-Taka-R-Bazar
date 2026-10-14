import 'server-only'
import {createClient} from '@/lib/supabase/server'
import {SITE_NAME,SITE_URL} from '@/lib/site'

export type ProductSeoPublic={
 product_id:string;slug:string;sku:string;
 title_en:string;title_bn:string;short_en:string;short_bn:string;
 description_en:string;description_bn:string;meta_title_en:string;meta_title_bn:string;
 meta_description_en:string;meta_description_bn:string;alt_en:string;alt_bn:string;
 specs:Record<string,string>;faqs:Array<{question_en:string;answer_en:string;question_bn:string;answer_bn:string}>;
 media:Array<{kind:'gallery'|'marketing';url:string;alt_en:string;alt_bn:string}>;
 brand:string|null;brand_type:string;category:string;package_size:string;unit:string;
 image_url:string|null;updated_at:string
}
export const validSlug=(slug:string)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=120
export function productUrls(slug:string){return {en:SITE_URL+'/p/'+slug,bn:SITE_URL+'/bn/p/'+slug}}
export function productMeta(p:ProductSeoPublic,locale:'en'|'bn'){
 const bn=locale==='bn',name=bn?p.title_bn:p.title_en
 const title=(bn?p.meta_title_bn:p.meta_title_en)||name+' | '+SITE_NAME
 const description=(bn?p.meta_description_bn:p.meta_description_en)||(bn?p.short_bn:p.short_en)
 const urls=productUrls(p.slug)
 return {
  title:{absolute:title},description,
  alternates:{canonical:urls[locale],languages:{'en-BD':urls.en,'bn-BD':urls.bn,'x-default':urls.en}},
  openGraph:{title,description,url:urls[locale],locale:bn?'bn_BD':'en_BD',alternateLocale:[bn?'en_BD':'bn_BD'],type:'website' as const,
   images:p.image_url?[{url:p.image_url,alt:bn?p.alt_bn:p.alt_en}]:undefined},
 }
}
export async function loadPublicProduct(slug:string):Promise<{product:ProductSeoPublic|null;canonicalSlug:string|null}>{
 if(!validSlug(slug))return {product:null,canonicalSlug:null}
 const supabase=await createClient()
 const {data,error}=await supabase.rpc('get_public_product_seo',{p_slug:slug,p_limit:1,p_offset:0})
 if(!error&&data?.[0])return {product:data[0] as ProductSeoPublic,canonicalSlug:null}
 if(error)return {product:null,canonicalSlug:null}
 const aliases=await supabase.rpc('resolve_product_seo_slug',{p_slug:slug})
 const canonicalSlug=typeof aliases.data==='string'&&validSlug(aliases.data)?aliases.data:null
 return {product:null,canonicalSlug}
}
export function productJsonLd(p:ProductSeoPublic,locale:'en'|'bn'){
 const bn=locale==='bn',urls=productUrls(p.slug),url=urls[locale]
 const title=bn?p.title_bn:p.title_en
 const description=bn?p.description_bn:p.description_en
 const images=[p.image_url,...(p.media??[]).filter(m=>m.kind==='gallery').map(m=>m.url)].filter(Boolean)
 const product={
  '@type':'Product','@id':urls.en+'#product',url,name:title,
  description,sku:p.sku,category:p.category,image:images,
  ...(p.brand_type!=='UNBRANDED_LOOSE'&&p.brand?{brand:{'@type':'Brand',name:p.brand}}:{})
 }
 const breadcrumbs={'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:[
  {'@type':'ListItem',position:1,name:bn?'হোম':'Home',item:SITE_URL},
  {'@type':'ListItem',position:2,name:title,item:url}]}
 // Do not emit Offer/rating/availability without verified production buyability.
 return {'@context':'https://schema.org','@graph':[product,breadcrumbs]}
}
export function safeJsonLd(data:unknown){return JSON.stringify(data).replace(/</g,'\\u003c')}
