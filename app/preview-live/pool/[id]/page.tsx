import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {notFound} from 'next/navigation'
import {loadLivePublishedPool} from '@/lib/approved-live-detail-server'
import {uuidPattern} from '@/lib/approved-live-detail-data'
import {languageFromPreference,isValidLanguagePreference,STOREFRONT_LANGUAGE_COOKIE} from '@/lib/storefront-language'
import {LiveApprovedPoolDetails} from '@/components/live-approved-pool-details'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Published Pool details — 2TBR Preview',robots:{index:false,follow:false}}
export default async function PreviewLivePoolPage({params,searchParams=Promise.resolve({})}:{params:Promise<{id:string}>;searchParams?:Promise<{area?:string}>}){
 const [{id},query,jar]=await Promise.all([params,searchParams,cookies()])
 if(!uuidPattern.test(id))notFound()
 const requestedArea=typeof query.area==='string'&&uuidPattern.test(query.area)?query.area:undefined
 const pool=await loadLivePublishedPool(id,requestedArea)
 if(!pool)notFound()
 const saved=jar.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 return <LiveApprovedPoolDetails pool={pool}
  initialLanguage={languageFromPreference(saved)} hasLanguageCookie={isValidLanguagePreference(saved)}/>
}
