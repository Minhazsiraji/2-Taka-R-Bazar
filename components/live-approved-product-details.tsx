'use client'
import {HomePreviewProductDetails} from './home-preview-product-details'
import {approvedProductView} from '@/lib/approved-card-view'
import type {PublicLiveProduct} from '@/lib/approved-live-detail-data'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
export function LiveApprovedProductDetails({product,kind,selectedOfferId,from,poolId,initialLanguage,hasLanguageCookie}:{product:PublicLiveProduct;kind:'deal'|'exclusive'|'retail';selectedOfferId?:string;from?:string;poolId?:string;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean}){
 const view=approvedProductView(product,selectedOfferId)
 return <HomePreviewProductDetails view={view} product={view.product} deal={kind==='deal'?view.deal:undefined} retail={kind==='retail'} from={from} poolId={poolId} initialLanguage={initialLanguage} hasLanguageCookie={hasLanguageCookie}/>
}
