'use client'
import Link from 'next/link'
import {useState} from 'react'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import {formatPrice} from '@/lib/storefront'
import type {DemoFeaturedPool,FeaturedPoolKind} from '@/lib/featured-pools'
import {featuredPoolTotals} from '@/lib/featured-pools'

const modes:[FeaturedPoolKind,string,string][]=[
 ['weekly','Weekly','সাপ্তাহিক'],['monthly','Monthly','মাসিক'],['special','Special','বিশেষ'],
]
export function FeaturedPoolShowcase({pools,language,areaName}:{pools:DemoFeaturedPool[];language:MarketplaceLanguage;areaName?:string}){
 const [kind,setKind]=useState<FeaturedPoolKind>('weekly')
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const pool=pools.find(x=>x.slug===kind)
 if(!pool)return <div className="market-featured-pool-empty">
  <h2>{t('Featured community pools','ফিচারড কমিউনিটি পুল')}</h2>
  <p>{t('Weekly, monthly and special Pools will appear after they are approved and published.','অনুমোদিত সাপ্তাহিক, মাসিক ও বিশেষ পুল প্রকাশিত হলে এখানে দেখা যাবে।')}</p>
  <a href="#deals" className="btn-secondary">{t('Explore current offers','বর্তমান অফার দেখুন')}</a>
 </div>
 const total=featuredPoolTotals(pool)
 return <div className="market-featured-pool" lang={language}>
  <div className="market-featured-pool-top">
   <span className="market-featured-pool-eyebrow">{t('Community featured pools','কমিউনিটি ফিচারড পুল')} <span className="market-pool-demo-pill">DEMO / নমুনা</span></span>
   <div className="market-pool-tabs" role="group" aria-label={t('Featured Pool type','পুলের ধরন')}>
    {modes.map(([value,en,bn])=><button key={value} type="button" onClick={()=>setKind(value)} aria-pressed={kind===value}>{t(en,bn)}</button>)}
   </div>
  </div>
  <div className="market-featured-pool-body">
   <div className="market-featured-pool-image"><img src={pool.image} alt={t(pool.title.en,pool.title.bn)}/></div>
   <div className="market-featured-pool-copy">
    <h2>{t(pool.title.en,pool.title.bn)}</h2>
    <p className="market-pool-subtitle">{t(pool.subtitle.en,pool.subtitle.bn)}</p>
    <div className="market-featured-pool-prices">
     <div><span>{t('Sample group basket','নমুনা গ্রুপ বাজার')}</span><strong>{formatPrice(total.group)}</strong></div>
     <div><span>{t('Sample solo basket','নমুনা একক বাজার')}</span><s>{formatPrice(total.solo)}</s></div>
    </div>
    <p className="market-pool-mini-line">{pool.bundle.length} {t('products','টি পণ্য')} · {total.units} {t('units','ইউনিট')} · {areaName??t('Select your community','আপনার এলাকা বাছুন')}</p>
    <p className="market-pool-mini-line">{t('Example buyers','নমুনা ক্রেতা')}: {pool.sampleHouseholds}/{pool.minHouseholds} · {t('Not a live group','এটি বাস্তব গ্রুপ নয়')}</p>
    <div className="market-featured-pool-actions"><Link href={`/demo-pool/${pool.slug}`} className="btn-primary">{t('Open details →','বিস্তারিত খুলুন →')}</Link><span>{t('Illustration only · no checkout','শুধু নমুনা · কেনা যাবে না')}</span></div>
   </div>
  </div>
 </div>
}
