import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {loadPublishedCatalogPage} from '@/lib/published-product-catalog-feed'
import {STOREFRONT_LANGUAGE_COOKIE,languageFromPreference,isValidLanguagePreference} from '@/lib/storefront-language'
import {PublishedProductsPage} from '@/components/published-products-page'

export const dynamic='force-dynamic'
export const metadata:Metadata={
 title:'All Products',
 description:'Browse verified, published 2TBR product information. Unpriced products do not support checkout.',
}
export default async function ProductsPage(){
 const cookie=await cookies()
 const preference=cookie.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 const products=await loadPublishedCatalogPage()
 return <main className="public-marketplace-flat min-h-screen">
  <PublishedProductsPage initial={products} initialLanguage={languageFromPreference(preference)}
   hasLanguageCookie={isValidLanguagePreference(preference)}/>
 </main>
}
