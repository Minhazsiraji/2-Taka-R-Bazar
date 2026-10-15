/** Public projection ONLY: never send internal supplier evidence, financials or stock. */
export type PublishedCatalogProduct={
 product_id:string
 slug:string
 title_en:string
 title_bn:string
 short_en:string
 short_bn:string
 image_url:string|null
 alt_en:string
 alt_bn:string
 category:string
 package_size:string
}
export type PublishedCatalogPage={
 items:PublishedCatalogProduct[]
 hasMore:boolean
 nextOffset:number
 unavailable?:boolean
}
export const CATALOG_PAGE_SIZE=12

export function toPublishedCatalogProduct(row:Record<string,unknown>):PublishedCatalogProduct|null{
 const slug=typeof row.slug==='string'?row.slug:''
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>120)return null
 const title_en=typeof row.title_en==='string'?row.title_en.trim():''
 const title_bn=typeof row.title_bn==='string'?row.title_bn.trim():''
 if(!title_en||!title_bn||typeof row.product_id!=='string')return null
 const text=(key:string)=>typeof row[key]==='string'?String(row[key]):''
 return {
  product_id:row.product_id,slug,title_en,title_bn,
  short_en:text('short_en'),short_bn:text('short_bn'),
  image_url:typeof row.image_url==='string'?row.image_url:null,
  alt_en:text('alt_en'),alt_bn:text('alt_bn'),
  category:text('category'),package_size:text('package_size')
 }
}
