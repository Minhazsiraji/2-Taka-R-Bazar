'use server'

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {requireAdmin} from '@/lib/auth'
import {publicShowcaseImageUrl,showcaseVideo} from '@/lib/showcase-media'

const path='/admin/own-products'
function error(message:string):never {redirect(`${path}?error=${encodeURIComponent(message)}`)}
function lines(value:string,max:number,maxEach:number){
  const entries=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
  if(entries.length>max || entries.some(x=>x.length>maxEach)) error(`Provide no more than ${max} lines (each up to ${maxEach} characters).`)
  return [...new Set(entries)]
}
export async function saveOwnProductShowcase(form:FormData){
  const {supabase}=await requireAdmin()
  const productId=String(form.get('product_id')??'').trim()
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId))error('Invalid product ID')
  const {data:product, error:productError}=await supabase.from('products')
    .select('id,source_type,is_demo,active').eq('id',productId).maybeSingle()
  if(productError||!product||!['PRIVATE_LABEL','EXCLUSIVE_PARTNER'].includes(product.source_type))error('Showcase requires an own-label or exclusive-partner product')
  const description=String(form.get('description')??'').trim()
  if(description.length>3000)error('Description exceeds 3,000 characters')
  const highlights=lines(String(form.get('highlights')??''),8,180)
  const gallery_urls=lines(String(form.get('gallery_urls')??''),6,1000)
  if(gallery_urls.some(url=>!publicShowcaseImageUrl(url)))error('Gallery images must be public 2TBR product-images or Cloudinary image URLs (HTTPS).')
  const rawVideo=String(form.get('video_url')??'').trim()
  if(rawVideo && (rawVideo.length>1000 || !showcaseVideo(rawVideo)))error('Use an HTTPS YouTube video or Cloudinary MP4 link.')
  const published=form.get('published')==='on'
  const featured=form.get('featured')==='on'
  if(featured&&!published)error('Publish the product before featuring it.')
  if(published && (product.is_demo || !product.active))error('Inactive or demo products cannot be published.')
  const sortValue=Number(form.get('sort_order')??100)
  if(!Number.isSafeInteger(sortValue)||sortValue<0||sortValue>10000)error('Sort order must be between 0 and 10,000')
  const {error:saveError}=await supabase.from('own_product_showcase').upsert({
    product_id:productId,description,highlights,gallery_urls,video_url:rawVideo||null,
    published,featured,sort_order:sortValue,updated_at:new Date().toISOString(),
  },{onConflict:'product_id'})
  if(saveError)error(saveError.message)
  revalidatePath('/')
  revalidatePath('/products/'+productId)
  redirect(`${path}?notice=${encodeURIComponent('Product showcase saved')}`)
}
