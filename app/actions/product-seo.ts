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
type SeoSaveResult={ok:boolean;saved:boolean;submitted:boolean;message:string;field?:string;blockers?:string[];version?:number}
type ReviewMaster={active:boolean;is_demo:boolean;image_url:string|null}
type ReviewContent={
 description_en:string;description_bn:string;meta_title_en:string;meta_title_bn:string;
 meta_description_en:string;meta_description_bn:string;alt_en:string;alt_bn:string;verification_notes:string
}
/** Informative UI preflight only. The existing database RPC remains the final authority. */
function reviewBlockers(content:ReviewContent,master:ReviewMaster|null):string[]{
 const checks:[keyof ReviewContent,string,number][]=[
  ['description_en','Full description - English',40],
  ['description_bn','Full description - Bangla',20],
  ['meta_title_en','SEO page title - English',10],
  ['meta_title_bn','SEO page title - Bangla',10],
  ['meta_description_en','Search description - English',30],
  ['meta_description_bn','Search description - Bangla',20],
  ['alt_en','Master photo alt text - English',5],
  ['alt_bn','Master photo alt text - Bangla',5],
  ['verification_notes','Internal supplier facts / claim evidence',10]
 ]
 const blockers=checks.filter(([key,,min])=>content[key].trim().length<min)
  .map(([,label,min])=>label+' must contain at least '+min+' characters.')
 if(!master)blockers.push('Unable to confirm product master. Reload the product before requesting review.')
 else{
  if(!master.active)blockers.push('Product is Inactive. Activate the product first.')
  if(master.is_demo)blockers.push('Demo/test product cannot be published.')
  if(!master.image_url?.trim())blockers.push('Upload a genuine master product image before requesting review.')
 }
 return blockers
}

/** Save the contents actually typed in this form; optionally submit the saved version.
 * Never redirect on validation/DB failure: the browser must retain every unsaved input.
 */
export async function saveProductSeo(fd:FormData):Promise<SeoSaveResult>{
 const {supabase}=await requireAdmin()
 const id=read(fd,'product_id'),intent=read(fd,'editor_intent')==='submit'?'submit':'save'
 const rejected=(message:string,field?:string):SeoSaveResult=>({ok:false,saved:false,submitted:false,message,field})
 if(!uuid.test(id))return rejected('Invalid product ID. Nothing was changed.','product_id')
 const specs=Object.fromEntries(['variety','origin','processing','ingredients','storage','package_kind','net_quantity']
  .map(k=>[k,read(fd,'spec_'+k)]).filter(([,v])=>v!==''))
 const raw=Object.fromEntries(['slug','title_en','title_bn','short_en','short_bn','description_en',
  'description_bn','meta_title_en','meta_title_bn','meta_description_en','meta_description_bn',
  'alt_en','alt_bn','verification_notes','brand_type'].map(k=>[k,read(fd,k)]))
 const parsed=schema.safeParse({...raw,slug:read(fd,'slug').toLowerCase(),specs})
 if(!parsed.success){
  const issue=parsed.error.issues[0]
  const field=String(issue?.path?.[0]??'slug')
  return rejected('Check '+field.replaceAll('_',' ')+': '+(issue?.message??'Invalid field.'),field)
 }
 const faqs:{question_en:string;answer_en:string;question_bn:string;answer_bn:string}[]=[]
 for(let i=1;i<=8;i++){
  const obj={question_en:read(fd,'q_en_'+i),answer_en:read(fd,'a_en_'+i),
   question_bn:read(fd,'q_bn_'+i),answer_bn:read(fd,'a_bn_'+i)}
  if(Object.values(obj).some(Boolean)){
   if(obj.question_en.length<5||obj.question_bn.length<5||obj.answer_en.length<5||obj.answer_bn.length<5||
     Math.max(obj.question_en.length,obj.question_bn.length)>300||
     Math.max(obj.answer_en.length,obj.answer_bn.length)>1200)
    return rejected('FAQ '+i+' needs a complete question and answer in both languages.','q_en_'+i)
   faqs.push(obj)
  }
 }
 const media:{kind:'gallery'|'marketing';url:string;alt_en:string;alt_bn:string}[]=[]
 for(const kind of ['gallery','marketing'] as const){
  for(let i=1;i<=6;i++){
   const url=read(fd,kind+'_url_'+i),alt_en=read(fd,kind+'_alt_en_'+i),alt_bn=read(fd,kind+'_alt_bn_'+i)
   if(!url&&!alt_en&&!alt_bn)continue
   if(!url||!publicShowcaseImageUrl(url))
    return rejected(kind+' image '+i+': an approved HTTPS image URL is required when editing an existing image. Clear the entire empty row to skip.',kind+'_url_'+i)
   if(alt_en.length<3||alt_bn.length<3||alt_en.length>200||alt_bn.length>200)
    return rejected(kind+' image '+i+': provide both English and Bangla alt text (3–200 characters).',kind+'_alt_en_'+i)
   media.push({kind,url,alt_en,alt_bn})
  }
 }
 const {error:saveError}=await supabase.rpc('admin_save_product_seo',{
  p_product_id:id,p_data:{...parsed.data,expected_version:Number(read(fd,'expected_version'))},
  p_faqs:faqs,p_media:media
 })
 if(saveError)return rejected('Product changes were not saved: '+saveError.message)
 revalidatePath('/admin/products')
 const {data:latest}=await supabase.from('product_seo_content').select('version').eq('product_id',id).maybeSingle()
 const version=typeof latest?.version==='number'?latest.version:undefined
 if(intent==='save')
  return {ok:true,saved:true,submitted:false,version,message:'SEO draft saved to the database. You can now submit it for independent review.'}
 const {data:master,error:masterError}=await supabase.from('products')
  .select('active,is_demo,image_url').eq('id',id).maybeSingle()
 const blockers=reviewBlockers(parsed.data,masterError?null:master as ReviewMaster|null)
 if(blockers.length)
  return {ok:false,saved:true,submitted:false,version,field:blockers.some(x=>x.startsWith('Internal supplier'))?'verification_notes':undefined,
   message:'Your changes were SAVED as a draft. Review submission still needs the following:',blockers}
 const {error:reviewError}=await supabase.rpc('admin_submit_product_seo',{p_product_id:id})
 if(reviewError)
  return {ok:false,saved:true,submitted:false,version,
   message:'Your changes were SAVED as a draft, but publication/review submission failed: '+reviewError.message}
 const {data:submittedRow,error:statusError}=await supabase.from('product_seo_content')
  .select('status').eq('product_id',id).maybeSingle()
 if(statusError||!submittedRow||!['review','published'].includes(submittedRow.status))
  return {ok:false,saved:true,submitted:false,version,
   message:'Submission was accepted, but the resulting publication status could not be confirmed. Reload the product before acting again.'}
 revalidatePath('/p','layout')
 revalidatePath('/bn/p','layout')
 revalidatePath('/sitemap.xml')
 return {ok:true,saved:true,submitted:true,version,
  message:submittedRow.status==='published'?
   'Owner publication complete. The verified product information page is now public.':
   'Product details saved and submitted for independent review. A different Super Admin must approve publication.'}
}

export async function submitProductSeo(fd:FormData){
 const {supabase}=await requireAdmin();const id=read(fd,'product_id')
 if(!uuid.test(id))fail('Invalid product')
 const {error}=await supabase.rpc('admin_submit_product_seo',{p_product_id:id})
 if(error)fail(error.message)
 const {data:row}=await supabase.from('product_seo_content').select('status').eq('product_id',id).maybeSingle()
 done(row?.status==='published'?'Owner product SEO published.':'Product SEO submitted for independent review.')
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
