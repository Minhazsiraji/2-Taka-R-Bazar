import 'server-only'
import {createClient} from '@/lib/supabase/server'
import {publicShowcaseImageUrl} from '@/lib/showcase-media'
import {CATALOG_PAGE_SIZE,toPublishedCatalogProduct,type PublishedCatalogPage} from '@/lib/published-product-catalog'

/**
 * Reuse the existing narrow public-only RPC, which enforces Published + Active
 * + non-Demo in Postgres. Never query internal product or supplier tables.
 * The extra row is a pagination sentinel, not a product shown to visitors.
 */
export async function loadPublishedCatalogPage(offset=0):Promise<PublishedCatalogPage>{
 if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)
  return {items:[],hasMore:false,nextOffset:0,unavailable:true}
 const client=await createClient()
 const {data,error}=await client.rpc('get_public_product_seo',{
  p_slug:null,p_limit:CATALOG_PAGE_SIZE+1,p_offset:offset
 })
 if(error||!Array.isArray(data))
  return {items:[],hasMore:false,nextOffset:offset,unavailable:true}
 const list=data.slice(0,CATALOG_PAGE_SIZE).map(row=>toPublishedCatalogProduct(row))
  .filter((row):row is NonNullable<typeof row>=>row!==null)
  .map(row=>({...row,image_url:row.image_url&&publicShowcaseImageUrl(row.image_url)?row.image_url:null}))
 return {items:list,hasMore:data.length>CATALOG_PAGE_SIZE,nextOffset:offset+CATALOG_PAGE_SIZE}
}
