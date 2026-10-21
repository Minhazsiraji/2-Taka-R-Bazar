'use client'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {PublishedProductsSection} from '@/components/published-products-section'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import type {PublishedCatalogPage} from '@/lib/published-product-catalog'
import {SITE_TAGLINE_EN} from '@/lib/site'

/** One EN/BAN state for catalog, card links and header; same persisted preference as Home. */
export function PublishedProductsPage({initial,initialLanguage,hasLanguageCookie}:{
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
   <PublishedProductsSection initial={initial} language={language}/>
  </div>
  <PublicFooter storefront language={language}/>
 </>
}
