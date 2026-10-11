'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import {formatPrice} from '@/lib/storefront'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import {featuredPoolTotals} from '@/lib/featured-pools'

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
 const total=featuredPoolTotals(pool)
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
   <div className="market-featured-pool-image"><img src={pool.image} alt={t(pool.title.en,pool.title.bn)}/></div>
   <div className="market-featured-pool-copy">
    <span className="market-pool-slide-kind">{pool.slug==='weekly'?t('Weekly Pool','সাপ্তাহিক পুল'):pool.slug==='monthly'?t('Monthly Pool','মাসিক পুল'):t('Special Pool','বিশেষ পুল')}</span>
    <h2>{t(pool.title.en,pool.title.bn)}</h2>
    <p className="market-pool-subtitle">{t(pool.subtitle.en,pool.subtitle.bn)}</p>
    <div className="market-featured-pool-prices">
     <div><span>{t('Sample group basket','নমুনা গ্রুপ বাজার')}</span><strong>{formatPrice(total.group)}</strong></div>
     <div><span>{t('Sample solo basket','নমুনা একক বাজার')}</span><s>{formatPrice(total.solo)}</s></div>
    </div>
    <p className="market-pool-mini-line">{pool.bundle.length} {t('products','টি পণ্য')} · {total.units} {t('units','ইউনিট')} · {areaName??t('Choose community','এলাকা বাছুন')}</p>
    <p className="market-pool-mini-line">{t('Sample households','নমুনা পরিবার')}: {pool.sampleHouseholds}/{pool.minHouseholds} · {t('Not a live group','বাস্তব গ্রুপ নয়')}</p>
    <div className="market-featured-pool-actions"><Link href={`/demo-pool/${pool.slug}`} className="btn-primary">{t('Open details →','বিস্তারিত খুলুন →')}</Link><span>{t('Illustration only · no checkout','শুধু নমুনা · অর্ডার নয়')}</span></div>
   </div>
  </div>
 </div>
}
