import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {notFound} from 'next/navigation'
import {demoStorefrontEnabled} from '@/lib/public-demo-products'
import {loadLivePublishedProduct} from '@/lib/approved-live-detail-server'
import {uuidPattern} from '@/lib/approved-live-detail-data'
import {languageFromPreference,isValidLanguagePreference,STOREFRONT_LANGUAGE_COOKIE} from '@/lib/storefront-language'
import {LiveApprovedProductDetails} from '@/components/live-approved-product-details'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Published product details — 2TBR Preview',robots:{index:false,follow:false}}
export default async function PreviewLiveProductPage({params,searchParams}:{
 params:Promise<{id:string}>;searchParams:Promise<{kind?:string;offer?:string;from?:string;pool?:string}>
}){
 if(!demoStorefrontEnabled())notFound()
 const [{id},query,jar]=await Promise.all([params,searchParams,cookies()])
 if(!uuidPattern.test(id))notFound()
 const product=await loadLivePublishedProduct(id)
 if(!product)notFound()
 const kind=query.kind==='deal'?'deal':query.kind==='retail'?'retail':'exclusive'
 const saved=jar.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 return <LiveApprovedProductDetails product={product} kind={kind}
  selectedOfferId={typeof query.offer==='string'?query.offer:undefined}
  from={typeof query.from==='string'?query.from:undefined}
  poolId={typeof query.pool==='string'&&uuidPattern.test(query.pool)?query.pool:undefined}
  initialLanguage={languageFromPreference(saved)} hasLanguageCookie={isValidLanguagePreference(saved)}/>
}
