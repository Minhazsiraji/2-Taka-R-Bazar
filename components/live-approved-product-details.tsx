'use client'
import {HomePreviewProductDetails} from './home-preview-product-details'
import {approvedProductView} from '@/lib/approved-card-view'
import type {PublicLiveProduct} from '@/lib/approved-live-detail-data'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
export function LiveApprovedProductDetails({product,kind,selectedOfferId,from,poolId,areaId,initialLanguage,hasLanguageCookie}:{product:PublicLiveProduct;kind:'deal'|'exclusive'|'retail';selectedOfferId?:string;from?:string;poolId?:string;areaId?:string;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean}){
 const view=approvedProductView(product,selectedOfferId)
 const areaOffer=areaId?product.offers.find(o=>(o.community_ids??[o.community_id]).includes(areaId)&&(!selectedOfferId||o.offer_id===selectedOfferId)):undefined
 const areaIndex=areaOffer?(areaOffer.community_ids??[areaOffer.community_id]).indexOf(areaId!):-1
 const areaLabel=areaOffer?.offer_title?.split(', ')[areaIndex]||'All'
 view.community='Community: '+areaLabel
 return <HomePreviewProductDetails view={view} product={view.product} deal={kind==='deal'?view.deal:undefined} retail={kind==='retail'} from={from} poolId={poolId} initialLanguage={initialLanguage} hasLanguageCookie={hasLanguageCookie}/>
}
