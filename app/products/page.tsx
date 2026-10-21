import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {createClient} from '@/lib/supabase/server'
import {demoStorefrontEnabled} from '@/lib/public-demo-products'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
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
 const client=await createClient()
 const [products,vendor]=await Promise.all([loadPublishedCatalogPage(),client.rpc('get_public_pilot_vendor_catalog',{p_product_id:null})])
 const vendorProducts=(vendor.error?[]:vendor.data??[]) as PublicVendorBookingProduct[]
 return <main className="public-marketplace-flat min-h-screen">
  <PublishedProductsPage initial={products} vendorProducts={vendorProducts} approvedCards={demoStorefrontEnabled()} initialLanguage={languageFromPreference(preference)}
   hasLanguageCookie={isValidLanguagePreference(preference)}/>
 </main>
}
