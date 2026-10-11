'use client'

import {useEffect,useState} from 'react'
import {HERO_MESSAGES,HERO_ROTATION_MS} from '@/lib/hero-messages'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'

/** Hero marketing slides rotate independently of the featured product carousel. */
export function AnimatedHeroMessages({language}:{language:MarketplaceLanguage}){
 const [index,setIndex]=useState(0)
 const [paused,setPaused]=useState(false)
 const [reducedMotion,setReducedMotion]=useState(false)
 const [manual,setManual]=useState(false)
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)')
  const update=()=>setReducedMotion(media.matches)
  update()
  media.addEventListener('change',update)
  return ()=>media.removeEventListener('change',update)
 },[])
 useEffect(()=>{
  if(paused||reducedMotion)return
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')setIndex(previous=>(previous+1)%HERO_MESSAGES.length)
  },HERO_ROTATION_MS)
  return ()=>window.clearInterval(timer)
 },[paused,reducedMotion])
 const message=HERO_MESSAGES[index]
 const select=(next:number)=>{setIndex((next+HERO_MESSAGES.length)%HERO_MESSAGES.length);setManual(true)}
 return <div className="market-hero-motion" lang={language}
  onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
  onFocusCapture={()=>setPaused(true)}
  onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setPaused(false)}}
  role="region" aria-roledescription="carousel" aria-label={t('Why shop together','কেন একসাথে কেনাকাটা করবেন')}>
  <div className="market-hero-message-frame" aria-live="off">
   <div className="market-hero-message" key={message.key}>
    <h1 className="market-hero-main-title">
     <span>{t(message.first.en,message.first.bn)}</span>
     <span className="market-hero-green">{t(message.accent.en,message.accent.bn)}</span>
    </h1>
    <p className="market-hero-subtitle">{t(message.detail.en,message.detail.bn)}</p>
   </div>
  </div>
  <div className="market-hero-message-controls">
   <div className="market-hero-message-dots" role="group" aria-label={t('Choose hero message','হিরো বার্তা বেছে নিন')}>
    {HERO_MESSAGES.map((entry,i)=><button type="button" key={entry.key}
      className="market-hero-message-dot" aria-label={t(`Show message ${i+1}`,`বার্তা ${i+1} দেখুন`)}
      aria-current={i===index?'true':undefined} onClick={()=>select(i)}>
      <span aria-hidden="true"/></button>)}
   </div>
   <span className="market-hero-message-count" aria-hidden="true">{index+1} / {HERO_MESSAGES.length}</span>
   <div className="market-hero-message-arrows">
    <button type="button" onClick={()=>select(index-1)} aria-label={t('Previous message','আগের বার্তা')}>‹</button>
    <button type="button" onClick={()=>select(index+1)} aria-label={t('Next message','পরের বার্তা')}>›</button>
   </div>
  </div>
  {manual&&<span className="sr-only" role="status">{t(`Message ${index+1} of 4`,`৪টির মধ্যে ${index+1} নম্বর বার্তা`)}</span>}
 </div>
}
