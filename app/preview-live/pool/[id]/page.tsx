import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {notFound} from 'next/navigation'
import {demoStorefrontEnabled} from '@/lib/public-demo-products'
import {loadLivePublishedPool} from '@/lib/approved-live-detail-server'
import {uuidPattern} from '@/lib/approved-live-detail-data'
import {languageFromPreference,isValidLanguagePreference,STOREFRONT_LANGUAGE_COOKIE} from '@/lib/storefront-language'
import {LiveApprovedPoolDetails} from '@/components/live-approved-pool-details'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Published Pool details — 2TBR Preview',robots:{index:false,follow:false}}
export default async function PreviewLivePoolPage({params}:{params:Promise<{id:string}>}){
 if(!demoStorefrontEnabled())notFound()
 const [{id},jar]=await Promise.all([params,cookies()])
 if(!uuidPattern.test(id))notFound()
 const pool=await loadLivePublishedPool(id)
 if(!pool)notFound()
 const saved=jar.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 return <LiveApprovedPoolDetails pool={pool}
  initialLanguage={languageFromPreference(saved)} hasLanguageCookie={isValidLanguagePreference(saved)}/>
}
