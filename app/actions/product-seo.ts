'use server'

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {z} from 'zod'
import {requireAdmin} from '@/lib/auth'
import {publicShowcaseImageUrl} from '@/lib/showcase-media'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const read=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const path='/admin/products'
function fail(message:string):never{redirect(path+'?error='+encodeURIComponent(message))}
function done(message:string):never{revalidatePath('/admin/products');revalidatePath('/p');revalidatePath('/bn/p');revalidatePath('/sitemap.xml');redirect(path+'?notice='+encodeURIComponent(message))}

const schema=z.object({
 slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
 title_en:z.string().min(3).max(180),
 title_bn:z.string().min(3).max(180),
 short_en:z.string().max(320),short_bn:z.string().max(320),
 description_en:z.string().max(8000),description_bn:z.string().max(8000),
 meta_title_en:z.string().max(110),meta_title_bn:z.string().max(110),
 meta_description_en:z.string().max(320),meta_description_bn:z.string().max(320),
 alt_en:z.string().max(200),alt_bn:z.string().max(200),
 verification_notes:z.string().max(3000),
 brand_type:z.enum(['UNBRANDED_LOOSE','SUPPLIER_BRAND','2TBR_PRIVATE_LABEL']),
 specs:z.record(z.string(),z.string().max(500))
})
export async function saveProductSeo(fd:FormData){
 const {supabase}=await requireAdmin()
 const id=read(fd,'product_id');if(!uuid.test(id))fail('Invalid product')
 const specs=Object.fromEntries(['variety','origin','processing','ingredients','storage','package_kind','net_quantity'].map(k=>[k,read(fd,'spec_'+k)]).filter(([,v])=>v!==''))
 const raw=Object.fromEntries(['slug','title_en','title_bn','short_en','short_bn','description_en',
  'description_bn','meta_title_en','meta_title_bn','meta_description_en','meta_description_bn',
  'alt_en','alt_bn','verification_notes','brand_type'].map(k=>[k,read(fd,k)]))
 const result=schema.safeParse({...raw,slug:read(fd,'slug').toLowerCase(),specs})
 if(!result.success)fail('Check your bilingual product fields, slug and field lengths.')
 const faqs:{question_en:string;answer_en:string;question_bn:string;answer_bn:string}[]=[]
 for(let i=1;i<=8;i++){
  const obj={question_en:read(fd,'q_en_'+i),answer_en:read(fd,'a_en_'+i),
    question_bn:read(fd,'q_bn_'+i),answer_bn:read(fd,'a_bn_'+i)}
  if(Object.values(obj).some(Boolean)){
   if(obj.question_en.length<5||obj.question_bn.length<5||obj.answer_en.length<5||obj.answer_bn.length<5 ||
    Math.max(obj.question_en.length,obj.question_bn.length)>300||Math.max(obj.answer_en.length,obj.answer_bn.length)>1200)
     fail('Each FAQ needs a complete, short question and answer in both languages.')
   faqs.push(obj)
  }
 }
 const media:{kind:'gallery'|'marketing';url:string;alt_en:string;alt_bn:string}[]=[]
 for(const kind of ['gallery','marketing'] as const){
  for(let i=1;i<=(kind==='gallery'?6:6);i++){
   const url=read(fd,kind+'_url_'+i),alt_en=read(fd,kind+'_alt_en_'+i),alt_bn=read(fd,kind+'_alt_bn_'+i)
   if(!url&&!alt_en&&!alt_bn)continue
   if(!publicShowcaseImageUrl(url)||alt_en.length<3||alt_bn.length<3||alt_en.length>200||alt_bn.length>200)
    fail('Media images require approved HTTPS image URLs and bilingual alternative text.')
   media.push({kind,url,alt_en,alt_bn})
  }
 }
 const {error}=await supabase.rpc('admin_save_product_seo',{p_product_id:id,p_data:result.data,p_faqs:faqs,p_media:media})
 if(error)fail(error.message)
 done('SEO content saved as draft. Submit for independent review when complete.')
}
export async function submitProductSeo(fd:FormData){
 const {supabase}=await requireAdmin();const id=read(fd,'product_id')
 if(!uuid.test(id))fail('Invalid product')
 const {error}=await supabase.rpc('admin_submit_product_seo',{p_product_id:id})
 if(error)fail(error.message)
 done('Product SEO submitted for independent review.')
}
export async function reviewProductSeo(fd:FormData){
 const {supabase,roles}=await requireAdmin();if(!roles.has('super_admin'))fail('Super Admin required')
 const id=read(fd,'product_id'),note=read(fd,'note'),approve=read(fd,'decision')==='approve'
 if(!uuid.test(id)||note.length<10)fail('Product and independent review note (10+ characters) required.')
 const {error}=await supabase.rpc('admin_review_product_seo',{p_product_id:id,p_approve:approve,p_note:note})
 if(error)fail(error.message)
 done(approve?'Product SEO published.':'Product SEO returned to draft.')
}
export async function unlistProductSeo(fd:FormData){
 const {supabase}=await requireAdmin();const id=read(fd,'product_id'),reason=read(fd,'reason')
 if(!uuid.test(id)||reason.length<10)fail('Product and reason (10+ characters) required.')
 const {error}=await supabase.rpc('admin_unlist_product_seo',{p_product_id:id,p_reason:reason})
 if(error)fail(error.message)
 done('Product SEO unlisted from search.')
}
