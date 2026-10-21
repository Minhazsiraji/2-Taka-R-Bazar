import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {languageFromPreference,isValidLanguagePreference,STOREFRONT_LANGUAGE_COOKIE} from '@/lib/storefront-language'
import {notFound} from 'next/navigation'
import {DEMO_OFFERS,demoStorefrontEnabled} from '@/lib/public-demo-products'
import {DemoProductDetails} from '@/components/demo-product-details'
import {HomePreviewProductDetails} from '@/components/home-preview-product-details'
import {previewProducts,previewDeals} from '@/lib/home-card-preview-fixtures'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Demo product · 2-TAKA-R-BAZAR',robots:{index:false,follow:false}}
export default async function DemoProductPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{kind?:string|string[]}>}){
 const [{id},cookieStore]=await Promise.all([params,cookies()])
 const storedLanguage=cookieStore.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 if(!demoStorefrontEnabled())notFound()
 const fixture=previewProducts.find(p=>p.id===id)
 if(fixture){
  const query=await searchParams
  const deal=query.kind==='deal'?previewDeals.find(p=>p.id===id):undefined
  return <HomePreviewProductDetails key={fixture.id+(deal?'-deal':'')} product={fixture} deal={deal} initialLanguage={languageFromPreference(storedLanguage)} hasLanguageCookie={isValidLanguagePreference(storedLanguage)}/>
 }
 const offer=DEMO_OFFERS.find(p=>p.product_id===id)
 if(!offer)notFound()
 return <DemoProductDetails offer={offer} initialLanguage={languageFromPreference(storedLanguage)} hasLanguageCookie={isValidLanguagePreference(storedLanguage)}/>
}
