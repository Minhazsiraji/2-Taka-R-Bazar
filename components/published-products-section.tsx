'use client'

import {useState} from 'react'
import Link from 'next/link'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import {CATALOG_PAGE_SIZE,type PublishedCatalogPage,type PublishedCatalogProduct} from '@/lib/published-product-catalog'

function PublishedPhoto({item,alt,href}:{item:PublishedCatalogProduct;alt:string;href:string}){
 const [broken,setBroken]=useState(false)
 return <Link href={href} className="market-product-image relative flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600" aria-label={"View details: "+alt}>
  {item.image_url&&!broken?
   <img src={item.image_url} alt={alt} className="h-full w-full object-contain" loading="lazy"
    onError={()=>setBroken(true)}/>:
   <p className="px-3 text-center text-sm text-slate-500" role="status">Photo unavailable / ছবি পাওয়া যায়নি</p>}
 </Link>
}

export function PublishedProductsSection({initial,language}:{initial:PublishedCatalogPage;language:MarketplaceLanguage}){
 const [items,setItems]=useState(initial.items)
 const [hasMore,setHasMore]=useState(initial.hasMore)
 const [nextOffset,setNextOffset]=useState(initial.nextOffset)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState(initial.unavailable? 'The published catalog is temporarily unavailable. Please try again later.':'')
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 async function loadMore(){
  if(loading||!hasMore)return
  setLoading(true)
  setError('')
  try{
   const response=await fetch('/api/published-products?offset='+nextOffset,{cache:'no-store'})
   if(!response.ok)throw Error('Unable to load more products')
   const data=await response.json() as PublishedCatalogPage
   if(!Array.isArray(data.items)||!Number.isSafeInteger(data.nextOffset)||data.nextOffset!==nextOffset+CATALOG_PAGE_SIZE
     ||typeof data.hasMore!=='boolean')throw Error('Invalid catalog response')
   setItems(current=>{
    const known=new Set(current.map(item=>item.product_id))
    return [...current,...data.items.filter(item=>!known.has(item.product_id))]
   })
   setHasMore(data.hasMore)
   setNextOffset(data.nextOffset)
  }catch{
   setError(t('Could not load more products. Please try again.','আরও পণ্য দেখানো যাচ্ছে না। আবার চেষ্টা করুন।'))
  }finally{setLoading(false)}
 }
 return <section id="published-products" className="market-band market-exclusives-band border-y border-black/10" aria-labelledby="published-products-heading">
  <div className="market-content py-10 sm:py-14">
   <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
     <p className="text-xs font-bold uppercase tracking-[.15em] text-teal-700">{t('Browse the published catalog','প্রকাশিত পণ্যের তালিকা')}</p>
     <h2 id="published-products-heading" className="mt-2 text-2xl font-black sm:text-3xl">{t('All Products','সব পণ্য')}</h2>
     <p className="mt-2 text-sm text-slate-600">{t('Explore approved product information. Prices and buying options are not available in this section yet.','অনুমোদিত পণ্যের তথ্য দেখুন। এই অংশে এখনো দাম বা কেনার সুবিধা চালু হয়নি।')}</p>
    </div>
   </div>
   {items.length===0?
    <div className="market-empty-real mt-5" role="status">
     <div><b>{initial.unavailable?t('Catalog temporarily unavailable','পণ্যের তালিকা সাময়িকভাবে পাওয়া যাচ্ছে না'):t('No published products yet','এখনো কোনো প্রকাশিত পণ্য নেই')}</b>
      <p>{t('Products will appear here after publication.','প্রকাশিত হলে পণ্য এখানে দেখা যাবে।')}</p></div>
    </div>:
    <div className="market-products-grid mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="published-product-grid">
     {items.map(item=>{
      const title=t(item.title_en,item.title_bn)
      const alt=t(item.alt_en,item.alt_bn)||title
      const href=(language==='bn'?'/bn':'')+'/p/'+item.slug
      return <article key={item.product_id} data-testid="published-product-card"
       className="market-product-card flex min-w-0 flex-col rounded-3xl border border-black/10 bg-white p-4">
       <PublishedPhoto item={item} alt={alt} href={href}/>
       <h3 className="market-product-title mt-3 line-clamp-2 text-lg font-black">
        <Link href={href}>{title}</Link>
       </h3>
       <p className="market-product-meta mt-1 text-xs text-slate-500">{[item.category,item.package_size].filter(Boolean).join(' · ')}</p>
       {(language==='bn'?item.short_bn:item.short_en)&&
        <p className="market-product-community mt-2 line-clamp-2 text-sm text-slate-600">{language==='bn'?item.short_bn:item.short_en}</p>}
       <div className="market-product-actions mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <span className="rounded-xl border border-teal-200/80 px-3 py-2 text-sm font-semibold text-teal-700">{t('Price pending','মূল্য শীঘ্রই')}</span>
        <Link href={href} className="btn-secondary text-sm">{t('View Details','বিস্তারিত দেখুন')} →</Link>
        <Link href={'/pilot-book?product='+item.product_id} className="btn-primary text-sm">{t('Book · Pilot','বুক করুন')}</Link>
       </div>
      </article>
     })}
    </div>}
   {hasMore&&<div className="mt-6 flex justify-center">
    <button type="button" className="btn-secondary" onClick={loadMore} disabled={loading} aria-busy={loading}>
     {loading?t('Loading products…','পণ্য লোড হচ্ছে…'):t('Show more products','আরও পণ্য দেখুন')}
    </button>
   </div>}
   {error&&<p role="alert" className="mt-3 text-center text-sm text-red-700">{error}</p>}
  </div>
 </section>
}
