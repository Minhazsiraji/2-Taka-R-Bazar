'use client'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {PublishedProductsSection} from '@/components/published-products-section'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import type {PublishedCatalogPage} from '@/lib/published-product-catalog'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import {VendorProductCard} from '@/components/vendor-product-card'
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
    <div className="vendor-product-grid app-card-preview app-card-preview-exclusive" data-vendor-cards>
     {vendorProducts.map(product=><VendorProductCard key={product.product_id} product={product} language={language}/>)}
    </div>
   </section>}
   {(initial.items.length>0||vendorProducts.length===0)&&<PublishedProductsSection initial={initial} language={language}/>}

  </div>
  <PublicFooter storefront language={language}/>
 </>
}
