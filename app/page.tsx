import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import {withCommerceOffers} from '@/lib/commerce/storefront'
import {getHomeSavingsSummary} from '@/lib/home-savings'
import {cookies} from 'next/headers'
import {languageFromPreference,isValidLanguagePreference,STOREFRONT_LANGUAGE_COOKIE} from '@/lib/storefront-language'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import type {Metadata} from 'next'
import {createClient} from '@/lib/supabase/server'
import {demoStorefrontEnabled} from '@/lib/public-demo-products'
import {PublicMarketplace} from '@/components/public-marketplace'
import {loadPublishedCatalogPage} from '@/lib/published-product-catalog-feed'
import type {ShowcaseProduct} from '@/lib/showcase-media'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {BUSINESS_CONTACT_EMAIL,SUPPORT_CONTACT_EMAIL,SITE_DESCRIPTION,SITE_NAME,SITE_TAGLINE_EN,SITE_URL} from '@/lib/site'

export const dynamic='force-dynamic'
export const metadata:Metadata={
 title:{absolute:`${SITE_NAME} | ${SITE_TAGLINE_EN}`},
 description:SITE_DESCRIPTION,
 alternates:{canonical:SITE_URL},
}

export default async function Page({searchParams}:{searchParams:Promise<{area?:string;q?:string}>}){
 const [{area:requestedArea,q},cookieStore]=await Promise.all([searchParams,cookies()])
 const storedLanguage=cookieStore.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 const initialLanguage=languageFromPreference(storedLanguage)
 const supabase=await createClient()
 const [claims,areasRes,offersRes,featuredRes,poolsRes,publishedProducts,vendorRes]=await Promise.all([
  supabase.auth.getClaims(),
  supabase.rpc('get_public_storefront_areas'),
  supabase.rpc('get_public_storefront_offers',{p_community_id:null}),
  supabase.rpc('get_public_own_product_showcase',{p_product_id:null,p_featured_only:true}),
  supabase.rpc('get_public_featured_pools',{p_community_id:null}),
  loadPublishedCatalogPage(),
  supabase.rpc('get_public_pilot_vendor_catalog',{p_product_id:null}),
 ])
 const authenticated=Boolean(claims.data?.claims?.sub)
 const savings=await getHomeSavingsSummary(authenticated)
 const realAreas=(areasRes.data??[]) as StorefrontArea[]
 const realOffers=await withCommerceOffers((offersRes.data??[]) as StorefrontOffer[])
 const realFeatured=(featuredRes.data??[]) as ShowcaseProduct[]
 // Existing public feeds only. Missing records stay as blurred, empty approved slots.
 const demoMode=false
 const areas=realAreas
 const offers=realOffers
 const featured=realFeatured
 const vendorProducts=(vendorRes.error?[]:vendorRes.data??[]) as PublicVendorBookingProduct[]
 const catalogAvailable=!areasRes.error&&!offersRes.error
 const schema={
  '@context':'https://schema.org',
  '@graph':[
   {'@type':'Organization','@id':`${SITE_URL}/#organization`,name:SITE_NAME,url:SITE_URL,
    logo:`${SITE_URL}/brand-logo-header.png`,email:BUSINESS_CONTACT_EMAIL,slogan:SITE_TAGLINE_EN,
    contactPoint:{'@type':'ContactPoint',contactType:'customer service',email:SUPPORT_CONTACT_EMAIL}},
   {'@type':'WebSite','@id':`${SITE_URL}/#website`,name:SITE_NAME,url:SITE_URL,
    description:SITE_DESCRIPTION,publisher:{'@id':`${SITE_URL}/#organization`}},
   {'@type':'ImageObject','@id':`${SITE_URL}/#primaryimage`,contentUrl:`${SITE_URL}/grocery-hero-glass.svg`,caption:'Everyday essentials bought with community savings'},
   {'@type':'WebPage','@id':`${SITE_URL}/#webpage`,name:`${SITE_NAME} | ${SITE_TAGLINE_EN}`,
    url:SITE_URL,description:SITE_DESCRIPTION,inLanguage:['en-BD','bn-BD']},
  ],
 }
 return <main className="public-marketplace-flat min-h-screen bg-white text-black">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  {/* English is the first-visit default. A previously selected BN/EN cookie wins on reload. */}
  <PublicMarketplace initialSearch={typeof q==='string'?q.slice(0,200):''} initialLanguage={initialLanguage} hasLanguageCookie={isValidLanguagePreference(storedLanguage)} initialArea={areas.some(a=>a.community_id===requestedArea)?requestedArea:''} areas={areas} offers={offers} authenticated={authenticated} catalogAvailable={catalogAvailable} pools={(poolsRes.data??[]) as DemoFeaturedPool[]} featured={featured} publishedProducts={publishedProducts} vendorProducts={vendorProducts} savings={savings} demoMode={demoMode} previewCards={demoStorefrontEnabled()} howLabelBn="কীভাবে কাজ করে"/>
 </main>
}
