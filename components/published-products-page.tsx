'use client'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {PublishedProductsSection} from '@/components/published-products-section'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import type {PublishedCatalogPage} from '@/lib/published-product-catalog'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import Link from 'next/link'
import {SITE_TAGLINE_EN} from '@/lib/site'

/** One EN/BAN state for catalog, card links and header; same persisted preference as Home. */
export function PublishedProductsPage({initial,initialLanguage,hasLanguageCookie,vendorProducts=[]}:{
 initial:PublishedCatalogPage
 initialLanguage:MarketplaceLanguage
 hasLanguageCookie:boolean
 vendorProducts?:PublicVendorBookingProduct[]
}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 return <>
  <PublicHeader storefront browseHref="/" language={language} onLanguageChange={setLanguage}
   actionHref="/account" actionLabel={language==='bn'?'অ্যাকাউন্ট':'Account'}/>
  <div className="mx-auto w-full max-w-7xl px-3 py-7 sm:px-6">
   <p className="mb-4 text-sm font-semibold text-teal-700">{SITE_TAGLINE_EN}</p>
   {vendorProducts.length>0&&<section className="mb-8" aria-label={language==='bn'?'অন-ডিমান্ড পণ্য':'Vendor-fulfilled products'}>
    <h1 className="mb-2 text-2xl font-black">{language==='bn'?'আমাদের অন-ডিমান্ড পণ্য':'Our products · Available by request'}</h1>
    <p className="mb-5 text-sm text-slate-600">{language==='bn'?'পণ্য ভেন্ডরের কাছে থাকে। বুকিংয়ের পরে আমাদের টিম মূল্য, সরবরাহ ও ডেলিভারি নিশ্চিত করবে।':'These products are held by our vendor. Prices and fulfillment are confirmed by 2TBR staff for each booking; no automatic checkout or stock guarantee.'}</p>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {vendorProducts.map(p=><article key={p.product_id} className="mhome-exclusive-card overflow-hidden">
      <Link href={'/vendor-products/'+p.product_id} className="mhome-exclusive-image" aria-label={'View '+p.name}>
       {p.image_url?<img loading="lazy" src={p.image_url} alt={p.name} className="h-48 w-full object-contain"/>:<span>2TBR · Photo coming soon</span>}
      </Link>
      <div className="mhome-exclusive-copy p-4">
       <h2 className="text-lg font-black"><Link href={'/vendor-products/'+p.product_id}>{p.name}</Link></h2>
       <p className="mt-1 text-sm">{p.package_size}</p>
       <p className="mt-2 text-xl font-black">৳{Number(p.approved_unit_price).toLocaleString('en-BD')}</p>
       <p className="mt-1 text-xs">{language==='bn'?'চূড়ান্ত মূল্য ও সরবরাহ নিশ্চিতকরণ সাপেক্ষে':'Final price and supply subject to confirmation'}</p>
      </div>
      <div className="mhome-exclusive-actions p-3">
       <Link className="mhome-details-btn" href={'/vendor-products/'+p.product_id}>{language==='bn'?'বিস্তারিত':'View details'}</Link>
       <Link className="mhome-book-link" href={'/pilot-book?product='+p.product_id}>{language==='bn'?'বুকিং অনুরোধ':'Request booking'} →</Link>
      </div>
     </article>)}
    </div>
   </section>}
   {(initial.items.length>0||vendorProducts.length===0)&&<PublishedProductsSection initial={initial} language={language}/>}

  </div>
  <PublicFooter storefront language={language}/>
 </>
}
