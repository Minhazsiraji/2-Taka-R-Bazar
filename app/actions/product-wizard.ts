'use server'
import {randomUUID} from 'node:crypto'
import {redirect} from 'next/navigation'
import {revalidatePath} from 'next/cache'
import {z} from 'zod'
import {requireAdmin} from '@/lib/auth'
import {PRODUCT_IMAGE_BUCKET,validateProductImage} from '@/lib/product-image.mjs'
import {publicShowcaseImageUrl} from '@/lib/showcase-media'

const path='/admin/products'
const value=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const masterSchema=z.object({
 name:z.string().min(2).max(180),brand:z.string().max(180),category:z.string().min(2).max(120),
 package_size:z.string().min(1).max(60),unit:z.string().min(1).max(30),
 sku:z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,79}$/)
})
const contentSchema=z.object({
 slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
 title_en:z.string().min(3).max(180),title_bn:z.string().min(3).max(180),
 short_en:z.string().max(320),short_bn:z.string().max(320),
 description_en:z.string().max(8000),description_bn:z.string().max(8000),
 meta_title_en:z.string().max(110),meta_title_bn:z.string().max(110),
 meta_description_en:z.string().max(320),meta_description_bn:z.string().max(320),
 alt_en:z.string().max(200),alt_bn:z.string().max(200),verification_notes:z.string().max(3000),
 brand_type:z.enum(['UNBRANDED_LOOSE','SUPPLIER_BRAND','2TBR_PRIVATE_LABEL']),
 specs:z.record(z.string(),z.string().max(500))
})
function fail(s:string):never{redirect(path+'?error='+encodeURIComponent(s))}
function done(s:string):never{
 revalidatePath('/admin/products')
 revalidatePath('/p','layout')
 revalidatePath('/bn/p','layout')
 revalidatePath('/sitemap.xml')
 redirect(path+'?notice='+encodeURIComponent(s))
}
type WizardResult={ok:boolean;message:string;field?:string;step?:number}
class WizardValidationError extends Error{
 constructor(message:string,public field:string,public step:number){super(message)}
}
function invalid(message:string,field:string,step:number):never{
 throw new WizardValidationError(message,field,step)
}
function readContent(fd:FormData){
 const specs=Object.fromEntries(['variety','origin','processing','ingredients','storage','package_kind','net_quantity']
   .map(k=>[k,value(fd,'spec_'+k)]).filter(x=>x[1]))
 const raw=Object.fromEntries(['slug','title_en','title_bn','short_en','short_bn','description_en',
   'description_bn','meta_title_en','meta_title_bn','meta_description_en','meta_description_bn','alt_en',
   'alt_bn','verification_notes','brand_type'].map(k=>[k,value(fd,k)]))
 const parsed=contentSchema.safeParse({...raw,slug:value(fd,'slug').toLowerCase(),specs,expected_version:0})
 if(!parsed.success){
  const field=String(parsed.error.issues[0]?.path?.[0]??'slug')
  const issue=parsed.error.issues[0]?.message??'Enter valid SEO details.'
  const step=field==='brand_type'?0:field==='specs'?1:field==='verification_notes'?3:
   field.startsWith('alt_')?4:2
  invalid('Please check '+field.replaceAll('_',' ')+' — '+issue,field,step)
 }
 const faqs:{question_en:string;question_bn:string;answer_en:string;answer_bn:string}[]=[]
 for(let i=1;i<=8;i++){
  const fields=['q_en_'+i,'q_bn_'+i,'a_en_'+i,'a_bn_'+i]
  const q={question_en:value(fd,fields[0]),question_bn:value(fd,fields[1]),
    answer_en:value(fd,fields[2]),answer_bn:value(fd,fields[3])}
  const vals=Object.values(q)
  if(vals.some(Boolean)){
   if(Math.min(...vals.map(v=>v.length))<5||Math.max(q.question_en.length,q.question_bn.length)>300||
     Math.max(q.answer_en.length,q.answer_bn.length)>1200){
     const missing=fields.find((field,j)=>vals[j].length<5)??fields[0]
     invalid('FAQ '+i+': complete both questions and answers in English and Bangla, or clear the entire FAQ.',missing,3)
   }
   faqs.push(q)
  }
 }
 const media:{kind:'gallery'|'marketing';url:string;alt_en:string;alt_bn:string}[]=[]
 for(const kind of ['gallery','marketing'] as const){
  for(let i=1;i<=6;i++){
   const urlField=kind+'_url_'+i,altEnField=kind+'_alt_en_'+i,altBnField=kind+'_alt_bn_'+i
   const url=value(fd,urlField),alt_en=value(fd,altEnField),alt_bn=value(fd,altBnField)
   // Entirely empty optional gallery/marketing rows MUST NOT block saving.
   if(!url&&!alt_en&&!alt_bn)continue
   if(!url)invalid(kind+' image '+i+': add an approved HTTPS URL or clear both optional alt texts.',urlField,4)
   if(!publicShowcaseImageUrl(url))invalid(kind+' image '+i+': use an approved HTTPS image URL.',urlField,4)
   if(alt_en.length<3||alt_en.length>200)invalid(kind+' image '+i+': enter English alt text (3–200 characters).',altEnField,4)
   if(alt_bn.length<3||alt_bn.length>200)invalid(kind+' image '+i+': enter Bangla alt text (3–200 characters).',altBnField,4)
   media.push({kind,url,alt_en,alt_bn})
  }
 }
 return {content:{...parsed.data,expected_version:0},faqs,media}
}

/**
 * Invoked programmatically from the wizard after preventDefault().
 * Never redirect on failure: that would unmount the entire six-step form.
 */
export async function createProductWithSeo(fd:FormData):Promise<WizardResult>{
 const {supabase,user}=await requireAdmin()
 let objectPath:string|null=null
 try{
  const master=masterSchema.safeParse(Object.fromEntries(['name','brand','category','package_size','unit','sku']
    .map(k=>[k,k==='sku'?value(fd,k).toUpperCase():value(fd,k)])))
  if(!master.success){
   const field=String(master.error.issues[0]?.path?.[0]??'name')
   invalid('Please check '+field.replaceAll('_',' ')+' — '+(master.error.issues[0]?.message??'This field is required.'),field,0)
  }
  const {content,faqs,media}=readContent(fd)
  if(content.brand_type==='SUPPLIER_BRAND'&&!master.data.brand)
   invalid('Enter the actual supplier brand, or choose Unbranded / Loose.','brand',0)
  if(content.brand_type==='UNBRANDED_LOOSE'&&master.data.brand&&!['UNBRANDED','GENERIC'].includes(master.data.brand.toUpperCase()))
   invalid('Leave Brand blank for unbranded loose products.','brand',0)
  if(content.brand_type==='2TBR_PRIVATE_LABEL'&&!['2TBR','2-TAKA-R-BAZAR'].includes(master.data.brand.toUpperCase()))
   invalid('2TBR own brand requires confirmed branded packaging.','brand',0)
  let url:string|null=null
  const file=fd.get('image_file')
  if(file instanceof File&&file.size>0){
   const bytes=new Uint8Array(await file.arrayBuffer())
   const check=validateProductImage({type:file.type,size:file.size,bytes})
   if(!check.ok)invalid(check.error,'image_file',0)
   objectPath='products/'+user.id+'/'+randomUUID()+'.'+check.extension
   const uploaded=await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(objectPath,bytes,
     {contentType:file.type,cacheControl:'31536000',upsert:false})
   if(uploaded.error)invalid('Image upload failed: '+uploaded.error.message,'image_file',0)
   url=supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl
  }
  const {error}=await supabase.rpc('admin_create_product_with_seo',{
   p_master:{...master.data,brand:master.data.brand||null,image_url:url,is_demo:fd.get('is_demo')==='on'},
   p_content:content,p_faqs:faqs,p_media:media
  })
  if(error){
   if(objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([objectPath])
   return {ok:false,message:'Product not saved: '+error.message,step:5}
  }
  revalidatePath('/admin/products')
  revalidatePath('/p','layout')
  revalidatePath('/bn/p','layout')
  revalidatePath('/sitemap.xml')
  return {ok:true,message:'Product and bilingual SEO draft saved. You can open it for publication review.'}
 }catch(error){
  // There is no redirect and no form reset when validation or storage fails.
  if(objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([objectPath])
  if(error instanceof WizardValidationError)
   return {ok:false,message:error.message,field:error.field,step:error.step}
  return {ok:false,message:'Unable to save product. Your entries are still here; please retry.',step:5}
 }
}
export async function deleteUnusedProduct(fd:FormData){
 const {supabase,roles}=await requireAdmin()
 if(!roles.has('super_admin'))fail('Only Super Admin may permanently delete a product.')
 const id=value(fd,'product_id'),sku=value(fd,'sku'),reason=value(fd,'reason'),confirmSku=value(fd,'confirm_sku')
 if(!uuid.test(id)||sku!==confirmSku||reason.length<10)fail('Confirm exact SKU and provide a 10+ character deletion reason.')
 const {data,error}=await supabase.from('products').select('image_url').eq('id',id).maybeSingle()
 if(error||!data)fail('Product not found.')
 const result=await supabase.rpc('admin_delete_unused_product',{p_product_id:id,p_expected_sku:sku,p_reason:reason})
 if(result.error)fail(result.error.message)
 // Managed file cleanup only AFTER the restricted database transaction commits successfully.
 if(data.image_url){
  const marker='/storage/v1/object/public/'+PRODUCT_IMAGE_BUCKET+'/'
  const i=data.image_url.indexOf(marker)
  if(i>=0){
   let pathname:string|null=null
   try{pathname=decodeURIComponent(data.image_url.slice(i+marker.length).split('?')[0])}catch{}
   if(pathname?.startsWith('products/'))await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([pathname])
  }
 }
 done('Unused product deleted safely. Deletion event preserved.')
}
export async function archiveProduct(fd:FormData){
 const {supabase,roles}=await requireAdmin()
 if(!roles.has('super_admin'))fail('Only Super Admin may archive a product.')
 const id=value(fd,'product_id'),reason=value(fd,'reason')
 if(!uuid.test(id)||reason.length<10)fail('Product ID and reason (10+ characters) required.')
 const {error}=await supabase.rpc('admin_product_archive',{p_product_id:id,p_reason:reason})
 if(error)fail(error.message)
 done('Product archived and removed from active customer publication, historical records preserved.')
}
