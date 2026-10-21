'use client'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import {LivePreviewHomeCards} from './live-preview-home-cards'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {PublishedProductsSection} from '@/components/published-products-section'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import type {PublishedCatalogPage} from '@/lib/published-product-catalog'
import {SITE_TAGLINE_EN} from '@/lib/site'

/** One EN/BAN state for catalog, card links and header; same persisted preference as Home. */
export function PublishedProductsPage({initial,initialLanguage,hasLanguageCookie,vendorProducts=[],approvedCards=false}:{
 vendorProducts?:PublicVendorBookingProduct[]
 approvedCards?:boolean
 initial:PublishedCatalogPage
 initialLanguage:MarketplaceLanguage
 hasLanguageCookie:boolean
}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 return <>
  <PublicHeader storefront browseHref="/" language={language} onLanguageChange={setLanguage}
   actionHref="/account" actionLabel={language==='bn'?'অ্যাকাউন্ট':'Account'}/>
  <div className="mx-auto w-full max-w-7xl px-3 py-7 sm:px-6">
   <p className="mb-4 text-sm font-semibold text-teal-700">{SITE_TAGLINE_EN}</p>
   <div className={approvedCards?'mhome':undefined}>{approvedCards&&<h2 id="published-products-heading" className="mt-2 text-2xl font-black sm:text-3xl">{language==='bn'?'সব পণ্য':'All Products'}</h2>}{approvedCards?<LivePreviewHomeCards section="exclusive" language={language} search="" selectedArea="" data={{offers:[],products:[],pools:[],catalog:initial.items,vendorProducts}}/>:<PublishedProductsSection initial={initial} language={language}/>}</div>
  </div>
  <PublicFooter storefront language={language}/>
 </>
}
