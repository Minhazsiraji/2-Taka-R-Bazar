'use client'

import {useMemo,useState} from 'react'
import Link from 'next/link'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {chooseAreaByLocation,formatPrice} from '@/lib/storefront'
import {PublicMarketplaceLower} from '@/components/public-marketplace-lower'
import {FeaturedProductsCarousel} from '@/components/featured-products-carousel'
import type {ShowcaseProduct} from '@/lib/showcase-media'

export function PublicMarketplace({areas,offers,authenticated=false,howLabelBn,catalogAvailable=true,featured=[]}:{areas:StorefrontArea[];offers:StorefrontOffer[];authenticated?:boolean;howLabelBn?:string;catalogAvailable?:boolean;featured?:ShowcaseProduct[]}){
 const [area,setArea]=useState('')
 const [search,setSearch]=useState('')
 const [gpsBusy,setGpsBusy]=useState(false)
 const [gpsMessage,setGpsMessage]=useState('')
 const [mode,setMode]=useState<'all'|'group'|'pool'>('all')
 const [category,setCategory]=useState('all')
 const activeArea=areas.find(a=>a.community_id===area)
 const categories=useMemo(()=>[...new Set(offers.filter(o=>!area||o.community_id===area).map(o=>o.category).filter(Boolean))].sort(),[offers,area])
 const filtered=useMemo(()=>offers.filter(offer=>
  (!area||offer.community_id===area)&&
  (mode==='all'||(mode==='group'?offer.offer_kind==='GROUP_DEAL':offer.offer_kind==='COMMUNITY_POOL'))&&
  (category==='all'||offer.category===category)&&
  [offer.product_name,offer.category,offer.brand,offer.offer_title].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
 ),[offers,area,search,mode,category])
 const spotlight=filtered.find(x=>x.offer_kind==='GROUP_DEAL')??filtered[0]
 const groupHref=authenticated?'/group-deals':'/login?next=%2Fgroup-deals'
 const poolHref=authenticated?'/pool':'/login?next=%2Fpool'
 function useLocation(){
  if(!('geolocation' in navigator)){setGpsMessage('Location unavailable. Please select your area.');return}
  setGpsBusy(true)
  setGpsMessage('Checking your approximate area in this browser…')
  navigator.geolocation.getCurrentPosition(p=>{
    const match=chooseAreaByLocation(areas,p.coords.latitude,p.coords.longitude,p.coords.accuracy)
    setGpsBusy(false)
    if(match){setArea(match.community_id);setCategory('all');setGpsMessage('Showing '+match.community_name+'. Confirm your address before checkout.')}
    else setGpsMessage('We could not confidently match your area. Please select it manually.')
  },()=>{setGpsBusy(false);setGpsMessage('Location permission unavailable. Select your area instead.')},
  {enableHighAccuracy:false,timeout:12000,maximumAge:60000})
 }
 return <>
  <section className="market-band market-hero-band"><div className="market-content market-hero-content">
   {!catalogAvailable&&<p role="alert" className="mt-5 rounded-xl border border-amber-300/60 p-4 text-sm font-semibold">Storefront offers are being configured. Browse the site now; live product quotes will appear only after the verified catalog is connected.</p>}
   <div className="mt-5 flex flex-wrap items-end gap-3">
    <label className="min-w-[190px] flex-1"><span className="mb-1 block text-xs font-bold">Your community / area</span>
     <select className="input w-full" value={area} onChange={e=>{setArea(e.target.value);setCategory('all');setGpsMessage('')}}>
      <option value="">All operating areas</option>{areas.map(a=><option key={a.community_id} value={a.community_id}>{a.community_name}</option>)}
     </select></label>
    <button type="button" onClick={useLocation} disabled={gpsBusy} className="btn-secondary min-h-11">{gpsBusy?'Locating…':'📍 Use my location'}</button>
    <label className="min-w-[200px] flex-[1.5]"><span className="mb-1 block text-xs font-bold">Find groceries</span>
     <input className="input w-full" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search oil, rice, groceries…" aria-label="Search products"/></label>
   </div>
   {gpsMessage&&<p role="status" className="mt-2 text-xs font-semibold text-slate-500">{gpsMessage}</p>}
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
    <div className="market-exclusive-carousel"><FeaturedProductsCarousel products={featured}/></div>
   </div>
  </section>
  <PublicMarketplaceLower areas={areas} offers={offers} selectedArea={area} authenticated={authenticated} onChooseArea={next=>{setArea(next);setCategory('all')}}/>
 </>
}
