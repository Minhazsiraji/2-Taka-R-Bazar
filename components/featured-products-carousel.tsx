'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import type {ShowcaseProduct} from '@/lib/showcase-media'

export function FeaturedProductsCarousel({products}:{products:ShowcaseProduct[]}){
  const [active,setActive]=useState(0)
  const [paused,setPaused]=useState(false)
  useEffect(()=>{
    if(products.length<=1 || paused)return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(reduced.matches)return
    const timer=window.setInterval(()=>{
      if(!document.hidden)setActive(i=>(i+1)%products.length)
    },6500)
    return()=>window.clearInterval(timer)
  },[products.length,paused])

  if(!products.length)return <div className="showcase-empty flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
    <img src="/grocery-hero-glass.svg" alt="Basket of everyday grocery essentials" decoding="async" className="h-64 max-h-[55vh] w-full object-contain sm:h-80"/>
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">2-TAKA-R-BAZAR exclusives</p><h2 className="mt-1 text-xl font-black">Exclusive products are coming soon</h2><p className="mt-1 text-sm text-slate-500">Our own and partner collections will appear here when published.</p></div>
  </div>

  const item=products[Math.min(active,products.length-1)]
  const image=item.image_url||item.gallery_urls?.[0]
  function move(delta:number){setActive(i=>(i+delta+products.length)%products.length)}
  return <div className="featured-showcase relative flex min-h-[490px] w-full min-w-0 flex-1 flex-col overflow-hidden p-5 sm:p-7"
    onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
    onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)}}>
    <div className="flex items-center justify-between gap-2"><span className="showcase-eyebrow">Exclusive from 2-TAKA-R-BAZAR</span><span className="showcase-count">{active+1} / {products.length}</span></div>
    <div key={item.product_id} className="showcase-slide mt-3 flex flex-1 flex-col items-center justify-center">
      <Link href={`/products/${item.product_id}`} className="showcase-hero-photo flex w-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-3xl" aria-label={`View ${item.name} details`}>
        {image?<img src={image} alt={item.name} className="h-64 w-full object-contain p-2 sm:h-72 lg:h-80" loading={active===0?'eager':'lazy'}/>:<div className="text-center text-slate-500"><span className="text-6xl" aria-hidden="true">🛒</span><p className="mt-2 text-sm">Product image coming soon</p></div>}
      </Link>
      <div className="w-full min-w-0 pt-4">
        <span className="showcase-kicker">{item.source_type==='PRIVATE_LABEL'?'Our own label':item.source_type==='EXCLUSIVE_PARTNER'?'Exclusive partner':'Selected by 2TBR'}</span>
        <h2 className="mt-1 line-clamp-2 text-2xl font-black sm:text-3xl">{item.name}</h2>
        <p className="mt-1 text-sm text-slate-500">{[item.brand,item.package_size].filter(Boolean).join(' · ')}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Link href={`/products/${item.product_id}`} className="btn-primary text-center">Explore product →</Link><p className="text-xs text-slate-500">Community pool prices shown in your pool</p></div>
      </div>
    </div>
    {products.length>1&&<div className="mt-5 flex items-center justify-between gap-3" aria-label="Product carousel controls">
      <button type="button" className="showcase-arrow" onClick={()=>move(-1)} aria-label="Previous product">←</button>
      <div className="flex gap-2" role="tablist" aria-label="Select featured product">{products.map((p,index)=><button key={p.product_id} type="button" role="tab" aria-selected={active===index} aria-label={`Show ${p.name}`} className={`showcase-dot ${active===index?'is-active':''}`} onClick={()=>setActive(index)}/>)}</div>
      <button type="button" className="showcase-arrow" onClick={()=>move(1)} aria-label="Next product">→</button>
    </div>}
  </div>
}
