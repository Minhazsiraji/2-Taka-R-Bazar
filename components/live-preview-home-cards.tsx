'use client'
import {PreviewHomeCards} from './home-card-preview'
import {approvedHomeView} from '@/lib/approved-card-view'
import type {LiveHomepageData} from '@/lib/approved-live-detail-data'
import type {MarketplaceLanguage} from '@/lib/storefront-language'

// Bind data to the exact owner-locked card template; no alternate card renderer.
export function LivePreviewHomeCards({section,language,search,selectedArea,data}:{section:'deals'|'exclusive'|'pools';language:MarketplaceLanguage;search:string;selectedArea:string;data:LiveHomepageData}){
 return <PreviewHomeCards section={section} language={language} search={search} view={approvedHomeView(data,selectedArea,search)}/>
}
