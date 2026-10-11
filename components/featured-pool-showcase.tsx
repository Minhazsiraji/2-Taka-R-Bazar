'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import {formatPrice} from '@/lib/storefront'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import {demoPoolTierState} from '@/lib/featured-pools'

const ROTATION_MS=6500
export function FeaturedPoolShowcase({pools,language,areaName}:{pools:DemoFeaturedPool[];language:MarketplaceLanguage;areaName?:string}){
 const [activeIndex,setActiveIndex]=useState(0)
 const [paused,setPaused]=useState(false)
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 useEffect(()=>{
  if(paused||pools.length<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')setActiveIndex(previous=>(previous+1)%pools.length)
  },ROTATION_MS)
  return ()=>window.clearInterval(timer)
 },[paused,pools.length])
 const pool=pools[activeIndex%Math.max(pools.length,1)]
 const advance=(direction:number)=>setActiveIndex(previous=>(previous+direction+pools.length)%pools.length)
 if(!pool)return <div className="market-featured-pool-empty">
  <h2>{t('Featured community pools','ফিচারড কমিউনিটি পুল')}</h2>
  <p>{t('Weekly, monthly and special Pools will appear after they are approved and published.','অনুমোদিত সাপ্তাহিক, মাসিক ও বিশেষ পুল প্রকাশিত হলে এখানে দেখা যাবে।')}</p>
  <a href="#deals" className="btn-secondary">{t('Explore current offers','বর্তমান অফার দেখুন')}</a>
 </div>
 const tier=demoPoolTierState(pool)
 const progressTarget=tier.upcoming??pool.minHouseholds
 const progressPercent=Math.min(100,Math.round(100*pool.sampleHouseholds/progressTarget))
 const selected=pool.featuredProductIds
   .map(id=>pool.bundle.find(item=>item.offer.product_id===id))
   .filter((item):item is DemoFeaturedPool['bundle'][number]=>Boolean(item))
 const thumbnails=(selected.length?selected:pool.bundle).slice(0,3)
 return <div className="market-featured-pool market-auto-pool" lang={language} role="region" aria-roledescription="carousel" aria-label={t('Featured Pools: automatically rotating examples','ফিচারড পুল: স্বয়ংক্রিয় নমুনা ক্যারোসেল')}
  onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
  onFocusCapture={()=>setPaused(true)}
  onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setPaused(false)}}>
  <div className="market-featured-pool-top">
   <span className="market-featured-pool-eyebrow">{t('Featured community pools','ফিচারড কমিউনিটি পুল')} <span className="market-pool-demo-pill">DEMO / নমুনা</span></span>
   <div className="market-pool-navigation" aria-label={t('Carousel navigation','ক্যারোসেল নিয়ন্ত্রণ')}>
    <button type="button" className="market-pool-nav-arrow" onClick={()=>advance(-1)} aria-label={t('Previous Pool','আগের পুল')}>‹</button>
    <span className="market-pool-counter" aria-hidden="true">{activeIndex+1} / {pools.length}</span>
    <button type="button" className="market-pool-nav-arrow" onClick={()=>advance(1)} aria-label={t('Next Pool','পরের পুল')}>›</button>
   </div>
  </div>
  <div className="market-featured-pool-body market-pool-slide" key={pool.slug} aria-live="off">
   <div className="market-featured-pool-image market-pool-thumbnails" aria-label={t('Selected products in this Pool','এই পুলের নির্বাচিত পণ্য')}>
    {thumbnails.map(({offer})=><Link href={`/demo-product/${offer.product_id}`} className="market-pool-thumbnail" key={offer.product_id}
      aria-label={t('View product: ','পণ্য দেখুন: ')+t(offer.product_name,offer.product_name_bn??offer.product_name)}>
      <PoolThumbnail src={offer.image_url} name={t(offer.product_name,offer.product_name_bn??offer.product_name)} fallback={t('Image unavailable','ছবি নেই')}/>
    </Link>)}
   </div>
   <div className="market-featured-pool-copy">
    <span className="market-pool-slide-kind">{pool.slug==='weekly'?t('Weekly Pool','সাপ্তাহিক পুল'):pool.slug==='monthly'?t('Monthly Pool','মাসিক পুল'):t('Special Pool','বিশেষ পুল')}</span>
    <h2>{t(pool.title.en,pool.title.bn)}</h2>
    <p className="market-pool-subtitle">{t(pool.subtitle.en,pool.subtitle.bn)}</p>
    <div className="market-featured-pool-prices market-pool-current-next">
     <div><span>{t('Currently unlocked · example','বর্তমানে আনলক · নমুনা')}</span><strong>{formatPrice(tier.currentPrice)}</strong></div>
     <div><span>{tier.upcoming?t('Next potential tier','পরবর্তী সম্ভাব্য দাম'):t('Final tier reached','সর্বশেষ স্তর')} </span>
      <b>{tier.nextPrice!==null?formatPrice(tier.nextPrice):'—'}</b></div>
    </div>
    <div className="market-pool-progress">
     <div><strong>{t('Households joined (demo)','যোগ দেওয়া পরিবার (ডেমো)')}</strong><span>{pool.sampleHouseholds}/{progressTarget} · {t('Final target','চূড়ান্ত লক্ষ্য')} {pool.minHouseholds}</span></div>
     <div className="market-pool-track" role="progressbar" aria-label={t('Example household progress','নমুনা পরিবারের অগ্রগতি')} aria-valuemin={0} aria-valuemax={progressTarget} aria-valuenow={pool.sampleHouseholds}>
      <span style={{width:`${progressPercent}%`}}/></div>
     <p>{tier.upcoming?t(`${tier.householdsNeeded} more households to unlock the next illustrative price`,`আর ${tier.householdsNeeded} পরিবার এলে পরের নমুনা দাম আনলক হবে`):
      t('Example final tier reached','নমুনা শেষ স্তরে পৌঁছেছে')}</p>
    </div>
    <p className="market-pool-mini-line">{pool.bundle.length} {t('products','টি পণ্য')} · {t('Basket','মোট বাজার')}: {tier.soloPrice>tier.currentPrice?formatPrice(tier.soloPrice):t('No saving at this tier','এই স্তরে ছাড় নেই')} · {areaName??t('Choose community','এলাকা বাছুন')}</p>
    <div className="market-featured-pool-actions"><Link href={`/demo-pool/${pool.slug}`} className="btn-primary">{t('Open Pool details →','পুলের বিস্তারিত →')}</Link><span>{t('Sample only · no checkout','ডেমো · অর্ডার নয়')}</span></div>
   </div>
  </div>
 </div>
}

function PoolThumbnail({src,name,fallback}:{src:string|null;name:string;fallback:string}){
 const [failed,setFailed]=useState(false)
 return src&&!failed?<img src={src} alt={name} onError={()=>setFailed(true)}/>:<span className="market-pool-image-fallback">{fallback}</span>
}
