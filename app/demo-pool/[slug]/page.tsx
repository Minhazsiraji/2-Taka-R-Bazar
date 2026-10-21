import '@/app/pool-detail-refinement.css'
import type {Metadata} from 'next'
import {cookies} from 'next/headers'
import {languageFromPreference,isValidLanguagePreference,STOREFRONT_LANGUAGE_COOKIE} from '@/lib/storefront-language'
import {notFound} from 'next/navigation'
import {demoStorefrontEnabled,DEMO_AREAS,DEMO_OFFERS} from '@/lib/public-demo-products'
import {getCommunityDemoFeaturedPools} from '@/lib/featured-pools'
import {DemoPoolDetail} from '@/components/demo-pool-detail'
import {HomePreviewPoolDetails} from '@/components/home-preview-pool-details'
import {previewPools} from '@/lib/home-card-preview-fixtures'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Featured Pool demo | 2-TAKA-R-BAZAR',robots:{index:false,follow:false}}
export default async function DemoPoolPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{area?:string;source?:string}>}){
 const [{slug},{area:requestedArea,source},cookieStore]=await Promise.all([params,searchParams,cookies()])
 const storedLanguage=cookieStore.get(STOREFRONT_LANGUAGE_COOKIE)?.value
 if(!demoStorefrontEnabled())notFound()
 // The approved homepage fixtures intentionally differ from the older demonstration Pool.
 // Only an explicit Preview Home navigation selects these fixtures; legacy demos remain unchanged.
 if(source==='home'){
  const fixture=previewPools.find(pool=>pool.id===slug)
  if(!fixture)notFound()
  return <HomePreviewPoolDetails pool={fixture} initialLanguage={languageFromPreference(storedLanguage)} hasLanguageCookie={isValidLanguagePreference(storedLanguage)}/>
 }
 const selectedArea=DEMO_AREAS.some(a=>a.community_id===requestedArea)?requestedArea:''
 const pool=getCommunityDemoFeaturedPools(DEMO_OFFERS,selectedArea).find(p=>p.slug===slug)
 if(!pool)notFound()
 return <DemoPoolDetail pool={pool} communityName={DEMO_AREAS.find(a=>a.community_id===selectedArea)?.community_name} initialLanguage={languageFromPreference(storedLanguage)} hasLanguageCookie={isValidLanguagePreference(storedLanguage)}/>
}
