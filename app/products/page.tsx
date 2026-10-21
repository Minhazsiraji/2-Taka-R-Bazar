import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {loadPublishedCatalogPage} from '@/lib/published-product-catalog-feed'
import {STOREFRONT_LANGUAGE_COOKIE,languageFromPreference,isValidLanguagePreference} from '@/lib/storefront-language'
import {PublishedProductsPage} from '@/components/published-products-page'
import {createClient} from '@/lib/supabase/server'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'

export const dynamic='force-dynamic'
export const metadata:Metadata={
 title:'All Products',
 description:'Browse verified, published 2TBR product information. Unpriced products do not support checkout.',
}
export default async function ProductsPage(){
 const cookie=await cookies()
 const preference=cookie.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 const db=await createClient()
 const [products,listed]=await Promise.all([
  loadPublishedCatalogPage(),
  db.rpc('get_public_pilot_vendor_catalog',{p_product_id:null}),
 ])
 const vendorProducts=(listed.data??[]) as PublicVendorBookingProduct[]
 return <main className="public-marketplace-flat min-h-screen">
  <PublishedProductsPage initial={products} initialLanguage={languageFromPreference(preference)}
   hasLanguageCookie={isValidLanguagePreference(preference)} vendorProducts={vendorProducts}/>
 </main>
}
