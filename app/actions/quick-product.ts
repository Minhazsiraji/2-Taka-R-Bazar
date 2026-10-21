'use server'

import {randomUUID} from 'node:crypto'
import {revalidatePath} from 'next/cache'
import {requireAdmin} from '@/lib/auth'
import {quickProductPayload} from '@/lib/quick-product-input.mjs'
import {PRODUCT_IMAGE_BUCKET,validateProductImage} from '@/lib/product-image.mjs'

export type QuickProductResult=
 |{ok:true;id:string;sku:string;message:string}
 |{ok:false;message:string;field?:string}

export async function createQuickProduct(fd:FormData):Promise<QuickProductResult>{
 // The viewer's admin/super_admin role is verified on the server and again by
 // database RLS. No new role, shared login, service key or bypass is created.
 const {supabase,user}=await requireAdmin()
 const fields=Object.fromEntries(['name','brand','category','package_size','unit','sku','source_type']
  .map(k=>[k,fd.get(k)]))
 const parsed=quickProductPayload(fields)
 if(!parsed.ok)return {ok:false,message:parsed.message,field:parsed.field}
 const candidate=fd.get('image_file')
 let bytes:Uint8Array|null=null
 let extension=''
 let mime=''
 if(candidate instanceof File&&candidate.size>0){
  // Validate actual bytes, not just a MIME claim or filename.
  if(candidate.size>5*1024*1024)
   return {ok:false,field:'image_file',message:'The product image must be 5 MB or smaller.'}
  bytes=new Uint8Array(await candidate.arrayBuffer())
  const check=validateProductImage({type:candidate.type,size:candidate.size,bytes})
  if(!check.ok)return {ok:false,field:'image_file',message:check.error}
  extension=check.extension;mime=candidate.type
 }
 let objectPath:string|null=null
 try{
  let image_url:string|null=null
  if(bytes){
   objectPath='products/'+user.id+'/'+randomUUID()+'.'+extension
   const uploaded=await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(objectPath,bytes,
    {contentType:mime,cacheControl:'31536000',upsert:false})
   if(uploaded.error){
    return {ok:false,field:'image_file',message:'Image upload could not be completed. Check product image storage and retry.'}
   }
   image_url=supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl
  }
  const {data,error}=await supabase.from('products')
   .insert({...parsed.payload,image_url})
   .select('id,sku').single()
  if(error||!data){
   if(objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([objectPath])
   if(error?.code==='23505')
    return {ok:false,field:'sku',message:'This SKU already exists, including in the archived catalog. Enter a new unique SKU; historical SKUs remain reserved.'}
   return {ok:false,message:'Product not saved. Please check the required fields and your Admin permission, then try again.'}
  }
  revalidatePath('/admin/products')
  revalidatePath('/admin/own-products')
  revalidatePath('/admin/easy-business')
  revalidatePath('/pool')
  return {ok:true,id:data.id,sku:data.sku,
   message:'Product saved and active in the catalog. Add an eligible offer price and stock before customers can order it. SEO/AEO/GEO can be completed later.'}
 }catch{
  if(objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([objectPath]).catch(()=>{})
  return {ok:false,message:'The connection was interrupted. Your entries remain in the form; please retry.'}
 }
}
