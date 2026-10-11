'use client'

import {useMemo,useState,useRef,useCallback,useEffect} from 'react'
import Link from 'next/link'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {chooseAreaByLocation,distanceMeters,formatPrice} from '@/lib/storefront'
import {PublicMarketplaceLower} from '@/components/public-marketplace-lower'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import {FeaturedProductsCarousel} from '@/components/featured-products-carousel'
import type {ShowcaseProduct} from '@/lib/showcase-media'

export function PublicMarketplace({areas,offers,authenticated=false,howLabelBn,catalogAvailable=true,featured=[],demoMode=false}:{areas:StorefrontArea[];offers:StorefrontOffer[];authenticated?:boolean;howLabelBn?:string;catalogAvailable?:boolean;featured?:ShowcaseProduct[];demoMode?:boolean}){
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
 const spotlight=filtered.find(x=>x.offer_kind==='GROUP_DEAL')??filtered[0]
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
 const locationStatus=locationState==='matched'?t('Nearby community selected; joining requires verification.','কাছের কমিউনিটি নির্বাচিত হয়েছে; যোগ দিতে যাচাই প্রয়োজন।'):
 locationState==='denied'?t('Location denied. Select your area manually.','লোকেশন অনুমতি নেই। নিজে এলাকা বেছে নিন।'):
 locationState==='nearby'?t('No reliable match; select a community manually.','নির্ভরযোগ্য এলাকা মেলেনি; নিজে বেছে নিন।'):
 locationState==='manual'?t('Area selected; eligibility checked before joining.','এলাকা নির্বাচিত; যোগদানের আগে যাচাই হবে।'):
 gpsBusy?t('Requesting location…','লোকেশন চাওয়া হচ্ছে…'):t('You can browse without location.','লোকেশন ছাড়াও পণ্য দেখতে পারবেন।')

 return <>
  <PublicHeader storefront actionHref={authenticated?'/home':'/login'} actionLabel={authenticated?t('My dashboard','আমার ড্যাশবোর্ড'):t('Sign in','লগইন')}
   searchValue={search} onSearchChange={setSearch} onLocationClick={useLocation} locating={gpsBusy} locationLabel={activeLocationLabel}
   language={language} onLanguageChange={setLanguage}/>
  <section className="market-band market-hero-band"><div className="market-content market-hero-content">
   <div className="market-location-panel">
    <div className="market-location-intro"><strong>📍 {t('Find savings near your community','আপনার এলাকায় কম দামের অফার খুঁজুন')}</strong>
     <p>{t('Allow location to suggest nearby communities and group prices. Joining requires verified eligibility.','কাছের কমিউনিটি ও গ্রুপের দাম দেখতে লোকেশন অনুমতি দিন। যোগ দিতে এলাকা যাচাই প্রয়োজন।')}</p></div>
    <div className="market-location-control">
     <label htmlFor="market-area-select">{t('Your community / area','আপনার কমিউনিটি / এলাকা')}</label>
     <select id="market-area-select" className="input w-full" value={area} onChange={e=>selectArea(e.target.value)}>
      <option value="">{t('All operating areas','সব এলাকা')}</option>{areas.map(a=><option key={a.community_id} value={a.community_id}>{a.community_name}</option>)}
     </select></div></div>
   <p role="status" aria-live="polite" className="market-location-status">{locationStatus}</p>
   {nearestAreas.length>0&&<div className="market-nearby-suggestions" aria-label={t('Nearby communities','কাছের কমিউনিটি')}>
    <span className="market-nearby-heading">{t('Near you','কাছাকাছি')} <small>({t('approximate','আনুমানিক')})</small></span>
    {nearestAreas.map(a=>{const community=areas.find(c=>c.community_id===a.id);if(!community)return null;return <button key={a.id} type="button" aria-pressed={area===a.id}
      onClick={()=>selectArea(a.id)} className={area===a.id?'market-nearby-option is-selected':'market-nearby-option'}>
      {community.community_name} <small>{a.meters<1000?Math.max(0.1,a.meters/1000).toFixed(1):Math.round(a.meters/1000)} km</small></button>})}
   </div>}
   <div className="market-hero-grid mt-6 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
    <section className="market-hero-copy flex flex-col justify-center rounded-[28px] border border-black/10 bg-white p-6 sm:p-8">
     <span className="text-xs font-black uppercase tracking-[.17em] text-teal-700">Local deals · Transparent prices</span>
     <p className="mt-1 text-sm font-semibold text-slate-500" lang="bn">একসাথে কিনি, কম দামে পাই!</p>
     <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-.035em] sm:text-5xl">Shop freely. Choose how you save.</h1>
     <p className="mt-4 text-base leading-7 text-slate-600">Browse without an account. Buy alone at a confirmed individual price or join your community to unlock a group deal. Sign in only when you are ready to buy.</p>
     <p className="mt-2 text-sm leading-6 text-slate-600" lang="bn">লগইন ছাড়াই পণ্য দেখুন। একা কিনুন অথবা স্থানীয় গ্রুপে যোগ দিন। কেনার সময় মোবাইল OTP দিয়ে যাচাই করুন।</p>
     <div className="mt-6 flex flex-wrap gap-3"><a href="#deals" className="btn-primary">Explore local deals</a><a href="#how-it-works" className="btn-secondary">How it works</a></div>
     <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600"><p>✓ Free community pickup</p><p>✓ Optional home delivery</p><p>✓ No subscription fee</p><p>✓ No fake savings</p></div>
    </section>
    <section className="market-hero-product flex min-h-[410px] flex-col justify-center overflow-hidden rounded-[28px] border border-black/10 bg-white p-5 sm:p-7">
     {spotlight?<><span className="text-xs font-black uppercase tracking-[.16em] text-teal-700">{spotlight.offer_kind==='GROUP_DEAL'?'Featured Group Deal':'Community Pool spotlight'}</span>
      <div className="mt-4 flex min-h-56 items-center justify-center">{spotlight.image_url?<img src={spotlight.image_url} alt={spotlight.product_name} className="max-h-60 w-full object-contain"/>:<img src="/grocery-hero-glass.svg" alt="Grocery basket illustration" className="max-h-52 w-full object-contain"/>}</div>
      <h2 className="mt-3 text-xl font-black">{spotlight.product_name}</h2><p className="mt-1 text-sm text-slate-500">{spotlight.package_size} · {spotlight.offer_title}</p>
      <p className="mt-3 text-2xl font-black text-teal-700">{formatPrice(spotlight.confirmed_price??spotlight.upcoming_price)}</p>
      <p className="mt-1 text-xs text-slate-500">{spotlight.confirmed_price?'Currently unlocked or published price':'Potential next-tier price — not yet unlocked'}</p>
      <p className="mt-2 text-sm font-semibold">{spotlight.buyer_count} qualified {spotlight.buyer_count===1?'buyer':'buyers'} joined</p>
      <Link href={spotlight.offer_kind==='GROUP_DEAL'?groupHref:poolHref} className="btn-primary mt-4 text-center">View this {spotlight.offer_kind==='GROUP_DEAL'?'Group Deal':'Pool'} →</Link>
     </>:<><img src="/grocery-hero-glass.svg" alt="Grocery essentials" className="max-h-64 w-full object-contain"/><h2 className="mt-5 text-center text-xl font-black">Your next community deal starts here</h2><p className="mt-2 text-center text-sm text-slate-500">There are no publicly available active product offers right now. New products will appear when verified and published.</p></>}
    </section>
   </div>
  </div></section>
  <section id="deals" className="market-band market-deals-band"><div className="market-content">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-teal-700">Shop by buying mode</p><h2 className="mt-2 text-2xl font-black">Products & local deals</h2><p className="mt-1 text-sm text-slate-500">{activeArea?activeArea.community_name:'Choose an area to see nearby offers'} · {filtered.length} active offers</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter buying mode">{([['all','All products'],['group','Group Deals'],['pool','Community Pools']] as const).map(([val,label])=><button type="button" key={val} onClick={()=>setMode(val)} aria-pressed={mode===val} className={mode===val?'btn-primary':'btn-secondary'}>{label}</button>)}</div>
   </div>
   <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter product category">
    <button type="button" onClick={()=>setCategory('all')} aria-pressed={category==='all'} className={category==='all'?'btn-primary text-xs':'btn-secondary text-xs'}>All categories</button>
    {categories.map(c=><button type="button" key={c} aria-pressed={category===c} onClick={()=>setCategory(c)} className={category===c?'btn-primary text-xs':'btn-secondary text-xs'}>{c}</button>)}
   </div>
   {filtered.length===0?<div className="mt-6 rounded-3xl border border-black/10 bg-white p-8 text-center"><p className="text-xl font-black">No active local offers yet</p><p className="mt-2 text-sm text-slate-500">Try another area or check back when Operations publishes an eligible product and a live deal.</p></div>
   :<div className="market-products-grid mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(offer=>{
    const href=offer.offer_kind==='GROUP_DEAL'?groupHref:poolHref
    const hasPrice=Number(offer.confirmed_price)>0
    return <article key={offer.offer_kind+offer.offer_id+offer.community_id} className="market-product-card flex min-w-0 flex-col rounded-3xl border border-black/10 bg-white p-4">
     <Link href={`/shop/${offer.product_id}?area=${offer.community_id}`} className="relative flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-white/30" aria-label={`View details for ${offer.product_name}`}>{offer.image_url?<img src={offer.image_url} alt={offer.product_name} loading="lazy" className="h-full w-full object-contain"/>:<img src="/grocery-hero-glass.svg" alt="" className="h-44 w-full object-contain"/>}
      <span className="absolute left-2 top-2 rounded-full border border-teal-200 bg-white/95 px-3 py-1 text-xs font-bold text-teal-700">{offer.offer_kind==='GROUP_DEAL'?'Group Deal':'Pool'}</span></Link>
     <h3 className="mt-3 line-clamp-2 text-lg font-black"><Link href={`/shop/${offer.product_id}?area=${offer.community_id}`}>{offer.product_name}</Link></h3>
     <p className="mt-1 text-xs text-slate-500">{[offer.brand,offer.package_size].filter(Boolean).join(' · ')}</p>
     <p className="mt-2 text-xs text-slate-500">{areas.find(a=>a.community_id===offer.community_id)?.community_name??'Local community'}</p>
     <div className="mt-3 grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-black/10 p-3"><p className="text-xs font-bold">Buy Alone</p><p className="mt-2 text-sm font-black">Not quoted yet</p><p className="mt-1 text-xs text-slate-500">Separate individual price required</p></div>
      <div className="rounded-xl border border-teal-200 p-3"><p className="text-xs font-bold text-teal-700">Group Buy</p><p className="mt-2 text-lg font-black text-teal-700">{formatPrice(offer.confirmed_price??offer.upcoming_price)}</p><p className="mt-1 text-xs text-slate-500">{hasPrice?'Published / unlocked':'Target or price pending'}</p></div>
     </div>
     <p className="mt-3 text-xs text-slate-500">{offer.buyer_count} qualified joined · {offer.quantity_joined} units requested{offer.next_threshold? ` · Next threshold ${offer.next_threshold} buyers`:''}</p>
     {offer.next_threshold&&offer.next_threshold>0&&<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Verified buyers towards next price tier" aria-valuemin={0} aria-valuemax={offer.next_threshold} aria-valuenow={Math.min(offer.buyer_count,offer.next_threshold)}><div className="h-full rounded-full bg-teal-600" style={{width:`${Math.min(100,Math.round(100*offer.buyer_count/offer.next_threshold))}%`}}/></div>}
     <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
      <button type="button" disabled aria-disabled="true" title="Individual checkout is not released yet" className="cursor-not-allowed rounded-xl border border-slate-200 px-2 py-3 text-xs font-black opacity-60">Buy Alone · Soon</button>
      <Link href={href} className="btn-primary flex items-center justify-center text-center text-xs">{authenticated?'Join / View group':'Sign in to join'}</Link>
     </div>
    </article>
   })}</div>}
  </div></section>
  <section id="exclusive-products" className="market-band market-exclusives-band">
   <div className="market-content market-exclusive-grid">
    <div className="market-exclusive-intro">
     <p className="text-xs font-bold uppercase tracking-[.15em] text-teal-700">Our own & exclusive products</p>
     <h2 className="mt-2 text-2xl font-black sm:text-3xl">Discover our exclusive collection</h2>
     <p className="mt-3 text-sm leading-7 text-slate-600">Explore 2-TAKA-R-BAZAR private-label and exclusive partner products, photos and short videos. Real approved products will appear as they are published.</p>
     <a href="#deals" className="btn-secondary mt-4">Browse available offers →</a>
    </div>
    <div className="market-exclusive-carousel"><FeaturedProductsCarousel products={featured} language={language}/></div>
   </div>
  </section>
  <PublicMarketplaceLower areas={areas} offers={offers} selectedArea={area} authenticated={authenticated} onChooseArea={selectArea} language={language} demoMode={demoMode}/>
  <PublicFooter storefront language={language}/>
 </>
}
