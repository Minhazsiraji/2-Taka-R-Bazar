'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { PRODUCT_IMAGE_BUCKET, validateProductImage } from '@/lib/product-image.mjs'

const t=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const n=(fd:FormData,key:string)=>Number(t(fd,key))

function done(path:string,message:string){
  revalidatePath('/admin','layout')
  revalidatePath('/pool')
  revalidatePath('/orders')
  revalidatePath('/savings')
  redirect(`${path}?notice=${encodeURIComponent(message)}`)
}
function fail(path:string,message:string):never{redirect(`${path}?error=${encodeURIComponent(message)}`)}
function environmentError(message:string){return /bucket not found|relation .*own_product|admin_upsert_own_product.*does not exist|schema cache/i.test(message)?'Product image storage is not configured in this environment.':message}

function managedImagePath(url?:string|null){
  if(!url)return null
  const marker=`/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`
  const index=url.indexOf(marker)
  if(index<0)return null
  try{return decodeURIComponent(url.slice(index+marker.length).split('?')[0])}catch{return null}
}

async function uploadImage(supabase:any,userId:string,image:FormDataEntryValue|null,folder:string,path:string){
  if(!(image instanceof File)||image.size===0)return {url:null as string|null,objectPath:null as string|null}
  const bytes=new Uint8Array(await image.arrayBuffer())
  const validation=validateProductImage({type:image.type,size:image.size,bytes})
  if(!validation.ok)fail(path,validation.error)
  const objectPath=`${folder}/${userId}/${randomUUID()}.${validation.extension}`
  const {error}=await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(objectPath,bytes,{contentType:image.type,cacheControl:'31536000',upsert:false})
  if(error)fail(path,environmentError(error.message))
  const url=supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl
  return {url,objectPath}
}

async function removeManagedImage(supabase:any,url?:string|null){
  const objectPath=managedImagePath(url)
  if(objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([objectPath])
}

export async function createProductWithImage(fd:FormData){
  const {supabase,user}=await requireAdmin();const path='/admin/products'
  const uploaded=await uploadImage(supabase,user.id,fd.get('image_file'),'products',path)
  const payload={name:t(fd,'name'),brand:t(fd,'brand')||null,category:t(fd,'category'),package_size:t(fd,'package_size'),unit:t(fd,'unit'),sku:t(fd,'sku').toUpperCase(),image_url:uploaded.url,is_demo:fd.get('is_demo')==='on'}
  if(!payload.name||!payload.category||!payload.package_size||!payload.unit||!payload.sku){if(uploaded.objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploaded.objectPath]);fail(path,'Complete required product fields')}
  const {error}=await supabase.from('products').insert(payload)
  if(error){if(uploaded.objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploaded.objectPath]);fail(path,error.message)}
  done(path,'Product created')
}

export async function updateProductWithImage(fd:FormData){
  const {supabase,user}=await requireAdmin();const path='/admin/products';const id=t(fd,'id')
  if(!id)fail(path,'Product is required')
  const {data:current,error:currentError}=await supabase.from('products').select('image_url').eq('id',id).maybeSingle()
  if(currentError||!current)fail(path,'Product not found')
  const uploaded=await uploadImage(supabase,user.id,fd.get('image_file'),'products',path)
  const remove=fd.get('remove_image')==='on'
  const nextImage=uploaded.url??(remove?null:current.image_url)
  const payload={name:t(fd,'name'),brand:t(fd,'brand')||null,category:t(fd,'category'),package_size:t(fd,'package_size'),unit:t(fd,'unit'),sku:t(fd,'sku').toUpperCase(),image_url:nextImage,is_demo:fd.get('is_demo')==='on',active:fd.get('active')==='on'}
  if(!payload.name||!payload.category||!payload.package_size||!payload.unit||!payload.sku){if(uploaded.objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploaded.objectPath]);fail(path,'Complete required product fields')}
  const {error}=await supabase.from('products').update(payload).eq('id',id)
  if(error){if(uploaded.objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploaded.objectPath]);fail(path,error.message)}
  if((uploaded.url||remove)&&current.image_url&&current.image_url!==nextImage)await removeManagedImage(supabase,current.image_url)
  done(path,'Product updated')
}

export async function upsertOwnProductWithImage(fd:FormData){
  const {supabase,user}=await requireAdmin();const path='/admin/own-products';const id=t(fd,'product_id')||null
  let currentImage:string|null=null
  if(id){const {data,error}=await supabase.from('products').select('image_url').eq('id',id).maybeSingle();if(error||!data)fail(path,'Own product not found');currentImage=data.image_url??null}
  const uploaded=await uploadImage(supabase,user.id,fd.get('image_file'),'own-products',path)
  const remove=fd.get('remove_image')==='on'
  const imageUrl=uploaded.url??(remove?null:currentImage)
  const data={name:t(fd,'name'),brand:t(fd,'brand'),category:t(fd,'category'),package_size:t(fd,'package_size'),unit:t(fd,'unit'),sku:t(fd,'sku'),image_url:imageUrl,source_type:t(fd,'source_type')||'DIRECT_PRODUCT',manufacturer_reference:t(fd,'manufacturer_reference'),batch_number:t(fd,'batch_number'),manufacture_date:t(fd,'manufacture_date'),expiry_date:t(fd,'expiry_date'),purchase_cost:n(fd,'purchase_cost')||0,packaging_cost:n(fd,'packaging_cost')||0,inbound_transport:n(fd,'inbound_transport')||0,handling_cost:n(fd,'handling_cost')||0,other_landed_cost:n(fd,'other_landed_cost')||0,initial_stock:n(fd,'initial_stock')||0,is_demo:fd.get('is_demo')==='on',active:id?fd.get('active')==='on':true}
  const {error}=await supabase.rpc('admin_upsert_own_product',{p_product_id:id,p_data:data})
  if(error){if(uploaded.objectPath)await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploaded.objectPath]);fail(path,environmentError(error.message))}
  if((uploaded.url||remove)&&currentImage&&currentImage!==imageUrl)await removeManagedImage(supabase,currentImage)
  done(path,id?'Own product updated':'Own product created')
}
