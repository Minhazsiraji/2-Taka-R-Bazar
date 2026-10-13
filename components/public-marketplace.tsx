'use client'

import {useMemo,useState,useRef,useCallback,useEffect} from 'react'
import Link from 'next/link'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {chooseAreaByLocation,distanceMeters,formatPrice} from '@/lib/storefront'
import {PublicMarketplaceLower} from '@/components/public-marketplace-lower'
import {CommunityPicker} from '@/components/community-picker'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import {FeaturedProductsCarousel} from '@/components/featured-products-carousel'
import {FeaturedPoolShowcase} from '@/components/featured-pool-showcase'
import {AnimatedHeroMessages} from '@/components/animated-hero-messages'
import {getDemoFeaturedPools,type DemoFeaturedPool} from '@/lib/featured-pools'
import type {ShowcaseProduct} from '@/lib/showcase-media'

export function PublicMarketplace({areas,offers,authenticated=false,howLabelBn,catalogAvailable=true,featured=[],demoMode=false,pools=[]}:{areas:StorefrontArea[];offers:StorefrontOffer[];authenticated?:boolean;howLabelBn?:string;catalogAvailable?:boolean;featured?:ShowcaseProduct[];demoMode?:boolean;pools?:DemoFeaturedPool[]}){
 const [language,setLanguage]=useState<MarketplaceLanguage>('bn')
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const [area,setArea]=useState('')
 const [search,setSearch]=useState('')
 const [gpsBusy,setGpsBusy]=useState(false)
 const [gpsMessage,setGpsMessage]=useState('')
 const [locationState,setLocationState]=useState<'pending'|'matched'|'nearby'|'denied'|'unavailable'|'failed'|'manual'>('pending')
 const [nearestAreas,setNearestAreas]=useState<Array<{id:string;meters:number}>>([])
 const manualSelected=useRef(false)
 const initialLocationRequested=useRef(false)
 const [mode,setMode]=useState<'all'|'group'|'pool'>('all')
 const [category,setCategory]=useState('all')
 const activeArea=areas.find(a=>a.community_id===area)
 const categories=useMemo(()=>[...new Set(offers.filter(o=>!area||o.community_id===area).map(o=>o.category).filter(Boolean))].sort(),[offers,area])
 const filtered=useMemo(()=>offers.filter(offer=>
  (!area||offer.community_id===area)&&
  (mode==='all'||(mode==='group'?offer.offer_kind==='GROUP_DEAL':offer.offer_kind==='COMMUNITY_POOL'))&&
  (category==='all'||offer.category===category)&&
  [offer.product_name,offer.product_name_bn,offer.category,offer.category_bn,offer.brand,offer.offer_title].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
 ),[offers,area,search,mode,category])
 const heroPools=demoMode?getDemoFeaturedPools(offers):pools.filter(p=>!area||p.community_id===area)
 const groupHref=authenticated?'/group-deals':'/login?next=%2Fgroup-deals'
 const poolHref=authenticated?'/pool':'/login?next=%2Fpool'
 const useLocation=useCallback(()=>{
  if(!('geolocation' in navigator)){
   setLocationState('unavailable')
   setGpsMessage('Location is unavailable in this browser. Please choose your community manually.')
   return
  }
  setGpsBusy(true)
  setGpsMessage('Your browser may ask for location access. Allow to discover nearby community offers.')
  navigator.geolocation.getCurrentPosition(position=>{
   const {latitude,longitude,accuracy}=position.coords
   const nearest=areas
    .filter(a=>a.center_latitude!=null&&a.center_longitude!=null&&a.match_radius_m!=null)
    .map(a=>({id:a.community_id,meters:Math.round(distanceMeters(latitude,longitude,Number(a.center_latitude),Number(a.center_longitude)))}))
    .sort((a,b)=>a.meters-b.meters)
    .filter(a=>a.meters<=15000).slice(0,4)
   const match=chooseAreaByLocation(areas,latitude,longitude,accuracy)
   setNearestAreas(nearest)
   setGpsBusy(false)
   // A delayed GPS response must not re-label a manually selected browsing area.
   if(manualSelected.current)return
   if(match){
    if(!manualSelected.current){setArea(match.community_id);setCategory('all')}
    setLocationState('matched')
    setGpsMessage('Nearby match: '+match.community_name+'. Location does not automatically enroll you; verify your address to join a Group Deal.')
   }else{
    setLocationState('nearby')
    setGpsMessage(accuracy>1500
      ? 'Your location is not accurate enough to confirm a nearby community. Please choose an area manually.'
      : nearest.length?'Nearby communities are suggested below. Select one to view offers; joining still requires verification.':'No configured operating area matches your current location. You can still browse or select an area manually.')
   }
  },e=>{
   setGpsBusy(false)
   if(manualSelected.current)return
   setLocationState(e.code===1?'denied':'failed')
   setGpsMessage(e.code===1?'Location permission was denied. Browse freely, select your community manually, or change browser permission to retry.':'We could not determine your location. Please select a community manually.')
  },{enableHighAccuracy:false,timeout:12000,maximumAge:60000})
 },[areas])
 useEffect(()=>{
  // A single initial attempt: never watch, save or transmit browser GPS coordinates.
  // React Strict Mode may repeat effects, so guard the permission prompt.
  if(initialLocationRequested.current)return
  initialLocationRequested.current=true
  useLocation()
 },[useLocation])
 function selectArea(value:string){
  manualSelected.current=true
  setArea(value)
  setCategory('all')
  setLocationState('manual')
  setGpsMessage(value?'Showing your chosen community. A verified address is required before joining a local Group Deal.':'Showing all operating areas.')
 }
 const activeLocationLabel=activeArea?.community_name??(locationState==='denied'?t('Choose area','এলাকা বাছুন'):t('Find my community','আমার এলাকা খুঁজুন'))
 const locationStatus=gpsBusy?t('Requesting location…','লোকেশন চাওয়া হচ্ছে…'):
 locationState==='matched'?t('Nearby community selected; joining requires verification.','কাছের কমিউনিটি নির্বাচিত হয়েছে; যোগ দিতে যাচাই প্রয়োজন।'):
 locationState==='denied'?t('Location denied. Select your area manually.','লোকেশন অনুমতি নেই। নিজে এলাকা বেছে নিন।'):
 locationState==='nearby'?t('No reliable match; select a community manually.','নির্ভরযোগ্য এলাকা মেলেনি; নিজে বেছে নিন।'):
 locationState==='manual'?(area?t('Manually selected for browsing; joining requires verification.','নিজে এলাকা বেছে নিয়েছেন; যোগ দিতে যাচাই প্রয়োজন।'):t('Showing all areas; no community selected.','সব এলাকার পণ্য দেখছেন; কমিউনিটি বাছা হয়নি।')):
 locationState==='unavailable'?t('Location unavailable; choose your community manually.','লোকেশন পাওয়া যাচ্ছে না; নিজে এলাকা বেছে নিন।'):
 locationState==='failed'?t('Location detection failed; retry or choose an area.','অবস্থান খোঁজা যায়নি; আবার চেষ্টা করুন বা এলাকা বাছুন।'):
 t('You can browse without location.','লোকেশন ছাড়াও পণ্য দেখতে পারবেন।')

 return <>
  <PublicHeader storefront actionHref={authenticated?'/home':'/login'} actionLabel={authenticated?t('My dashboard','আমার ড্যাশবোর্ড'):t('Sign in','লগইন')}
   searchValue={search} onSearchChange={setSearch} onLocationClick={useLocation} locating={gpsBusy} locationLabel={activeLocationLabel}
   language={language} onLanguageChange={setLanguage}/>
  <section className="market-band market-hero-band"><div className="market-content market-hero-content">
   <div className="market-location-panel">
    <div className="market-location-intro"><strong>📍 {t('Find savings near your community','আপনার এলাকায় কম দামের অফার খুঁজুন')}</strong>
     <p>{t('Allow location to suggest nearby communities and group prices. Joining requires verified eligibility.','কাছের কমিউনিটি ও গ্রুপের দাম দেখতে লোকেশন অনুমতি দিন। যোগ দিতে এলাকা যাচাই প্রয়োজন।')}</p></div>
    <div className="market-location-control">
     <CommunityPicker areas={areas} value={area} onChange={selectArea} language={language} statusId="market-location-status"/>
     <div className="market-location-feedback">
     <button type="button" className="market-location-retry" onClick={useLocation} disabled={gpsBusy}>{gpsBusy?t('Finding area…','এলাকা খোঁজা হচ্ছে…'):t('Detect my location','আমার অবস্থান খুঁজুন')}</button>
     <p id="market-location-status" role="status" aria-live="polite" title={gpsMessage} className="market-location-status">{locationStatus}</p>
     </div></div></div>
   {nearestAreas.length>0&&<div className="market-nearby-suggestions" aria-label={t('Nearby communities','কাছের কমিউনিটি')}>
    <span className="market-nearby-heading">{t('Near you','কাছাকাছি')} <small>({t('approximate','আনুমানিক')})</small></span>
    {nearestAreas.map(a=>{const community=areas.find(c=>c.community_id===a.id);if(!community)return null;return <button key={a.id} type="button" aria-pressed={area===a.id}
      onClick={()=>selectArea(a.id)} className={area===a.id?'market-nearby-option is-selected':'market-nearby-option'}>
      {community.community_name} <small>{a.meters<1000?Math.max(0.1,a.meters/1000).toFixed(1):Math.round(a.meters/1000)} km</small></button>})}
   </div>}
   <div className="market-hero-grid market-hero-editorial">
    <section className="market-hero-copy market-hero-flat" aria-label={t('Shop together and save','একসাথে কিনে সাশ্রয় করুন')}>
     <span className="market-hero-editorial-kicker">{t('Community-first grocery marketplace','আপনার কমিউনিটির স্মার্ট বাজার')}</span>
     <AnimatedHeroMessages language={language}/>
     <div className="market-hero-actions">
      <a className="btn-primary" href="#deals">{t('Explore community deals','কমিউনিটি অফার দেখুন')}</a>
      <a className="btn-secondary" href="#how-it-works">{t('How it works','যেভাবে কাজ করে')}</a>
     </div>
     <div className="market-hero-benefits" aria-label={t('Shopping benefits','কেনাকাটার সুবিধা')}>
      <span>✓ {t('Free community pickup','কমিউনিটি পয়েন্টে ফ্রি')}</span>
      <span>✓ {t('Optional home delivery','চাইলে হোম ডেলিভারি')}</span>
      <span>✓ {t('Transparent pricing','স্বচ্ছ মূল্য')}</span>
     </div>
    </section>
    <section className="market-hero-product market-hero-pool-shell" aria-label={t('Featured community Pool','বিশেষ কমিউনিটি পুল')}>
     <FeaturedPoolShowcase pools={heroPools} language={language} areaName={activeArea?.community_name}/>
    </section>
   </div>
  </div></section>
  <section id="deals" className="market-band market-deals-band"><div className="market-content">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-teal-700">{t('Shop by buying mode','কেনার ধরন বেছে নিন')}</p><h2 className="mt-2 text-2xl font-black">{t('Products & local deals','পণ্য ও স্থানীয় অফার')}</h2><p className="mt-1 text-sm text-slate-500">{activeArea?activeArea.community_name:t('Choose an area to see nearby offers','কাছের অফার দেখতে এলাকা বাছুন')} · {filtered.length} {demoMode?t('demo offers','নমুনা অফার'):t('active offers','সক্রিয় অফার')}</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter buying mode">{([['all','All products','সব পণ্য'],['group','Group Deals','গ্রুপ ডিল'],['pool','Community Pools','কমিউনিটি পুল']] as const).map(([val,label,labelBn])=><button type="button" key={val} onClick={()=>setMode(val)} aria-pressed={mode===val} className={mode===val?'btn-primary':'btn-secondary'}>{t(label,labelBn)}</button>)}</div>
   </div>
   <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter product category">
    <button type="button" onClick={()=>setCategory('all')} aria-pressed={category==='all'} className={category==='all'?'btn-primary text-xs':'btn-secondary text-xs'}>{t('All categories','সব ক্যাটাগরি')}</button>
    {categories.map(c=><button type="button" key={c} aria-pressed={category===c} onClick={()=>setCategory(c)} className={category===c?'btn-primary text-xs':'btn-secondary text-xs'}>{t(c,offers.find(o=>o.category===c)?.category_bn??c)}</button>)}
   </div>
   {filtered.length===0?<div className="mt-6 rounded-3xl border border-black/10 bg-white p-8 text-center"><p className="text-xl font-black">{t('No active local offers yet','এখন কোনো সক্রিয় অফার নেই')}</p><p className="mt-2 text-sm text-slate-500">{t('Try another area or check back when new deals are published.','অন্য এলাকা বেছে নিন অথবা নতুন অফার প্রকাশিত হলে আবার দেখুন।')}</p></div>
   :<div className="market-products-grid mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(offer=>{
    const href=offer.offer_kind==='GROUP_DEAL'?groupHref:poolHref
    const hasPrice=Number(offer.confirmed_price)>0
    return <article key={offer.offer_kind+offer.offer_id+offer.community_id} className="market-product-card market-clickable-product flex min-w-0 flex-col rounded-3xl border border-black/10 bg-white p-4">
      <Link href={offer.is_demo?`/demo-product/${offer.product_id}`:`/shop/${offer.product_id}?area=${offer.community_id}`} className="market-product-overlay-link" aria-label={t('Open product details: ','পণ্যের বিস্তারিত দেখুন: ')+t(offer.product_name,offer.product_name_bn??offer.product_name)}/>
     <Link href={offer.is_demo?`/demo-product/${offer.product_id}`:`/shop/${offer.product_id}?area=${offer.community_id}`} className="market-product-image relative flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-white/30" aria-label={`View details for ${t(offer.product_name,offer.product_name_bn??offer.product_name)}`}>{offer.image_url?<img src={offer.image_url} alt={t(offer.product_name,offer.product_name_bn??offer.product_name)} loading="lazy" className="h-full w-full object-contain"/>:<img src="/grocery-hero-glass.svg" alt="" className="h-44 w-full object-contain"/>}
      {!offer.is_demo&&<span className="absolute left-2 top-2 rounded-full border border-teal-200 bg-white/95 px-3 py-1 text-xs font-bold text-teal-700">{offer.offer_kind==='GROUP_DEAL'?t('Group Deal','গ্রুপ ডিল'):t('Pool','পুল')}</span>}</Link>
     <h3 className="market-product-title mt-3 line-clamp-2 text-lg font-black"><Link href={offer.is_demo?`/demo-product/${offer.product_id}`:`/shop/${offer.product_id}?area=${offer.community_id}`}>{t(offer.product_name,offer.product_name_bn??offer.product_name)}</Link></h3>
     <p className="market-product-meta mt-1 text-xs text-slate-500">{[offer.brand,offer.package_size].filter(Boolean).join(' · ')}</p>
     <p className="market-product-community mt-2 text-xs text-slate-500">{areas.find(a=>a.community_id===offer.community_id)?.community_name??'Local community'}</p>
     <div className="market-product-prices mt-3 grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-black/10 p-3"><p className="text-xs font-bold">{t('Buy Alone','একা কিনুন')}</p><p className="mt-2 text-sm font-black">{offer.is_demo?formatPrice(offer.solo_price):t('Not quoted yet','দাম দেওয়া হয়নি')}</p><p className="mt-1 text-xs text-slate-500">{offer.is_demo?t('Sample price only · DEMO','শুধু নমুনা মূল্য · ডেমো'):t('Separate individual price required','একা কেনার আলাদা দাম প্রয়োজন')}</p></div>
      <div className="rounded-xl border border-teal-200 p-3"><p className="text-xs font-bold text-teal-700">{t('Group Buy','গ্রুপে কিনুন')}</p><p className="mt-2 text-lg font-black text-teal-700">{formatPrice(offer.confirmed_price??offer.upcoming_price)}</p><p className="mt-1 text-xs text-slate-500">{offer.is_demo?t('Sample price · DEMO','নমুনা মূল্য · ডেমো'):hasPrice?t('Published / unlocked','প্রকাশিত / আনলক হয়েছে'):t('Target or price pending','লক্ষ্য বা দাম বাকি')}</p></div>
     </div>
     <p className="market-product-count mt-3 text-xs text-slate-500">{offer.buyer_count} {t('buyers','জন ক্রেতা')} · {offer.quantity_joined} {t('units','ইউনিট')}{offer.is_demo?' (DEMO)':''}{offer.next_threshold? ` · ${t('Next threshold','পরের লক্ষ্য')} ${offer.next_threshold}`:''}</p>
     {offer.next_threshold&&offer.next_threshold>0&&<div className="market-product-progress mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Verified buyers towards next price tier" aria-valuemin={0} aria-valuemax={offer.next_threshold} aria-valuenow={Math.min(offer.buyer_count,offer.next_threshold)}><div className="h-full rounded-full bg-teal-600" style={{width:`${Math.min(100,Math.round(100*offer.buyer_count/offer.next_threshold))}%`}}/></div>}
     <div className="market-product-actions mt-auto grid grid-cols-2 gap-2 pt-4">
      <button type="button" disabled aria-disabled="true" title="Individual checkout is not released yet" className="btn-secondary cursor-not-allowed px-2 py-3 text-xs font-black">{offer.is_demo?t('Buy Alone · Demo','একা কিনুন · ডেমো'):t('Buy Alone · Soon','একা কেনা · শিগগিরই')}</button>
      {offer.is_demo?<button type="button" disabled aria-disabled="true" className="btn-primary cursor-not-allowed text-xs">{t('Group Buy · Demo','গ্রুপে কিনুন · ডেমো')}</button>:<Link href={href} className="btn-primary flex items-center justify-center text-center text-xs">{authenticated?t('Join / View group','গ্রুপ দেখুন / যোগ দিন'):t('Sign in to join','যোগ দিতে লগইন')}</Link>}
     </div>
    </article>
   })}</div>}
  </div></section>
  <section id="exclusive-products" className="market-band market-exclusives-band">
   <div className="market-content market-exclusive-grid">
    <div className="market-exclusive-intro">
     <p className="text-xs font-bold uppercase tracking-[.15em] text-teal-700">{t('Our own & exclusive products','আমাদের নিজস্ব ও এক্সক্লুসিভ পণ্য')}</p>
     <h2 className="mt-2 text-2xl font-black sm:text-3xl">{t('Discover our exclusive collection','এক্সক্লুসিভ পণ্য দেখুন')}</h2>
     <p className="mt-3 text-sm leading-7 text-slate-600">{t('Explore 2TBR private-label and exclusive products, photos and videos.','2TBR-এর নিজস্ব ও এক্সক্লুসিভ পণ্যের ছবি, ভিডিও ও বিস্তারিত দেখুন।')}</p>
     <a href="#deals" className="btn-secondary mt-4">{t('Browse available offers →','অফার দেখুন →')}</a>
    </div>
    <div className="market-exclusive-carousel"><FeaturedProductsCarousel products={featured} language={language} offers={offers} areas={areas} selectedArea={area}/></div>
   </div>
  </section>
  <PublicMarketplaceLower areas={areas} offers={offers} selectedArea={area} authenticated={authenticated} onChooseArea={selectArea} language={language} demoMode={demoMode}/>
  <PublicFooter storefront language={language}/>
 </>
}
