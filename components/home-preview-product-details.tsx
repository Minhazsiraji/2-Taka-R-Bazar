'use client'

import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {previewProducts,previewDeals,previewPhoto,previewMoney as money} from '@/lib/home-card-preview-fixtures'
import './home-card-preview.css'

type Props={product:typeof previewProducts[number];deal?:typeof previewDeals[number];initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean}
// Reached only through the existing server-gated /demo-product/[id] page.
export function HomePreviewProductDetails({product,deal,initialLanguage,hasLanguageCookie}:Props){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const [failed,setFailed]=useState(false)
 const imageRef=useRef<HTMLImageElement>(null)
 // SSR images can fail before hydration attaches onError; check the completed image as well.
 useEffect(()=>{const image=imageRef.current;if(image?.complete&&image.naturalWidth===0)setFailed(true)},[])
 const [basket,setBasket]=useState(0)
 const bn=language==='bn'
 const name=bn?product.nameBn:product.name
 const price=deal?.price??product.price
 const back=deal?'/#mobile-deals':'/#mobile-exclusive'
 return <main className="public-marketplace-flat market-pool-detail-page home-preview-product-detail min-h-screen">
  <PublicHeader storefront shopBaseHref="/" browseHref={back} actionHref={back} actionLabel={bn?'বাজারে ফিরুন':'Back to shopping'} mobileActionLabel={bn?'বাজার':'Shop'} language={language} onLanguageChange={setLanguage}/>
  <div className="market-pool-detail-content">
   <p className="market-demo-detail-banner">{bn?'ডেমো পণ্য — দেখানো দাম ও মজুত নমুনা। বাস্তব অর্ডার নয়।':'DEMO PRODUCT — illustrative prices and stock. No real ordering.'}</p>
   <div className="market-demo-detail-grid market-ui-product-detail">
    <div className="market-demo-detail-image market-ui-card"><img ref={imageRef} width="600" height="600" src={failed?'/preview-app-product-placeholder.svg':previewPhoto(product.photo)} alt={name} onError={()=>{if(!failed)setFailed(true)}}/></div>
    <section className="market-demo-detail-copy market-ui-card">
     <p className="market-story-eyebrow">{deal?'GROUP DEAL':bn?'এক্সক্লুসিভ পণ্য':'Exclusive product'}</p>
     <h1>{name}</h1>
     <p>{product.unit}{deal?' · Savar DOHS':''}</p>
     <div className="home-preview-product-price"><strong>{money(price)}</strong><s>{money(product.oldPrice)}</s></div>
     <span className="home-preview-product-save">{bn?'সাশ্রয়':'Save'} {money(product.oldPrice-price)}</span>
     {deal?<><p>{deal.joined}/{deal.target} joined · Ends in {deal.days} {deal.days===1?'day':'days'}</p>
      <div className="home-preview-product-progress" role="progressbar" aria-label={bn?'গ্রুপ অংশগ্রহণ':'Group participation'} aria-valuemin={0} aria-valuemax={deal.target} aria-valuenow={deal.joined}><span style={{width:Math.min(100,deal.joined/deal.target*100)+'%'}}/></div></>:
      <p>{bn?'স্টকে আছে '+product.stock:'In stock · '+product.stock+' available'}</p>}
     <p>{bn?'নমুনা পণ্যের বিবরণ · '+product.unit+'। এই প্রিভিউতে কোনো বাস্তব অর্ডার বা যোগদানের অনুরোধ তৈরি হয় না।':'Sample product details · '+product.unit+'. This preview does not create a real order or participation request.'}</p>
     <div className="home-preview-product-actions">
      {!deal&&<button type="button" className="btn-primary" onClick={()=>setBasket(n=>n+1)}>{bn?'ডেমো কার্টে যোগ করুন':'Add to preview basket'}</button>}
      <Link href={back} className="btn-secondary">{bn?'← বাজারে ফিরুন':'← Back to shopping'}</Link>
     </div>
     {basket>0&&<p role="status">{bn?'ডেমো ঝুড়িতে '+basket+'টি যোগ হয়েছে। বাস্তব কার্ট পরিবর্তন হয়নি।':'Added '+basket+' to the preview basket. Your real cart is unchanged.'}</p>}
    </section>
   </div>
  </div>
  <PublicFooter language={language}/>
 </main>
}
