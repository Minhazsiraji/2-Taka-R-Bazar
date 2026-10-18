import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {loadPublishedCatalogPage} from '@/lib/published-product-catalog-feed'
import {STOREFRONT_LANGUAGE_COOKIE,languageFromPreference} from '@/lib/storefront-language'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {PublishedProductsSection} from '@/components/published-products-section'
import {SITE_TAGLINE_EN} from '@/lib/site'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'All Products',description:'Browse verified, published 2TBR product information. Unpriced products do not support checkout.'}

export default async function ProductsPage(){
 const cookie=await cookies()
 const language=languageFromPreference(cookie.get(STOREFRONT_LANGUAGE_COOKIE)?.value)
 const products=await loadPublishedCatalogPage()
 return <main className="public-marketplace-flat min-h-screen">
  <PublicHeader storefront browseHref="/" language={language} actionHref="/account" actionLabel="Account"/>
  <div className="mx-auto w-full max-w-7xl px-3 py-7 sm:px-6">
   <p className="mb-4 text-sm font-semibold text-teal-700">{SITE_TAGLINE_EN}</p>
   <PublishedProductsSection initial={products} language={language}/>
  </div>
  <PublicFooter storefront language={language}/>
 </main>
}
