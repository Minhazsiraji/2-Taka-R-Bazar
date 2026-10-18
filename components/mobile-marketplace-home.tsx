'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {setCommerceCartItem} from '@/app/actions/commerce'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import type {ShowcaseProduct} from '@/lib/showcase-media'
import type {PublishedCatalogPage} from '@/lib/published-product-catalog'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {formatPrice} from '@/lib/storefront'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import type {HomeSavingsSummary} from '@/lib/home-savings'

type Props={
 areas:StorefrontArea[]
 selectedArea:string
 onChooseArea:(id:string)=>void
 onDetectArea:()=>void
 detectingArea:boolean
 offers:StorefrontOffer[]
 products:ShowcaseProduct[]
 publishedProducts:PublishedCatalogPage
 pools:DemoFeaturedPool[]
 language:MarketplaceLanguage
 demoMode:boolean
 search:string
 savings:HomeSavingsSummary
}
const heroSlides=[
 {en:'Better prices. Together.',bn:'একসাথে কিনি, কম দামে পাই!',
  sub:'Shop daily essentials, join neighbours and unlock group savings.',
  subBn:'নিত্যপ্রয়োজনীয় পণ্য কিনুন, প্রতিবেশীদের সঙ্গে সাশ্রয় করুন.',
  action:'Explore group deals',actionBn:'গ্রুপ ডিল দেখুন',href:'#mobile-deals'},
 {en:'Everyday essentials, close to home.',bn:'নিজের এলাকায় নিত্যপ্রয়োজনীয় বাজার',
  sub:'Find products and community offers without signing in first.',
  subBn:'লগইন ছাড়াই পণ্য ও এলাকার অফার দেখুন.',
  action:'Browse products',actionBn:'পণ্য দেখুন',href:'#mobile-exclusive'},
 {en:'Your community. Your savings.',bn:'আপনার কমিউনিটি, আপনার সাশ্রয়',
  sub:'Follow local group deals and Pool progress before you join.',
  subBn:'যোগ দেওয়ার আগে গ্রুপ ডিল ও পুলের অগ্রগতি দেখুন.',
  action:'View community Pools',actionBn:'কমিউনিটি পুল দেখুন',href:'#mobile-pools'},
 {en:'Smart shopping. Real savings!',bn:'একসাথে কিনি, কম দামে পাই!',
  sub:'Compare published prices, then choose pickup or delivery.',
  subBn:'প্রকাশিত দাম মিলিয়ে সংগ্রহ বা ডেলিভারি বেছে নিন.',
  action:'Explore products',actionBn:'পণ্য দেখুন',href:'#mobile-exclusive'},
] as const

function ProductImage({url,title}:{url:string|null|undefined;title:string}){
 const [failed,setFailed]=useState(false)
 return url&&!failed?<img src={url} loading="lazy" alt={title} onError={()=>setFailed(true)}/>:
  <span className="mhome-image-empty" aria-label={title}>2TBR<span>Photo coming soon</span></span>
}
function SectionHeading({number,eyebrow,title,description,href,viewText,savings=false}:{
 number:string;eyebrow:string;title:string;description:string;href:string;viewText:string;savings?:boolean
}){
 return <div className={savings?'mhome-savings-heading':'mhome-section-heading'}>
  <div><p className="mhome-eyebrow">{number} · {eyebrow}</p><h2>{title}</h2><p className="mhome-muted">{description}</p></div>
  <Link className="mhome-view-all" href={href}>{viewText} <span aria-hidden="true">›</span></Link>
 </div>
}
const money=(n:number|null|undefined)=>n!=null&&Number(n)>0?formatPrice(n):null

export function MobileMarketplaceHome({areas,selectedArea,onChooseArea,onDetectArea,detectingArea,
 offers,products,publishedProducts,pools,language,demoMode,search,savings}:Props){
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const [slide,setSlide]=useState(0)
 useEffect(()=>{
  if(typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const timer=window.setInterval(()=>setSlide(i=>(i+1)%heroSlides.length),7200)
  return()=>window.clearInterval(timer)
 },[])
 const query=search.trim().toLocaleLowerCase()
 const localOffers=offers.filter(o=>(!selectedArea||o.community_id===selectedArea)&&(
  !query||[o.product_name,o.product_name_bn,o.brand,o.category,o.offer_title].some(v=>(v??'').toLocaleLowerCase().includes(query))))
 const deals=localOffers.filter(o=>o.offer_kind==='GROUP_DEAL').slice(0,4)
 const poolRows=pools.filter(p=>!selectedArea||!p.community_id||p.community_id===selectedArea).slice(0,3)
 const unique=new Set<string>()
 const exclusive: {id:string;name:string;nameBn:string;package:string;image:string|null;price:number|null;
  oldPrice:number|null;demo:boolean;commerceId:string|null;available:boolean;bookable:boolean;href?:string}[]=[]
 const eligible=products.filter(p=>!query||[p.name,p.name_bn,p.brand].some(v=>(v??'').toLowerCase().includes(query)))
 for(const p of eligible){
  if(unique.has(p.product_id))continue
  const productOffer=localOffers.find(o=>o.product_id===p.product_id&&o.offer_kind==='SOLO')
   ??localOffers.find(o=>o.product_id===p.product_id)
  if(selectedArea&&offers.some(o=>o.product_id===p.product_id)&&!productOffer)continue
  unique.add(p.product_id)
  const price=Number(productOffer?.solo_price??productOffer?.confirmed_price??0)||null
  exclusive.push({id:p.product_id,name:p.name,nameBn:p.name_bn??p.name,package:p.package_size,
   image:p.image_url??p.gallery_urls?.[0]??null,price,oldPrice:productOffer?.reference_price??null,
   demo:Boolean(p.is_demo||productOffer?.is_demo),commerceId:productOffer?.commerce_solo_id??null,
   available:Boolean(productOffer?.commerce_solo_available),bookable:Boolean(productOffer?.offer_kind==='SOLO'&&price&&!productOffer?.commerce_solo_id)})
 }
 for(const item of publishedProducts.items){
  if(unique.has(item.product_id))continue
  if(query&&![item.title_en,item.title_bn,item.category].some(v=>v.toLocaleLowerCase().includes(query)))continue
  unique.add(item.product_id)
  const priceOffer=localOffers.find(o=>o.product_id===item.product_id&&o.offer_kind==='SOLO')
   ??localOffers.find(o=>o.product_id===item.product_id)
  exclusive.push({id:item.product_id,name:item.title_en,nameBn:item.title_bn,
   package:item.package_size,image:item.image_url,price:Number(priceOffer?.solo_price??priceOffer?.confirmed_price??0)||null,
   oldPrice:priceOffer?.reference_price??null,demo:false,commerceId:priceOffer?.commerce_solo_id??null,
   available:Boolean(priceOffer?.commerce_solo_available),bookable:false,href:(language==='bn'?'/bn':'')+'/p/'+item.slug})
 }
 for(const o of localOffers){
  if(unique.has(o.product_id))continue
  unique.add(o.product_id)
  exclusive.push({id:o.product_id,name:o.product_name,nameBn:o.product_name_bn??o.product_name,
   package:o.package_size,image:o.image_url,price:Number(o.solo_price??o.confirmed_price??0)||null,
   oldPrice:o.reference_price,demo:Boolean(o.is_demo),commerceId:o.commerce_solo_id??null,
   available:Boolean(o.commerce_solo_available),bookable:Boolean(o.offer_kind==='SOLO'&&Number(o.confirmed_price)>0&&!o.commerce_solo_id)})
 }
 const activeSlide=heroSlides[slide]
 return <div className="mhome" lang={language} aria-label={t('2TBR marketplace homepage','২টিবিআর বাজার হোম')}>
  <div className="mhome-area-strip">
   <button className="mhome-geo-button" type="button" onClick={onDetectArea} disabled={detectingArea}
    aria-label={t('Detect nearby community','কাছের কমিউনিটি খুঁজুন')} title={t('Detect location','লোকেশন খুঁজুন')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
   </button>
   <label htmlFor="mhome-community">{t('Your community','আপনার এলাকা')}</label>
   <select id="mhome-community" value={selectedArea} onChange={e=>onChooseArea(e.target.value)}
    aria-label={t('Choose your community','আপনার এলাকা বাছুন')}>
    <option value="">{t('All areas','সব এলাকা')}</option>
    {areas.map(a=><option key={a.community_id} value={a.community_id}>{a.community_name}</option>)}
   </select>
   {demoMode&&<span className="mhome-demo-pill">DEMO DATA</span>}
  </div>
  <section className="mhome-hero" aria-label={t('Featured shopping messages','ফিচারড বার্তা')} role="region" aria-roledescription="carousel">
   <div className="mhome-hero-copy" aria-live="off">
    <span className="mhome-hero-kicker">✦ SMART SHOPPING. REAL SAVINGS!</span>
    <h1 key={slide}>{t(activeSlide.en,activeSlide.bn)}</h1>
    <p>{t(activeSlide.sub,activeSlide.subBn)}</p>
    <a href={activeSlide.href}>{t(activeSlide.action,activeSlide.actionBn)} <span aria-hidden="true">→</span></a>
   </div>
   <img className="mhome-hero-art" src="/grocery-hero-glass.svg" alt="" aria-hidden="true"/>
   <button className="mhome-hero-arrow mhome-prev" type="button" aria-label={t('Previous banner','আগের ব্যানার')}
    onClick={()=>setSlide(i=>(i+heroSlides.length-1)%heroSlides.length)}>‹</button>
   <button className="mhome-hero-arrow mhome-next" type="button" aria-label={t('Next banner','পরের ব্যানার')}
    onClick={()=>setSlide(i=>(i+1)%heroSlides.length)}>›</button>
   <div className="mhome-dots" aria-label={t('Choose banner','ব্যানার বাছুন')}>
    {heroSlides.map((_,i)=><button key={i} type="button" aria-current={i===slide?'true':undefined}
     aria-label={t('Banner ','ব্যানার ')+(i+1)} onClick={()=>setSlide(i)}/>)}
   </div>
  </section>

  <section className="mhome-section mhome-savings" id="mobile-savings" aria-label={t('Your Savings Summary','আপনার সাশ্রয়ের হিসাব')}>
   <SectionHeading savings number="01" eyebrow={t('Verified purchase savings','যাচাইকৃত কেনাকাটার সাশ্রয়')}
    title={t('Your Savings Summary','আপনার সাশ্রয়ের হিসাব')}
    description={t('Only completed, paid and eligible orders count.','শুধু সম্পন্ন ও যাচাইকৃত কেনাকাটা গণনা করা হয়।')}
    href="/account/orders" viewText={t('View details','বিস্তারিত দেখুন')}/>
   <div className="mhome-savings-grid">
    {([
     ['month',t('This Month','এই মাস'),savings.thisMonth],
     ['previous',t('Prev. Month','গত মাস'),savings.previousMonth],
     ['lifetime',t('Lifetime','মোট সাশ্রয়'),savings.lifetime],
     ['community',t('Community','কমিউনিটি'),savings.community],
    ] as const).map(([kind,label,value])=><article className={'mhome-savings-card is-'+kind} key={kind}>
     <span className="mhome-savings-label">{label}</span>
     <strong className="mhome-savings-value">{value===null?t('Unavailable','তথ্য নেই'):'৳'+value.toLocaleString('en-BD',{maximumFractionDigits:2})}</strong>
     <span className="mhome-savings-foot">{kind==='community'?t('Verified area total only','শুধু যাচাইকৃত এলাকা'):
      t('Verified orders only','যাচাইকৃত অর্ডার')}</span>
    </article>)}
   </div>
   {!savings.verified&&<p className="mhome-savings-note" role="status">
    {t('Verified savings will appear when eligible completed orders are available. No sample balances are shown.',
     'যোগ্য সম্পন্ন অর্ডার পাওয়া গেলে যাচাইকৃত সাশ্রয় দেখানো হবে। এখানে কোনো নমুনা ব্যালেন্স নেই।')}
   </p>}
  </section>

  <section className="mhome-section" id="mobile-deals">
   <SectionHeading number="02" eyebrow={t('Community savings','কমিউনিটি সাশ্রয়')}
    title={t('Group Deals','গ্রুপ ডিল')} description={t('The more neighbours join, the better the price.','যত বেশি প্রতিবেশী, তত ভালো দাম।')}
    href="/group-deals" viewText={t('View all','সব দেখুন')}/>
   {deals.length?<div className="mhome-deal-list">{deals.map(d=>{
    const price=money(d.confirmed_price??d.upcoming_price)
    const saved=d.reference_price&&d.confirmed_price&&d.reference_price>d.confirmed_price
     ?d.reference_price-d.confirmed_price:null
    const percent=d.next_threshold?Math.min(100,Math.round(d.buyer_count/d.next_threshold*100)):null
    const path=d.is_demo?'/demo-product/'+d.product_id:'/shop/'+d.product_id+'?area='+d.community_id
    const confirmed=d.price_status==='unlocked'||d.price_status==='final'
    return <article className="mhome-deal-card" key={d.offer_id+'-'+d.product_id}>
     <Link href={path} className="mhome-deal-visual" aria-label={t('View ','দেখুন: ')+d.product_name}>
      <ProductImage url={d.image_url} title={t(d.product_name,d.product_name_bn??d.product_name)}/>
      <span className="mhome-card-pill">{d.is_demo?'DEMO':t('GROUP DEAL','গ্রুপ ডিল')}</span>
     </Link>
     <div className="mhome-deal-copy">
      <span className="mhome-overline">{t('BUY TOGETHER · SAVE MORE','একসাথে কিনি · সাশ্রয় করি')}</span>
      <h3>{t(d.product_name,d.product_name_bn??d.product_name)}</h3>
      <p className="mhome-muted">{d.package_size} · {areas.find(a=>a.community_id===d.community_id)?.community_name??''}</p>
      <div className="mhome-deal-prices">
       <strong>{price??t('Price pending','দাম আসছে')}</strong>
       {saved!=null&&confirmed&&!d.is_demo&&<s>{money(d.reference_price)}</s>}
      </div>
      {saved!=null&&confirmed&&!d.is_demo&&<span className="mhome-save">Save {money(saved)}</span>}
      {!confirmed&&<span className="mhome-save">{t('Price unlock pending','দাম আনলকের অপেক্ষায়')}</span>}
      <div className="mhome-progress-caption"><span>👥 {d.buyer_count}{d.next_threshold?'/'+d.next_threshold:''} {t('joined','যোগ দিয়েছেন')}</span>
       {d.closes_at&&<span>◷ {t('Ends','শেষ')} {new Date(d.closes_at).toLocaleDateString(language==='bn'?'bn-BD':'en-BD',{month:'short',day:'numeric'})}</span>}</div>
      {percent!==null&&<div className="mhome-progress" role="progressbar"
        aria-label={t('Group participation','গ্রুপ অংশগ্রহণ')} aria-valuenow={Math.min(d.buyer_count,d.next_threshold!)}
        aria-valuemin={0} aria-valuemax={d.next_threshold!}><span style={{width:percent+'%'}}/></div>}
      <div className="mhome-deal-actions"><Link href={path}>{t('View details','বিস্তারিত')}</Link>
       <Link href={d.is_demo?path:d.commerce_group_id?'/group-deals':path}>{d.is_demo?t('Preview deal','ডেমো দেখুন'):d.commerce_group_id?t('Join Group Deal','গ্রুপ ডিলে যোগ দিন'):t('View Group Deal','গ্রুপ ডিল দেখুন')} <span aria-hidden="true">→</span></Link>
      </div>
     </div>
    </article>})}</div>:
    <div className="mhome-empty">{t(query?'No Group Deals match your search.':'No active Group Deals in this area yet.',
      query?'এই খোঁজে গ্রুপ ডিল নেই।':'এই এলাকায় এখনো সক্রিয় গ্রুপ ডিল নেই।')}</div>}
  </section>

  <section className="mhome-section" id="mobile-exclusive">
   <SectionHeading number="03" eyebrow={t('Curated for you','আপনার জন্য নির্বাচিত')}
    title={t('Exclusive Products','এক্সক্লুসিভ পণ্য')} description={t('Handpicked essentials, great everyday value.','প্রতিদিনের প্রয়োজনীয় পণ্য, ভালো দাম।')}
    href="/products" viewText={t('View all','সব দেখুন')}/>
   {exclusive.length?<div className="mhome-exclusive-grid">{exclusive.slice(0,6).map(p=>{
    const href=p.href??(p.demo?'/demo-product/'+p.id:'/products/'+p.id)
    const canCart=!p.demo&&Boolean(p.commerceId&&p.available&&selectedArea)
    const saving=p.oldPrice&&p.price&&p.oldPrice>p.price&&!p.demo&&p.available?p.oldPrice-p.price:null
    return <article className="mhome-exclusive-card" key={p.id}>
     <Link href={href} className="mhome-exclusive-image" aria-label={t('View ','দেখুন: ')+t(p.name,p.nameBn)}>
      <ProductImage url={p.image} title={t(p.name,p.nameBn)}/></Link>
     <div className="mhome-exclusive-copy"><h3><Link href={href}>{t(p.name,p.nameBn)}</Link></h3>
      <p className="mhome-muted">{p.package}</p>
      <div className="mhome-exclusive-price"><strong>{money(p.price)??t('Ask for price','দাম জানতে চান')}</strong>
       {saving!=null&&<s>{money(p.oldPrice)}</s>}</div>
      {saving!=null&&<span className="mhome-save">{t('Save','সাশ্রয়')} {money(saving)}</span>}
      {p.demo&&<span className="mhome-mini-demo">DEMO</span>}
      {canCart?<form action={setCommerceCartItem}>
       <input type="hidden" name="offer_id" value={p.commerceId!}/>
       <input type="hidden" name="quantity" value="1"/>
       <button className="mhome-cart-btn" type="submit">🛒 {t('Add to cart','কার্টে যোগ')}</button></form>:
       <Link className="mhome-cart-btn" href={p.bookable&&selectedArea?'/pilot-book?product='+p.id:href}>
        {p.demo?t('Preview product','পণ্য দেখুন'):p.bookable&&selectedArea?t('Book Product','পণ্য বুক করুন'):p.price?t('View Details','বিস্তারিত দেখুন'):t('View Details / Ask for Price','বিস্তারিত / দাম জানতে')} <span aria-hidden="true">→</span></Link>}
     </div>
    </article>})}</div>:
    <div className="mhome-empty">{t('Products will appear as soon as they are published.','পণ্য প্রকাশিত হলে এখানে দেখা যাবে।')}</div>}
  </section>

  <section className="mhome-section mhome-pools" id="mobile-pools">
   <SectionHeading number="04" eyebrow={t('Buy in a pool','পুলে কিনুন')}
    title={t('Community Pools','কমিউনিটি পুল')}
    description={t('Join a weekly, monthly or special community pool.','সাপ্তাহিক, মাসিক বা বিশেষ পুলে অংশ নিন।')}
    href="/pool" viewText={t('View all','সব দেখুন')}/>
   {poolRows.length?<div className="mhome-pool-list">{poolRows.map(p=>{
    const target=Math.max(1,p.minHouseholds)
    const progress=Math.round(Math.min(1,p.sampleHouseholds/target)*100)
    return <article className="mhome-pool-card" key={p.id??p.slug}>
     <div className="mhome-pool-photos">
      {(p.featuredProductIds.slice(0,3).map(id=>p.bundle.find(b=>b.offer.product_id===id)?.offer).filter(Boolean) as StorefrontOffer[]).map(o=>
       <Link key={o.product_id} href={p.isDemo?'/demo-product/'+o.product_id:'/shop/'+o.product_id+'?area='+(p.community_id??selectedArea)}>
        <ProductImage url={o.image_url} title={o.product_name}/></Link>)}
      {!p.featuredProductIds.length&&<ProductImage url={p.image} title={t(p.title.en,p.title.bn)}/>}
     </div>
     <div className="mhome-pool-copy"><div className="mhome-pool-top"><span>{p.slug.toUpperCase()} POOL</span>
      <span>{p.isDemo?'DEMO':t('ACTIVE','সক্রিয়')}</span></div>
      <h3>{t(p.title.en,p.title.bn)}</h3>
      <p className="mhome-muted">{p.bundle.length} {t('products','পণ্য')}</p>
      <p className="mhome-pool-joined">{p.sampleHouseholds.toLocaleString('en-BD')} {t('households joined','পরিবার যোগ দিয়েছে')}</p>
      <div className="mhome-progress" role="progressbar" aria-label={t('Household progress','অংশগ্রহণের অগ্রগতি')}
       aria-valuenow={Math.min(p.sampleHouseholds,target)} aria-valuemin={0} aria-valuemax={target}>
       <span style={{width:progress+'%'}}/></div>
      <Link className="mhome-pool-link" href={p.isDemo?'/demo-pool/'+p.slug:'/pool#pool-'+p.id}>{t('Explore Pool','পুল দেখুন')} <span aria-hidden="true">→</span></Link>
     </div>
    </article>})}</div>:
    <div className="mhome-empty">{t('No community Pools are published yet.','এখনো কোনো কমিউনিটি পুল প্রকাশিত হয়নি।')}</div>}
  </section>
 </div>
}
