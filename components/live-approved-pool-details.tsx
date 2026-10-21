'use client'

import {useState} from 'react'
import Link from 'next/link'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {confirmedOfferPrice,priceText,poolBasketTotals,safeTime,type PublicLivePool} from '@/lib/approved-live-detail-data'
import './home-preview-pool-details.css'
import './home-preview-native-details.css'

export function LiveApprovedPoolDetails({pool,initialLanguage,hasLanguageCookie}:{
 pool:PublicLivePool;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean
}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const [quantities,setQuantities]=useState<Record<string,number>>({})
 const [notice,setNotice]=useState('')
 const bn=language==='bn',t=(en:string,bnValue:string)=>bn?bnValue:en
 const n=(x:number)=>new Intl.NumberFormat(bn?'bn-BD':'en-US').format(x)
 const cash=(x:number|null)=>priceText(x,bn)
 const rows=pool.bundle.filter(row=>row.offer&&!row.offer.is_demo&&!row.offer.commerce_synthetic).slice(0,20)
 const offers=rows.map(x=>x.offer)
 const basket=poolBasketTotals(offers,quantities)
 const joined=Number.isFinite(pool.sampleHouseholds)?Math.max(0,pool.sampleHouseholds):0
 const goal=typeof pool.minHouseholds==='number'&&Number.isSafeInteger(pool.minHouseholds)&&pool.minHouseholds>0?pool.minHouseholds:null
 const dates=[...new Set(offers.map(o=>safeTime(o.closes_at)).filter(Boolean))]
 const closesAt=dates.length===1?dates[0]:null
 const title=t(pool.title.en,pool.title.bn)
 function changeQty(id:string,step:number){
  setQuantities(old=>({...old,[id]:Math.min(20,Math.max(0,(old[id]??0)+step))}))
  setNotice('')
 }
 function linePhoto(url:string|null,name:string){
  return <img src={url||'/preview-app-product-placeholder.svg'} alt={name} loading="lazy"
   onError={e=>{if(!e.currentTarget.src.endsWith('/preview-app-product-placeholder.svg'))e.currentTarget.src='/preview-app-product-placeholder.svg'}}/>
 }
 const panel=(children:React.ReactNode,cls='')=><section className={'native-preview-panel '+cls}>{children}</section>
 return <main className="public-marketplace-flat market-pool-detail-page home-preview-pool-detail native-preview-detail-page min-h-screen" lang={language}>
  <PublicHeader storefront shopBaseHref="/" browseHref="/#mobile-pools" actionHref="/#mobile-pools"
   actionLabel={t('Back to Pools','পুলে ফিরে যান')} mobileActionLabel={t('Pools','পুল')}
   language={language} onLanguageChange={setLanguage}/>
  <div className="market-pool-detail-content home-preview-pool-content native-preview-content">
   <Link href="/#mobile-pools" className="native-preview-back">‹ &nbsp;{t('Back','ফিরুন')}</Link>
   <header className="native-preview-pool-header">
    <div className="native-preview-pool-badges">
     <span className="native-preview-pill">{pool.slug==='weekly'?t('WEEKLY POOL','সাপ্তাহিক পুল'):pool.slug==='monthly'?t('MONTHLY POOL','মাসিক পুল'):t('SPECIAL POOL','বিশেষ পুল')}</span>
     <span className="native-preview-pill native-preview-active">● {t('ACTIVE','সক্রিয়')}</span>
     <span className="native-preview-pill native-preview-demo">{t('LIVE PUBLISHED DATA','প্রকাশিত তথ্য')}</span>
    </div>
    <h1>{title}</h1><p className="native-preview-muted">{n(rows.length)} {t('products','টি পণ্য')} · {n(joined)} {t('households joined','পরিবার যুক্ত')}</p>
   </header>
   {panel(<><h2>{t('Community savings progress','কমিউনিটির অগ্রগতি')}</h2>
    <div className="native-preview-split native-preview-small-row"><strong>{n(joined)} {t('households joined','পরিবার যুক্ত')}</strong>
     <span>{goal?n(goal)+' '+t('next milestone','পরবর্তী ধাপ'):t('Next milestone not published','পরবর্তী ধাপ প্রকাশিত হয়নি')}</span></div>
    {goal&&<div className="native-preview-progress home-preview-pool-progress" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(joined,goal)}><span style={{width:Math.min(100,joined/goal*100)+'%'}}/></div>}
    <p className="native-preview-muted">{t('Participation is not capped by this milestone. Prices depend on verified Pool rules.','পরবর্তী ধাপ সদস্যসীমা নয়। দাম যাচাইকৃত পুলের নিয়মের ওপর নির্ভর করে।')}</p>
    <div className="native-preview-split native-preview-pool-deadline"><strong>◷ {t('Commitment ends','যোগদান শেষ')}: {closesAt?new Date(closesAt).toLocaleDateString(bn?'bn-BD':'en-BD'):t('Not published','প্রকাশিত হয়নি')}</strong></div>
   </>,'native-preview-pool-progress home-preview-pool-summary')}
   <section className="native-preview-pool-shop">
    <div className="native-preview-split native-preview-pool-shop-heading"><div>
     <h2>{t('Choose your products','প্রয়োজনীয় পণ্য বেছে নিন')}</h2>
     <p className="native-preview-muted">{t('Pick only what you need · up to 20 units per product','যা প্রয়োজন তাই নিন · প্রতি পণ্যে সর্বোচ্চ ২০ ইউনিট')}</p>
    </div><span className="native-preview-selected">{n(basket.selected.length)} {t('selected','নির্বাচিত')}</span></div>
    <div className="home-preview-pool-products-grid native-preview-pool-products">
     {rows.map(({offer})=>{
      const q=quantities[offer.product_id]??0
      const reference=typeof offer.reference_price==='number'&&offer.reference_price>0?offer.reference_price:null
      const current=confirmedOfferPrice(offer)
      const save=reference!==null&&current!==null&&reference>current?reference-current:null
      const url='/preview-live/product/'+offer.product_id+'?kind=retail&from=pool&pool='+pool.id
      const name=t(offer.product_name,offer.product_name_bn??offer.product_name)
      return <article className={'home-preview-pool-product native-preview-pool-item native-preview-panel '+(q?'is-selected':'')} key={offer.offer_id}>
       <Link href={url} className="home-preview-pool-product-image" aria-label={t('Product Details: ','পণ্যের বিস্তারিত: ')+name}>
        {linePhoto(offer.image_url,name)}</Link>
       <div className="native-preview-pool-item-copy">
        <div className="native-preview-split native-preview-item-name"><h3>{name}</h3><small>{offer.package_size}</small></div>
        <div className="native-preview-item-price"><strong>{cash(current)}</strong>{reference!==null&&<s>{cash(reference)}</s>}</div>
        {save!==null&&<p className="native-preview-accent">{t('Potential saving','সম্ভাব্য সাশ্রয়')}: {cash(save)} / {offer.package_size}</p>}
        <p className="native-preview-muted">{t('Next tier','পরবর্তী ধাপ')}: {t('Not published','প্রকাশিত হয়নি')}</p>
        <div className="native-preview-split native-preview-item-bottom">
         <Link href={url} className="native-preview-product-link">{t('Product Details','পণ্যের বিস্তারিত')} →</Link>
         <div className="native-preview-quantity" role="group" aria-label={t('Quantity for ','পরিমাণ: ')+name}>
          <button type="button" aria-label={'Decrease '+offer.product_name} disabled={q===0} onClick={()=>changeQty(offer.product_id,-1)}>−</button>
          <output>{n(q)}</output>
          <button type="button" aria-label={'Increase '+offer.product_name} disabled={q>=20} onClick={()=>changeQty(offer.product_id,1)}>＋</button>
         </div>
        </div>
       </div>
      </article>
     })}
    </div>
   </section>
   {panel(<><h2>{t('How Pool prices unlock','পুলের দাম কীভাবে কমে')}</h2>
    <div className="native-preview-tier-grid">
     {[{title:t('Starting total','শুরুর মোট মূল্য'),value:basket.opening},
       {title:t('Current Pool total','বর্তমান পুল মূল্য'),value:basket.current},
       {title:t('Next-tier total','পরবর্তী স্তরের মূল্য'),value:basket.next}].map((x,i)=>
       <div key={i} className={'native-preview-tier '+(i===1?'is-current':'')}><small>{x.title}</small><strong>{basket.units?cash(x.value):'—'}</strong></div>)}
    </div><p className="native-preview-hint">{t('Starting and next-tier amounts remain unpublished until authoritative Pool prices are available.','যাচাইকৃত পুলের দাম প্রকাশ না হওয়া পর্যন্ত শুরুর ও পরবর্তী ধাপের দাম দেখানো হবে না।')}</p>
   </>,'native-preview-pool-tiers')}
   {panel(<><div className="native-preview-split"><h2>{t('Your Pool basket','আপনার পুলের বাজার')}</h2><small>{n(basket.selected.length)} {t('products','পণ্য')} · {n(basket.units)} {t('units','ইউনিট')}</small></div>
    {[[t('Market retail total','খুচরা বাজারমূল্য'),basket.retail],[t('Current estimated Pool total','বর্তমান পুলের আনুমানিক মূল্য'),basket.current],
      [t('Potential savings','সম্ভাব্য সাশ্রয়'),basket.saving],[t('Total at next tier','পরবর্তী স্তরে মোট মূল্য'),basket.next]].map(([name,value],i)=>
      <div key={String(name)} className="native-preview-split native-preview-basket-row"><span>{name}</span><strong className={i===1?'native-preview-total':''}>{basket.units?cash(value as number|null):cash(0)}</strong></div>)}
    <p className="native-preview-hint">{t('Delivery excluded. Unconfirmed or missing price fields are not estimated.','ডেলিভারি চার্জ বাদে। অপ্রকাশিত দাম অনুমান করে দেখানো হয় না।')}</p>
   </>,'native-preview-pool-basket')}
   {panel(<><h2>{t('Before you join','যোগদানের আগে জানুন')}</h2>
    <p>{t('Confirm final price, stock, deadline and delivery terms before making any commitment.','যোগদানের আগে চূড়ান্ত দাম, স্টক, সময়সীমা ও ডেলিভারি যাচাই করুন।')}</p>
    <p>{t('No Pool commitment, order or payment is created in this Preview.','এই প্রিভিউতে কোনো পুলে যোগদান, অর্ডার বা পেমেন্ট হয় না।')}</p>
   </>,'native-preview-pool-before')}
   <div className="native-preview-pool-review" role="region" aria-label={t('Pool selection review','পুল নির্বাচন পর্যালোচনা')}>
    <div><small>{n(basket.units)} {t('units selected','টি ইউনিট নির্বাচিত')}</small><strong>{cash(basket.current)}</strong></div>
    <button type="button" disabled={!basket.units||basket.current===null} onClick={()=>setNotice(t('Selection reviewed in Preview only. No actual commitment created.','শুধু প্রিভিউতে নির্বাচন দেখানো হয়েছে। বাস্তব যোগদান হয়নি।'))}>
     {t('Review Join Pool · Preview','পুলে যোগদান দেখুন · প্রিভিউ')} →</button>
   </div>
   {notice&&<p className="native-preview-status" role="status">{notice}</p>}
  </div><PublicFooter storefront language={language}/>
 </main>
}
