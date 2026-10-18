'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import type {ShowcaseProduct} from '@/lib/showcase-media'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import type {StorefrontOffer,StorefrontArea} from '@/lib/storefront'
import {formatPrice} from '@/lib/storefront'
import {featuredProductWindow} from '@/lib/featured-product-window'
import {setCommerceCartItem} from '@/app/actions/commerce'

export function FeaturedProductsCarousel({products,language='en',offers=[],areas=[],selectedArea=''}:{products:ShowcaseProduct[];language?:MarketplaceLanguage;offers?:StorefrontOffer[];areas?:StorefrontArea[];selectedArea?:string}){
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const [active,setActive]=useState(0)
 const [paused,setPaused]=useState(false)
 useEffect(()=>{
  if(products.length<=1||paused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const timer=window.setInterval(()=>{if(!document.hidden)setActive(i=>(i+1)%products.length)},6500)
  return()=>window.clearInterval(timer)
 },[products.length,paused])
 if(!products.length)return <div className="showcase-empty flex flex-col items-center gap-3 p-5 text-center">
  <img src="/grocery-hero-glass.svg" alt="" className="h-32 w-full object-contain"/>
  <h2 className="text-lg font-black">{t('Exclusive products coming soon','এক্সক্লুসিভ পণ্য শিগগিরই আসছে')}</h2>
  <p className="text-sm">{t('Our own and partner products will appear when published.','অনুমোদিত নিজস্ব ও পার্টনার পণ্য এখানে দেখানো হবে।')}</p>
 </div>
 const start=active%products.length
 const visible=featuredProductWindow(products,start)
 function move(delta:number){setActive(i=>(i+delta+products.length)%products.length)}
 return <div className="market-showcase-compact" role="region" aria-roledescription="carousel" aria-label={t('Exclusive product selection','এক্সক্লুসিভ পণ্যের সংগ্রহ')}
  onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
  onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}>
  <div className="market-showcase-heading"><span>{t('Featured selection','নির্বাচিত পণ্য')}</span><span className="showcase-count">{start+1} / {products.length}</span></div>
  <div className="market-showcase-cards" aria-live="off">
   {visible.map(item=>{
    const eligibleOffers=offers.filter(o=>o.product_id===item.product_id&&(!selectedArea||o.community_id===selectedArea))
    const offer=eligibleOffers.find(o=>o.offer_kind!=='SOLO')??eligibleOffers[0]
    const soloOffer=eligibleOffers.find(o=>Boolean(o.commerce_solo_id))
    const canBuyAlone=Boolean(selectedArea)&&!item.is_demo&&Boolean(soloOffer?.commerce_solo_id&&soloOffer.commerce_solo_available)
    const soldOut=Boolean(selectedArea)&&!item.is_demo&&Boolean(soloOffer?.commerce_solo_id&&!soloOffer.commerce_solo_available)
    const href=item.is_demo?`/demo-product/${item.product_id}`:`/products/${item.product_id}`
    const title=t(item.name,item.name_bn??item.name)
    const community=areas.find(a=>a.community_id===(soloOffer?.community_id??offer?.community_id??selectedArea))
    const image=item.image_url||item.gallery_urls?.[0]
    const hasCurrentPrice=offer?.offer_kind!=='SOLO'&&Number(offer?.confirmed_price)>0
    const groupPrice=offer?.offer_kind==='SOLO'?null:offer?.confirmed_price??offer?.upcoming_price
    return <article className="market-product-card market-showcase-product flex min-w-0 flex-col p-3" key={item.product_id}>
     <Link href={href} className="market-product-image relative flex items-center justify-center overflow-hidden rounded-xl" aria-label={t('View product: ','পণ্য দেখুন: ')+title}>
      <ShowcaseImage src={image} title={title} fallback={t('Image coming soon','ছবি শিগগিরই আসছে')}/>
     </Link>
     <h3 className="market-product-title"><Link href={href}>{title}</Link></h3>
     <p className="market-product-meta">{[item.brand,item.package_size].filter(Boolean).join(' · ')}</p>
     <p className="market-product-community">{community?.community_name??t('Choose a community for local prices','স্থানীয় দাম দেখতে এলাকা বাছুন')}</p>
     <div className="market-product-prices grid grid-cols-2 gap-2">
      <div className="rounded-xl border p-2"><p>{t('Buy Alone','একা কিনুন')}</p><strong>{selectedArea&&Number(soloOffer?.solo_price)>0?formatPrice(soloOffer?.solo_price):t('Not quoted yet','দাম দেওয়া হয়নি')}</strong><p>{item.is_demo?t('Sample price only · DEMO','শুধু নমুনা মূল্য · ডেমো'):t('Individual quote required','একা কেনার আলাদা দাম প্রয়োজন')}</p></div>
      <div className="rounded-xl border p-2"><p>{t('Group Buy','গ্রুপে কিনুন')}</p><strong>{Number(groupPrice)>0?formatPrice(groupPrice):t('Price pending','দাম দেওয়া হয়নি')}</strong><p>{item.is_demo?t('Sample price · DEMO','নমুনা মূল্য · ডেমো'):hasCurrentPrice?t('Published / unlocked','প্রকাশিত / আনলক হয়েছে'):t('Conditional price or quote pending','শর্তসাপেক্ষ দাম বা মূল্য বাকি')}</p></div>
     </div>
     {offer&&<p className="market-product-count">{offer.buyer_count} {t('buyers','জন ক্রেতা')} · {offer.quantity_joined} {t('units','ইউনিট')}{item.is_demo?' (DEMO)':''}{offer.next_threshold?` · ${t('Next threshold','পরের লক্ষ্য')} ${offer.next_threshold}`:''}</p>}
     {offer?.next_threshold&&offer.next_threshold>0&&<div className="market-product-progress" role="progressbar" aria-label={t('Buyers towards next tier','পরের স্তরের ক্রেতা')} aria-valuemin={0} aria-valuemax={offer.next_threshold} aria-valuenow={Math.min(offer.buyer_count,offer.next_threshold)}><div style={{width:`${Math.min(100,Math.round(100*offer.buyer_count/offer.next_threshold))}%`}}/></div>}
     <div className="market-product-actions grid grid-cols-2 gap-2">
      {canBuyAlone?<form action={setCommerceCartItem} className="contents">
       <input type="hidden" name="offer_id" value={soloOffer!.commerce_solo_id}/>
       <input type="hidden" name="quantity" value="1"/>
       <button type="submit" className="btn-secondary">{t('Buy Alone','একা কিনুন')}</button>
      </form>:<button type="button" disabled aria-disabled="true" title={!selectedArea?t('Choose your community for individual pricing','একা কেনার দাম দেখতে এলাকা বাছুন'):soldOut?t('This verified offer has no remaining stock','এই অফারে স্টক নেই'):t('Individual checkout requires a verified, approved offer','একা কেনার জন্য যাচাইকৃত, অনুমোদিত অফার প্রয়োজন')} className="btn-secondary">
       {item.is_demo?t('Buy Alone · Demo','একা কিনুন · ডেমো'):!selectedArea?t('Choose area','এলাকা বাছুন'):soldOut?t('Sold out','স্টক শেষ'):t('Buy Alone · Soon','একা কেনা · শিগগিরই')}
      </button>}
      {!item.is_demo&&<Link href={'/pilot-book?product='+item.product_id} className="btn-primary col-span-2 text-center text-sm">{t('Book now · Pilot','এখনই বুক করুন · পাইলট')}</Link>}
      {item.is_demo?<button type="button" disabled aria-disabled="true" className="btn-primary">{t('Group Buy · Demo','গ্রুপে কিনুন · ডেমো')}</button>:<Link href={href} className="btn-primary">{t('View product →','পণ্য দেখুন →')}</Link>}
     </div>
    </article>
   })}
  </div>
  {products.length>1&&<div className="market-showcase-navigation" aria-label="Product carousel controls">
   <button type="button" className="showcase-arrow" onClick={()=>move(-1)} aria-label={t('Previous product','আগের পণ্য')}>←</button>
   <div className="market-showcase-dots" role="group" aria-label={t('Select featured product','নির্বাচিত পণ্য বাছুন')}>{products.map((item,index)=><button key={item.product_id} type="button" aria-current={start===index?'true':undefined} aria-label={t('Show ','দেখুন: ')+t(item.name,item.name_bn??item.name)} className={`showcase-dot ${start===index?'is-active':''}`} onClick={()=>setActive(index)}/>)}</div>
   <button type="button" className="showcase-arrow" onClick={()=>move(1)} aria-label={t('Next product','পরের পণ্য')}>→</button>
  </div>}
 </div>
}
function ShowcaseImage({src,title,fallback}:{src:string|undefined|null;title:string;fallback:string}){
 const [failed,setFailed]=useState(false)
 return src&&!failed?<img src={src} alt={title} className="h-full w-full object-contain" loading="lazy" onError={()=>setFailed(true)}/>:<span className="market-showcase-fallback">{fallback}</span>
}
