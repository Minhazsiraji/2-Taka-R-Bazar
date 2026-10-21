'use client'
import {HomePreviewPoolDetails} from './home-preview-pool-details'
import {approvedPoolView} from '@/lib/approved-card-view'
import type {PublicLivePool} from '@/lib/approved-live-detail-data'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
export function LiveApprovedPoolDetails({pool,initialLanguage,hasLanguageCookie}:{pool:PublicLivePool;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean}){
 const view=approvedPoolView(pool)
 return <HomePreviewPoolDetails pool={view.pool} view={view} initialLanguage={initialLanguage} hasLanguageCookie={hasLanguageCookie}/>
}
