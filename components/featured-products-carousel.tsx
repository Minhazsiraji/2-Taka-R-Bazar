'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import type {ShowcaseProduct} from '@/lib/showcase-media'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'

export function FeaturedProductsCarousel({products,language='bn'}:{products:ShowcaseProduct[];language?:MarketplaceLanguage}){
  const t=(en:string,bn:string)=>chooseText(language,en,bn)
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
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">2-TAKA-R-BAZAR</p><h2 className="mt-1 text-xl font-black">{t('Exclusive products coming soon','এক্সক্লুসিভ পণ্য শিগগিরই আসছে')}</h2><p className="mt-1 text-sm text-slate-500">{t('Our own and partner products will appear when published.','অনুমোদিত নিজস্ব ও পার্টনার পণ্য এখানে দেখানো হবে।')}</p></div>
  </div>

  const item=products[Math.min(active,products.length-1)]
  const image=item.image_url||item.gallery_urls?.[0]
  const href=item.is_demo?`/demo-product/${item.product_id}`:`/products/${item.product_id}`
  const title=t(item.name,item.name_bn??item.name)
  function move(delta:number){setActive(i=>(i+delta+products.length)%products.length)}
  return <div className="featured-showcase relative flex min-h-[490px] w-full min-w-0 flex-1 flex-col overflow-hidden p-5 sm:p-7"
    onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
    onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)}}>
    <div className="flex items-center justify-between gap-2"><span className="showcase-eyebrow">{item.is_demo?'DEMO · নমুনা':t('Exclusive from 2-TAKA-R-BAZAR','2-TAKA-R-BAZAR-এর এক্সক্লুসিভ পণ্য')}</span><span className="showcase-count">{active+1} / {products.length}</span></div>
    <div key={item.product_id} className="showcase-slide mt-3 flex flex-1 flex-col items-center justify-center">
      <Link href={href} className="showcase-hero-photo flex w-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-3xl" aria-label={`View ${title} details`}>
        {image?<img src={image} alt={title} className="h-64 w-full object-contain p-2 sm:h-72 lg:h-80" loading={active===0?'eager':'lazy'}/>:<div className="text-center text-slate-500"><span className="text-6xl" aria-hidden="true">🛒</span><p className="mt-2 text-sm">Product image coming soon</p></div>}
      </Link>
      <div className="w-full min-w-0 pt-4">
        <span className="showcase-kicker">{item.source_type==='PRIVATE_LABEL'?t('Our own label','নিজস্ব ব্র্যান্ড'):item.source_type==='EXCLUSIVE_PARTNER'?t('Exclusive partner','এক্সক্লুসিভ পার্টনার'):t('Selected by 2TBR','2TBR নির্বাচিত')}</span>
        <h2 className="mt-1 line-clamp-2 text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{[item.brand,item.package_size].filter(Boolean).join(' · ')}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Link href={href} className="btn-primary text-center">{t('Explore product →','পণ্য দেখুন →')}</Link><p className="text-xs text-slate-500">{item.is_demo?t('Illustrative prices only','শুধু নমুনা মূল্য'):t('Community pool prices shown in your pool','কমিউনিটি পুলে মূল্য দেখুন')}</p></div>
      </div>
    </div>
    {products.length>1&&<div className="mt-5 flex items-center justify-between gap-3" aria-label="Product carousel controls">
      <button type="button" className="showcase-arrow" onClick={()=>move(-1)} aria-label="Previous product">←</button>
      <div className="flex gap-2" role="tablist" aria-label="Select featured product">{products.map((p,index)=><button key={p.product_id} type="button" role="tab" aria-selected={active===index} aria-label={`Show ${p.name}`} className={`showcase-dot ${active===index?'is-active':''}`} onClick={()=>setActive(index)}/>)}</div>
      <button type="button" className="showcase-arrow" onClick={()=>move(1)} aria-label="Next product">→</button>
    </div>}
  </div>
}
