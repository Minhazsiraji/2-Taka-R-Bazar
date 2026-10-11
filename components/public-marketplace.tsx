'use client'

import {useMemo,useState} from 'react'
import Link from 'next/link'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {chooseAreaByLocation,formatPrice} from '@/lib/storefront'

export function PublicMarketplace({areas,offers,authenticated=false}:{areas:StorefrontArea[];offers:StorefrontOffer[];authenticated?:boolean}){
 const [area,setArea]=useState('')
 const [search,setSearch]=useState('')
 const [gpsBusy,setGpsBusy]=useState(false)
 const [gpsMessage,setGpsMessage]=useState('')
 const [mode,setMode]=useState<'all'|'group'|'pool'>('all')
 const activeArea=areas.find(a=>a.community_id===area)
 const filtered=useMemo(()=>offers.filter(offer=>
  (!area||offer.community_id===area)&&
  (mode==='all'||(mode==='group'?offer.offer_kind==='GROUP_DEAL':offer.offer_kind==='COMMUNITY_POOL'))&&
  [offer.product_name,offer.category,offer.brand,offer.offer_title].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
 ),[offers,area,search,mode])
 const featured=filtered.find(x=>x.offer_kind==='GROUP_DEAL')??filtered[0]
 const groupHref=authenticated?'/group-deals':'/login?next=%2Fgroup-deals'
 const poolHref=authenticated?'/pool':'/login?next=%2Fpool'
 function useLocation(){
  if(!('geolocation' in navigator)){setGpsMessage('Location unavailable. Please select your area.');return}
  setGpsBusy(true)
  setGpsMessage('Checking your approximate area in this browser…')
  navigator.geolocation.getCurrentPosition(p=>{
    const match=chooseAreaByLocation(areas,p.coords.latitude,p.coords.longitude,p.coords.accuracy)
    setGpsBusy(false)
    if(match){setArea(match.community_id);setGpsMessage('Showing '+match.community_name+'. Confirm your address before checkout.')}
    else setGpsMessage('We could not confidently match your area. Please select it manually.')
  },()=>{setGpsBusy(false);setGpsMessage('Location permission unavailable. Select your area instead.')},
  {enableHighAccuracy:false,timeout:12000,maximumAge:60000})
 }
 return <>
  <div className="mx-auto max-w-6xl px-5 pt-5 md:px-8">
   <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-black/10 pb-4 text-sm font-bold">
    <a href="#deals">Today's Group Deals</a><a href="#deals" onClick={()=>setMode('pool')}>Community Pools</a>
    <a href="#how-it-works">How it works</a>
    <Link href={authenticated?'/home':'/signup'}>{authenticated?'My dashboard':'Join community'}</Link>
   </nav>
   <div className="mt-5 flex flex-wrap items-end gap-3">
    <label className="min-w-[190px] flex-1"><span className="mb-1 block text-xs font-bold">Your community / area</span>
     <select className="input w-full" value={area} onChange={e=>{setArea(e.target.value);setGpsMessage('')}}>
      <option value="">All operating areas</option>{areas.map(a=><option key={a.community_id} value={a.community_id}>{a.community_name}</option>)}
     </select></label>
    <button type="button" onClick={useLocation} disabled={gpsBusy} className="btn-secondary min-h-11">{gpsBusy?'Locating…':'📍 Use my location'}</button>
    <label className="min-w-[200px] flex-[1.5]"><span className="mb-1 block text-xs font-bold">Find groceries</span>
     <input className="input w-full" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search oil, rice, groceries…" aria-label="Search products"/></label>
   </div>
   {gpsMessage&&<p role="status" className="mt-2 text-xs font-semibold text-slate-500">{gpsMessage}</p>}
   <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
    <section className="flex flex-col justify-center rounded-[28px] border border-black/10 bg-white p-6 sm:p-8">
     <span className="text-xs font-black uppercase tracking-[.17em] text-teal-700">Local deals · Transparent prices</span>
     <p className="mt-1 text-sm font-semibold text-slate-500" lang="bn">একসাথে কিনি, কম দামে পাই!</p>
     <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-.035em] sm:text-5xl">Shop freely. Choose how you save.</h1>
     <p className="mt-4 text-base leading-7 text-slate-600">Browse without an account. Buy alone at a confirmed individual price or join your community to unlock a group deal. Sign in only when you are ready to buy.</p>
     <p className="mt-2 text-sm leading-6 text-slate-600" lang="bn">লগইন ছাড়াই পণ্য দেখুন। একা কিনুন অথবা স্থানীয় গ্রুপে যোগ দিন। কেনার সময় মোবাইল OTP দিয়ে যাচাই করুন।</p>
     <div className="mt-6 flex flex-wrap gap-3"><a href="#deals" className="btn-primary">Explore local deals</a><a href="#how-it-works" className="btn-secondary">How it works</a></div>
     <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600"><p>✓ Free community pickup</p><p>✓ Optional home delivery</p><p>✓ No subscription fee</p><p>✓ No fake savings</p></div>
    </section>
    <section className="flex min-h-[410px] flex-col justify-center overflow-hidden rounded-[28px] border border-black/10 bg-white p-5 sm:p-7">
     {featured?<><span className="text-xs font-black uppercase tracking-[.16em] text-teal-700">{featured.offer_kind==='GROUP_DEAL'?'Featured Group Deal':'Community Pool spotlight'}</span>
      <div className="mt-4 flex min-h-56 items-center justify-center">{featured.image_url?<img src={featured.image_url} alt={featured.product_name} className="max-h-60 w-full object-contain"/>:<img src="/grocery-hero-glass.svg" alt="Grocery basket illustration" className="max-h-52 w-full object-contain"/>}</div>
      <h2 className="mt-3 text-xl font-black">{featured.product_name}</h2><p className="mt-1 text-sm text-slate-500">{featured.package_size} · {featured.offer_title}</p>
      <p className="mt-3 text-2xl font-black text-teal-700">{formatPrice(featured.confirmed_price??featured.upcoming_price)}</p>
      <p className="mt-1 text-xs text-slate-500">{featured.confirmed_price?'Currently unlocked or published price':'Potential next-tier price — not yet unlocked'}</p>
      <p className="mt-2 text-sm font-semibold">{featured.buyer_count} qualified {featured.buyer_count===1?'buyer':'buyers'} joined</p>
      <Link href={featured.offer_kind==='GROUP_DEAL'?groupHref:poolHref} className="btn-primary mt-4 text-center">View this {featured.offer_kind==='GROUP_DEAL'?'Group Deal':'Pool'} →</Link>
     </>:<><img src="/grocery-hero-glass.svg" alt="Grocery essentials" className="max-h-64 w-full object-contain"/><h2 className="mt-5 text-center text-xl font-black">Your next community deal starts here</h2><p className="mt-2 text-center text-sm text-slate-500">There are no publicly available active product offers right now. New products will appear when verified and published.</p></>}
    </section>
   </div>
  </div>
  <section id="deals" className="mx-auto max-w-6xl px-5 py-10 md:px-8">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-teal-700">Shop by buying mode</p><h2 className="mt-2 text-2xl font-black">Products & local deals</h2><p className="mt-1 text-sm text-slate-500">{activeArea?activeArea.community_name:'Choose an area to see nearby offers'} · {filtered.length} active offers</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter buying mode">{([['all','All products'],['group','Group Deals'],['pool','Community Pools']] as const).map(([val,label])=><button type="button" key={val} onClick={()=>setMode(val)} aria-pressed={mode===val} className={mode===val?'btn-primary':'btn-secondary'}>{label}</button>)}</div>
   </div>
   {filtered.length===0?<div className="mt-6 rounded-3xl border border-black/10 bg-white p-8 text-center"><p className="text-xl font-black">No active local offers yet</p><p className="mt-2 text-sm text-slate-500">Try another area or check back when Operations publishes an eligible product and a live deal.</p></div>
   :<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(offer=>{
    const href=offer.offer_kind==='GROUP_DEAL'?groupHref:poolHref
    const hasPrice=Number(offer.confirmed_price)>0
    return <article key={offer.offer_kind+offer.offer_id+offer.community_id} className="flex min-w-0 flex-col rounded-3xl border border-black/10 bg-white p-4">
     <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-white/30">{offer.image_url?<img src={offer.image_url} alt={offer.product_name} loading="lazy" className="h-full w-full object-contain"/>:<img src="/grocery-hero-glass.svg" alt="" className="h-44 w-full object-contain"/>}
      <span className="absolute left-2 top-2 rounded-full border border-teal-200 bg-white/95 px-3 py-1 text-xs font-bold text-teal-700">{offer.offer_kind==='GROUP_DEAL'?'Group Deal':'Pool'}</span></div>
     <h3 className="mt-3 line-clamp-2 text-lg font-black">{offer.product_name}</h3>
     <p className="mt-1 text-xs text-slate-500">{[offer.brand,offer.package_size].filter(Boolean).join(' · ')}</p>
     <p className="mt-2 text-xs text-slate-500">{areas.find(a=>a.community_id===offer.community_id)?.community_name??'Local community'}</p>
     <div className="mt-3 grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-black/10 p-3"><p className="text-xs font-bold">Buy Alone</p><p className="mt-2 text-sm font-black">Not quoted yet</p><p className="mt-1 text-xs text-slate-500">Separate individual price required</p></div>
      <div className="rounded-xl border border-teal-200 p-3"><p className="text-xs font-bold text-teal-700">Group Buy</p><p className="mt-2 text-lg font-black text-teal-700">{formatPrice(offer.confirmed_price??offer.upcoming_price)}</p><p className="mt-1 text-xs text-slate-500">{hasPrice?'Published / unlocked':'Target or price pending'}</p></div>
     </div>
     <p className="mt-3 text-xs text-slate-500">{offer.buyer_count} qualified joined · {offer.quantity_joined} units requested{offer.next_threshold? ` · Next threshold ${offer.next_threshold} buyers`:''}</p>
     <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
      <button type="button" disabled aria-disabled="true" title="Individual checkout is not released yet" className="cursor-not-allowed rounded-xl border border-slate-200 px-2 py-3 text-xs font-black opacity-60">Buy Alone · Soon</button>
      <Link href={href} className="btn-primary flex items-center justify-center text-center text-xs">{authenticated?'Join / View group':'Sign in to join'}</Link>
     </div>
    </article>
   })}</div>}
  </section>
  <section id="how-it-works" className="mx-auto mb-10 max-w-6xl rounded-[28px] border border-black/10 bg-white p-6 sm:p-8">
   <h2 className="text-2xl font-black">How it works</h2>
   <div className="mt-5 grid gap-4 text-sm leading-6 md:grid-cols-3">
    <p><b>1. Browse for free.</b> Explore products and compare active deals without signing in.</p>
    <p><b>2. Choose an area and buying mode.</b> Select manually or allow one-time browser location. Prices are always clearly labelled.</p>
    <p><b>3. Verify only when transacting.</b> OTP, community verification, quantity and final price confirmation happen in the secure purchasing flow.</p>
   </div>
   <p className="mt-4 text-xs text-slate-500">Location is not tracked continuously. Browsing does not qualify anyone for a Group Deal. Final prices and purchases are validated by the existing secure systems.</p>
  </section>
 </>
}
