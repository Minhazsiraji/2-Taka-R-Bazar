'use client'

import Link from 'next/link'
import {PreviewHomeCards} from '@/components/home-card-preview'
import {LivePreviewHomeCards} from '@/components/live-preview-home-cards'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'
import {useEffect,useRef,useState} from 'react'
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
 vendorProducts?:PublicVendorBookingProduct[]
 products:ShowcaseProduct[]
 publishedProducts:PublishedCatalogPage
 pools:DemoFeaturedPool[]
 language:MarketplaceLanguage
 demoMode:boolean
 previewCards?:boolean
 search:string
 savings:HomeSavingsSummary
}
const heroSlides=[
 {en:'Smart people make smart decisions.',bn:'বুদ্ধিমান মানুষ সিদ্ধান্ত নেয় বুঝে।',
  secondEn:'Buy together, save together.',secondBn:'একসাথে কিনুন, একসাথে সাশ্রয় করুন।',
  sub:'Invite neighbours and friends. Join a Pool to unlock wholesale prices.',
  subBn:'প্রতিবেশী ও বন্ধুদের আমন্ত্রণ জানান। একসঙ্গে পুলে যোগ দিন।',
  action:'Explore group deals',actionBn:'গ্রুপ ডিল দেখুন',href:'#mobile-deals'},
 {en:'A smarter way to shop.',bn:'বাজার করার আরও স্মার্ট উপায়।',
  secondEn:'A better way to save.',secondBn:'সাশ্রয়ের আরও ভালো সুযোগ।',
  sub:'Compare prices and unlock better community deals.',
  subBn:'দাম তুলনা করুন, আর কমিউনিটির সাথে ভালো দামের সুযোগ আনলক করুন।',
  action:'Browse products',actionBn:'পণ্য দেখুন',href:'#mobile-exclusive'},
 {en:'Your neighbours. Your Pool.',bn:'আপনার প্রতিবেশী। আপনার পুল।',
  secondEn:'Your savings.',secondBn:'সাশ্রয়ের সুযোগও আপনার।',
  sub:'Bring families together and combine everyday demand.',
  subBn:'পরিবারগুলোকে এক করুন, নিত্যপণ্যের চাহিদা একসাথে আনুন।',
  action:'View community Pools',actionBn:'কমিউনিটি পুল দেখুন',href:'#mobile-pools'},
 {en:'Buying together makes',bn:'একসাথে কিনলে',
  secondEn:'every taka count.',secondBn:'প্রতিটি টাকার মূল্য বাড়ে।',
  sub:'More households can mean better prices.',
  subBn:'আরও পরিবার যুক্ত হলে দাম আরও কমতে পারে।',
  action:'Explore products',actionBn:'পণ্য দেখুন',href:'#mobile-exclusive'},
] as const

function ProductImage({url,title}:{url:string|null|undefined;title:string}){
 const [failed,setFailed]=useState(false)
 return url&&!failed?<img src={url} loading="lazy" alt={title} onError={()=>setFailed(true)}/>:
  <span className="mhome-image-empty" aria-label={title}>2TBR<span>Photo coming soon</span></span>
}
function SectionHeading({title,description,href,viewText,savings=false}:{
 title:string;description:string;href:string;viewText:string;savings?:boolean
}){
 return <div className={savings?'mhome-savings-heading':'mhome-section-heading'}>
  <div><h2>{title}</h2>{description&&<p className="mhome-muted">{description}</p>}</div>
  <Link className="mhome-view-all" href={href}>{viewText} <span aria-hidden="true">›</span></Link>
 </div>
}
const money=(n:number|null|undefined)=>n!=null&&Number(n)>0?formatPrice(n):null

export function MobileMarketplaceHome({areas,selectedArea,onChooseArea,onDetectArea,detectingArea,
 offers,products,publishedProducts,vendorProducts=[],pools,language,demoMode,previewCards=false,search,savings}:Props){
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 // Data-only switch. The locked homepage markup and CSS are unchanged:
 // use demo fixtures until genuinely published public records exist.
 const livePreviewData={offers,pools,products,catalog:publishedProducts.items,vendorProducts}
 const hasLivePreview=previewCards
 const [slide,setSlide]=useState(0)
 const areaPickerRef=useRef<HTMLDetailsElement>(null)
 const [clockNow,setClockNow]=useState<number|null>(null)
 const endsLabel=(iso:string)=>{
  const end=new Date(iso).getTime()
  if(!Number.isFinite(end))return t('End time unavailable','শেষ সময় পাওয়া যায়নি')
  if(clockNow===null)return t('Ends','শেষ')+' '+new Date(iso).toLocaleDateString(language==='bn'?'bn-BD':'en-BD',{month:'short',day:'numeric'})
  const remaining=end-clockNow
  if(remaining<=0)return t('Ended','শেষ হয়েছে')
  const hours=Math.ceil(remaining/3600000)
  if(hours<24)return t('Ends in','শেষ হতে')+' '+hours+' '+t(hours===1?'hour':'hours','ঘণ্টা')
  const days=Math.ceil(remaining/86400000)
  return t('Ends in','শেষ হতে')+' '+days+' '+t(days===1?'day':'days','দিন')
 }
 useEffect(()=>{
  if(typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const timer=window.setInterval(()=>setSlide(i=>(i+1)%heroSlides.length),7200)
  return()=>window.clearInterval(timer)
 },[])
 useEffect(()=>{
  setClockNow(Date.now())
  const timer=window.setInterval(()=>setClockNow(Date.now()),60000)
  return()=>window.clearInterval(timer)
 },[])
 const query=search.trim().toLocaleLowerCase()
 const localOffers=offers.filter(o=>(!selectedArea||o.community_id===selectedArea)&&(
  !query||[o.product_name,o.product_name_bn,o.brand,o.category,o.offer_title].some(v=>(v??'').toLocaleLowerCase().includes(query))))
 const deals=localOffers.filter(o=>o.offer_kind==='GROUP_DEAL').slice(0,6)
 const poolRows=pools.filter(p=>!selectedArea||!p.community_id||p.community_id===selectedArea).slice(0,3)
 // Show genuine checkout-ready SOLO offers first. SEO/showcase entries are read-only
 // fallbacks, never a source of made-up price, savings or inventory.
 type HomeProduct={
  id:string;name:string;nameBn:string;package:string;image:string|null;
  price:number|null;oldPrice:number|null;stock:number|null;
  demo:boolean;commerceId:string|null;available:boolean;bookable:boolean;href?:string
 }
 const exclusive:HomeProduct[]=[]
 const unique=new Set<string>()
 const featuredById=new Map(products.map(p=>[p.product_id,p]))
 const publishedById=new Map(publishedProducts.items.map(p=>[p.product_id,p]))
 const eligibleSolo=localOffers.filter(o=>o.offer_kind==='SOLO')
  .sort((a,b)=>{
   const score=(o:StorefrontOffer)=>{
    const price=Number(o.solo_price??o.confirmed_price??0)
    if(!Number.isFinite(price)||price<=0)return 3
    if(o.commerce_solo_id&&o.commerce_solo_available&&!o.is_demo)return 0
    if(!o.is_demo)return 1
    return 2
   }
   return score(a)-score(b)
  })
 for(const o of eligibleSolo){
  if(unique.has(o.product_id))continue
  const feature=featuredById.get(o.product_id)
  const published=publishedById.get(o.product_id)
  const price=Number(o.solo_price??o.confirmed_price??0)
  const validPrice=Number.isFinite(price)&&price>0?price:null
  const old=Number(o.reference_price)
  const verifiedStock=typeof o.commerce_available_quantity==='number'&&
   Number.isSafeInteger(o.commerce_available_quantity)&&o.commerce_available_quantity>=0
   ?o.commerce_available_quantity:null
  exclusive.push({
   id:o.product_id,name:feature?.name??published?.title_en??o.product_name,
   nameBn:feature?.name_bn??published?.title_bn??o.product_name_bn??o.product_name,
   package:feature?.package_size??published?.package_size??o.package_size,
   image:feature?.image_url??feature?.gallery_urls?.[0]??published?.image_url??o.image_url,
   price:validPrice,oldPrice:validPrice&&Number.isFinite(old)&&old>validPrice?old:null,
   stock:verifiedStock,
   demo:Boolean(o.is_demo||feature?.is_demo||o.commerce_synthetic),
   commerceId:o.commerce_solo_id??null,available:Boolean(o.commerce_solo_available),
   bookable:Boolean(validPrice&&!o.commerce_solo_id&&!o.is_demo&&!o.commerce_synthetic),
   href:published?(language==='bn'?'/bn':'')+'/p/'+published.slug:undefined
  })
  unique.add(o.product_id)
 }
 const eligible=products.filter(p=>!query||[p.name,p.name_bn,p.brand].some(v=>(v??'').toLocaleLowerCase().includes(query)))
 for(const p of eligible){
  if(unique.has(p.product_id))continue
  if(selectedArea&&offers.some(o=>o.product_id===p.product_id))continue
  exclusive.push({id:p.product_id,name:p.name,nameBn:p.name_bn??p.name,
   package:p.package_size,image:p.image_url??p.gallery_urls?.[0]??null,
   price:null,oldPrice:null,stock:null,demo:Boolean(p.is_demo),
   commerceId:null,available:false,bookable:false})
  unique.add(p.product_id)
 }
 for(const item of publishedProducts.items){
  if(unique.has(item.product_id))continue
  if(query&&![item.title_en,item.title_bn,item.category].some(v=>v.toLocaleLowerCase().includes(query)))continue
  if(selectedArea&&offers.some(o=>o.product_id===item.product_id))continue
  exclusive.push({id:item.product_id,name:item.title_en,nameBn:item.title_bn,
   package:item.package_size,image:item.image_url,price:null,oldPrice:null,stock:null,
   demo:false,commerceId:null,available:false,bookable:false,
   href:(language==='bn'?'/bn':'')+'/p/'+item.slug})
  unique.add(item.product_id)
 }
 // A partially populated catalog must not drown out shoppable cards.
 // When no priced SOLO offer is published, show a truthful browse-only fallback.
 const pricedExclusive=exclusive.filter(p=>p.price!==null&&!p.demo)
 const visibleExclusive=(pricedExclusive.length?pricedExclusive:exclusive).slice(0,6)
 const activeSlide=heroSlides[slide]
 return <div className="mhome" lang={language} aria-label={t('2TBR marketplace homepage','২টিবিআর বাজার হোম')}>
  <div className="mhome-area-strip" id="your-community">
   <button className="mhome-geo-button" type="button" onClick={onDetectArea} disabled={detectingArea}
    aria-label={t('Detect nearby community','কাছের কমিউনিটি খুঁজুন')} title={t('Detect location','লোকেশন খুঁজুন')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
   </button>
   <label htmlFor="mhome-community">{t('Your community','আপনার এলাকা')}</label>
   {demoMode&&<span className="mhome-demo-pill">DEMO DATA</span>}
   <select id="mhome-community" className="mhome-native-area" value={selectedArea} onChange={e=>onChooseArea(e.target.value)}
    aria-label={t('Choose your community','আপনার এলাকা বাছুন')}>
    <option value="">{t('All areas','সব এলাকা')}</option>
    {areas.map(a=><option key={a.community_id} value={a.community_id}>{a.community_name}</option>)}
   </select>
   <details className="mhome-area-picker" ref={areaPickerRef} onKeyDown={e=>{if(e.key==='Escape')areaPickerRef.current?.removeAttribute('open')}}>
    <summary aria-label={t('Choose your community','আপনার এলাকা বাছুন')}>
     <span>{areas.find(a=>a.community_id===selectedArea)?.community_name??t('All areas','সব এলাকা')}</span>
     <span aria-hidden="true">⌄</span>
    </summary>
    <div className="mhome-area-menu" role="group" aria-label={t('Available communities','কমিউনিটির তালিকা')}>
     <button type="button" aria-current={!selectedArea?'true':undefined}
      onClick={()=>{onChooseArea('');areaPickerRef.current?.removeAttribute('open')}}>{t('All areas','সব এলাকা')}</button>
     {areas.map(a=><button key={a.community_id} type="button"
      aria-current={selectedArea===a.community_id?'true':undefined}
      onClick={()=>{onChooseArea(a.community_id);areaPickerRef.current?.removeAttribute('open')}}>{a.community_name}</button>)}
    </div>
   </details>
  </div>
  <section className="mhome-hero" aria-label={t('Featured shopping messages','ফিচারড বার্তা')} role="region" aria-roledescription="carousel">
   <div className="mhome-hero-copy" aria-live="off">
    <span className="mhome-hero-kicker">✦ SMART SHOPPING. REAL SAVINGS!</span>
    <h1 key={slide}>{t(activeSlide.en,activeSlide.bn)}</h1>
    <strong className="mhome-hero-second">{t(activeSlide.secondEn,activeSlide.secondBn)}</strong>
    <p>{t(activeSlide.sub,activeSlide.subBn)}</p>
    <a href={activeSlide.href}>{t(activeSlide.action,activeSlide.actionBn)} <span aria-hidden="true">→</span></a>
    <div className="mhome-hero-controls" aria-label={t('Banner controls','ব্যানার নিয়ন্ত্রণ')}>
     <button className="mhome-hero-arrow mhome-prev" type="button" aria-label={t('Previous banner','আগের ব্যানার')}
      onClick={()=>setSlide(i=>(i+heroSlides.length-1)%heroSlides.length)}>‹</button>
     <div className="mhome-dots" aria-label={t('Choose banner','ব্যানার বাছুন')}>
      {heroSlides.map((_,i)=><button key={i} type="button" aria-current={i===slide?'true':undefined}
       aria-label={t('Banner ','ব্যানার ')+(i+1)} onClick={()=>setSlide(i)}/>)}
     </div>
     <button className="mhome-hero-arrow mhome-next" type="button" aria-label={t('Next banner','পরের ব্যানার')}
      onClick={()=>setSlide(i=>(i+1)%heroSlides.length)}>›</button>
    </div>
   </div>
  </section>

  <section className="mhome-section mhome-savings" id="mobile-savings" aria-label={t('Your Savings Summary','আপনার সাশ্রয়ের হিসাব')}>
   <div className="mhome-savings-panel">
   <SectionHeading savings title={t('Your savings','আপনার সাশ্রয়')} description=""
    href="/account/savings" viewText={t('View details','বিস্তারিত দেখুন')}/>
   <div className="mhome-savings-grid">
    {([
     ['month',t('This Month','এই মাস'),savings.verified?savings.thisMonth:null],
     ['previous',t('Prev. Month','গত মাস'),savings.verified?savings.previousMonth:null],
     ['lifetime',t('Lifetime','মোট সাশ্রয়'),savings.verified?savings.lifetime:null],
     ['community',t('Community','কমিউনিটি'),savings.community],
    ] as const).map(([kind,label,value])=><article className={'mhome-savings-card is-'+kind} key={kind}>
     <span className="mhome-savings-icon" aria-hidden="true">{kind==='month'?'▥':kind==='previous'?'◷':kind==='lifetime'?'★':'♧'}</span>
     <span className="mhome-savings-label">{label}</span>
     <strong className="mhome-savings-value" title={value===null?t('Not yet available','তথ্য পাওয়া যায়নি'):undefined}>{value===null?'—':'৳'+value.toLocaleString('en-BD',{maximumFractionDigits:2})}</strong>
     {value===null&&<span className="mhome-savings-unavailable">{t('Unavailable','তথ্য নেই')}</span>}
    </article>)}
   </div>
   {!savings.verified&&<p className="mhome-savings-note" role="status">
    {t('Verified savings will appear when eligible completed orders are available. No sample balances are shown.',
     'যোগ্য সম্পন্ন অর্ডার পাওয়া গেলে যাচাইকৃত সাশ্রয় দেখানো হবে। এখানে কোনো নমুনা ব্যালেন্স নেই।')}
   </p>}
   </div>
  </section>

  <section className="mhome-section" id="mobile-deals">
   <SectionHeading 
    title={t('Group Deals','গ্রুপ ডিল')} description={t('The more neighbours join, the better the price.','যত বেশি প্রতিবেশী, তত ভালো দাম।')}
    href="/group-deals" viewText={t('View all','সব দেখুন')}/>
   {previewCards?(hasLivePreview?<LivePreviewHomeCards section="deals" language={language} search={search} selectedArea={selectedArea} data={livePreviewData}/>:<PreviewHomeCards section="deals" language={language} search={search}/>): deals.length?<div className="mhome-deal-list">{deals.map(d=>{
    const confirmed=d.commerce_group_id?d.commerce_group_phase==='ready':d.price_status==='unlocked'||d.price_status==='final'
    const price=confirmed?money(d.confirmed_price):null
    const ended=Boolean(clockNow&&d.closes_at&&new Date(d.closes_at).getTime()<=clockNow)
    const joinable=!d.is_demo&&!d.commerce_synthetic&&!ended&&(!d.commerce_group_id||['forming','ready'].includes(d.commerce_group_phase??''))
    const saved=d.reference_price&&d.confirmed_price&&d.reference_price>d.confirmed_price
     ?d.reference_price-d.confirmed_price:null
    const percent=d.next_threshold?Math.min(100,Math.round(d.buyer_count/d.next_threshold*100)):null
    const path=d.is_demo?'/demo-product/'+d.product_id:'/shop/'+d.product_id+'?area='+d.community_id
    return <article className="mhome-deal-card" key={d.offer_id+'-'+d.product_id}>
     <Link href={path} className="mhome-deal-visual" aria-label={t('View ','দেখুন: ')+d.product_name}>
      <ProductImage url={d.image_url} title={t(d.product_name,d.product_name_bn??d.product_name)}/>
      <span className="mhome-card-pill">{d.is_demo?'DEMO':t('GROUP DEAL','গ্রুপ ডিল')}</span>
     </Link>
     <div className="mhome-deal-copy">
      <span className="mhome-overline">{d.is_demo?t('Demo preview','ডেমো প্রিভিউ'):ended?t('Ended','শেষ হয়েছে'):confirmed?t('Price unlocked','দাম আনলক হয়েছে'):t('Pending unlock','আনলকের অপেক্ষায়')}</span>
      <h3>{t(d.product_name,d.product_name_bn??d.product_name)}</h3>
      <p className="mhome-muted">{d.package_size} · {areas.find(a=>a.community_id===d.community_id)?.community_name??''}</p>
      <div className={'mhome-deal-prices'+(!price?' is-price-pending':'')}>
       <strong>{price??t('Price pending','দাম আসছে')}</strong>
       {saved!=null&&confirmed&&!d.is_demo&&!d.commerce_synthetic&&<s>{money(d.reference_price)}</s>}
      </div>
      {saved!=null&&confirmed&&!d.is_demo&&!d.commerce_synthetic&&<span className="mhome-save">{t('Save','সাশ্রয়')} {money(saved)}</span>}
      {!confirmed&&<span className="mhome-save">{t('Price unlock pending','দাম আনলকের অপেক্ষায়')}</span>}
      <div className="mhome-progress-caption"><span className="mhome-joined-stat"><span className="mhome-color-people" aria-hidden="true">👥</span> {d.buyer_count}{d.next_threshold?'/'+d.next_threshold:''} {t('joined','যোগ দিয়েছেন')}</span>
       {d.closes_at&&<span className="mhome-time-stat"><span className="mhome-clock-icon" aria-hidden="true">◷</span> {endsLabel(d.closes_at)}</span>}</div>
      {percent!==null&&<div className="mhome-progress" role="progressbar"
        aria-label={t('Group participation','গ্রুপ অংশগ্রহণ')} aria-valuenow={Math.min(d.buyer_count,d.next_threshold!)}
        aria-valuemin={0} aria-valuemax={d.next_threshold!}><span style={{width:percent+'%'}}/></div>}
      <div className="mhome-deal-actions"><Link href={path}>{t('View details','বিস্তারিত')}</Link>
       {joinable?<Link className="mhome-join-deal" href="/group-deals">{t('Join Deal','ডিলে যোগ দিন')} <span aria-hidden="true">→</span></Link>:
        <span className="mhome-action-unavailable" aria-disabled="true">{d.is_demo?t('Preview only','শুধু প্রিভিউ'):ended?t('Deal ended','ডিল শেষ'):t('Joining unavailable','যোগদান চালু হয়নি')}</span>}
      </div>
     </div>
    </article>})}</div>:
    <div className="mhome-empty">{t(query?'No Group Deals match your search.':'No active Group Deals in this area yet.',
      query?'এই খোঁজে গ্রুপ ডিল নেই।':'এই এলাকায় এখনো সক্রিয় গ্রুপ ডিল নেই।')}</div>}
  </section>

  <section className="mhome-section" id="mobile-exclusive">
   <SectionHeading 
    title={t('Exclusive Products','এক্সক্লুসিভ পণ্য')} description={t('Handpicked essentials, great everyday value.','প্রতিদিনের প্রয়োজনীয় পণ্য, ভালো দাম।')}
    href="/products" viewText={t('View all','সব দেখুন')}/>
   {previewCards?(hasLivePreview?<LivePreviewHomeCards section="exclusive" language={language} search={search} selectedArea={selectedArea} data={livePreviewData}/>:<PreviewHomeCards section="exclusive" language={language} search={search}/>): visibleExclusive.length?<div className="mhome-exclusive-grid">{visibleExclusive.map(p=>{
    const href=p.href??(p.demo?'/demo-product/'+p.id:'/products/'+p.id)
    const canCart=!p.demo&&p.stock!==0&&Boolean(p.commerceId&&p.available&&selectedArea&&p.price)
    const saving=p.oldPrice&&p.price&&p.oldPrice>p.price&&!p.demo?p.oldPrice-p.price:null
    return <article className="mhome-exclusive-card" key={p.id}>
     <Link href={href} className="mhome-exclusive-image" aria-label={t('View ','দেখুন: ')+t(p.name,p.nameBn)}>
      <ProductImage url={p.image} title={t(p.name,p.nameBn)}/></Link>
     <div className="mhome-exclusive-copy"><h3><Link href={href}>{t(p.name,p.nameBn)}</Link></h3>
      <p className="mhome-muted">{p.package}</p>
      <div className={'mhome-exclusive-price'+(p.price===null?' is-price-unpublished':'')}><strong>{money(p.price)??t('Price not published','দাম প্রকাশিত হয়নি')}</strong>
       {saving!=null&&<s>{money(p.oldPrice)}</s>}</div>
      {saving!=null&&<span className="mhome-save">{t('Save','সাশ্রয়')} {money(saving)}</span>}
      {p.demo?<span className="mhome-exclusive-availability">{t('DEMO · Not for sale','ডেমো · বিক্রির জন্য নয়')}</span>:
       p.stock!==null?<span className="mhome-exclusive-availability">{p.stock>0?t('In stock','স্টকে আছে'):t('Out of stock','স্টক শেষ')} · {p.stock.toLocaleString('en-BD')} {t('available','পিস উপলব্ধ')}</span>:
       p.price?<span className="mhome-exclusive-availability">{t('Stock confirmed at checkout','চেকআউটে স্টক নিশ্চিত হবে')}</span>:
       <span className="mhome-exclusive-availability">{t('View product information','পণ্যের তথ্য দেখুন')}</span>}
     </div>
     <div className="mhome-exclusive-actions">
      <Link className="mhome-details-btn" href={href}>{t('View details','বিস্তারিত দেখুন')}</Link>
      {canCart?<form action={setCommerceCartItem}>
       <input type="hidden" name="offer_id" value={p.commerceId!}/>
       <input type="hidden" name="quantity" value="1"/>
       <button className="mhome-cart-btn" type="submit">🛒 {t('Add to cart','কার্টে যোগ')}</button></form>:
       <button className="mhome-cart-btn" type="button" disabled aria-disabled="true">
        {p.stock===0?t('Out of stock','স্টক শেষ'):t('Add to cart','কার্টে যোগ')}</button>}
      {p.bookable&&selectedArea&&<Link className="mhome-book-link" href={'/pilot-book?product='+p.id}>{t('Book Product','পণ্য বুক করুন')} →</Link>}
      {p.price&&p.commerceId&&!selectedArea&&<a className="mhome-book-link" href="#your-community">{t('Select community to buy','কিনতে কমিউনিটি বাছুন')} →</a>}

     </div>
    </article>})}</div>:
    <div className="mhome-empty">{query
      ?t('No products match your search.','আপনার খোঁজের সঙ্গে কোনো পণ্য মেলেনি।')
      :t('Products will appear as soon as they are published.','পণ্য প্রকাশিত হলে এখানে দেখা যাবে।')}</div>}
  </section>

  <section className="mhome-section mhome-pools" id="mobile-pools">
   <SectionHeading 
    title={t('Community Pools','কমিউনিটি পুল')}
    description={t('Join a weekly, monthly or special community pool.','সাপ্তাহিক, মাসিক বা বিশেষ পুলে অংশ নিন।')}
    href="/pool" viewText={t('View all','সব দেখুন')}/>
   {previewCards?(hasLivePreview?<LivePreviewHomeCards section="pools" language={language} search={search} selectedArea={selectedArea} data={livePreviewData}/>:<PreviewHomeCards section="pools" language={language} search={search}/>): poolRows.length?<div className="mhome-pool-list">{poolRows.map(p=>{
    const target=Number.isSafeInteger(p.minHouseholds)&&p.minHouseholds>0?p.minHouseholds:null
    const progress=target?Math.round(Math.min(1,p.sampleHouseholds/target)*100):null
    const nextTier=p.livePricing?.householdsNeeded&&p.livePricing.householdsNeeded>0
     ?p.sampleHouseholds+p.livePricing.householdsNeeded:null
    const chosen=(p.featuredProductIds.slice(0,3).map(id=>p.bundle.find(b=>b.offer.product_id===id)?.offer).filter(Boolean) as StorefrontOffer[])
    const photoOffers=chosen.length?chosen:p.bundle.slice(0,3).map(b=>b.offer)
    const deadlines=p.bundle.map(b=>b.offer.closes_at)
    const closesAt=deadlines.length>0&&deadlines.every(d=>d!==null&&d===deadlines[0])?deadlines[0]:null
    const expired=Boolean(clockNow&&closesAt&&new Date(closesAt).getTime()<=clockNow)
    const pending=p.bundle.some(b=>!['unlocked','final'].includes(b.offer.price_status))
    const tierSaving=!p.isDemo&&p.livePricing?.currentPrice!=null&&p.livePricing.nextPrice!=null&&p.livePricing.currentPrice>p.livePricing.nextPrice
     ?p.livePricing.currentPrice-p.livePricing.nextPrice:null
    return <article className="mhome-pool-card" key={p.id??p.slug}>
     <div className="mhome-pool-photos">
      {photoOffers.map(o=>
       <Link key={o.product_id} href={p.isDemo?'/demo-product/'+o.product_id:'/shop/'+o.product_id+'?area='+(p.community_id??selectedArea)}>
        <ProductImage url={o.image_url} title={o.product_name}/></Link>)}
      {!photoOffers.length&&<ProductImage url={p.image} title={t(p.title.en,p.title.bn)}/>}
     </div>
     <div className="mhome-pool-copy"><div className="mhome-pool-top"><span className="mhome-pool-kind">{t(p.slug.toUpperCase()+' POOL',p.slug==='weekly'?'সাপ্তাহিক পুল':p.slug==='monthly'?'মাসিক পুল':'বিশেষ পুল')}</span>
      <span className="mhome-pool-status">{p.isDemo?'DEMO':expired?t('Ended','শেষ হয়েছে'):pending?t('Pending','অপেক্ষমাণ'):t('● ACTIVE','● সক্রিয়')}</span></div>
      <h3>{t(p.title.en,p.title.bn)}</h3>
      <p className="mhome-muted mhome-pool-description">{p.bundle.length} {t('products','পণ্য')} · {areas.find(a=>a.community_id===p.community_id)?.community_name??t(p.subtitle.en,p.subtitle.bn)}</p>
      <p className="mhome-pool-joined"><span aria-hidden="true">👥</span> {p.sampleHouseholds.toLocaleString('en-BD')} {t('households joined','পরিবার যোগ দিয়েছে')}</p>
      <div className="mhome-pool-meta"><span>{target?t('Minimum','ন্যূনতম')+': '+target.toLocaleString('en-BD'):t('Target not published','লক্ষ্য প্রকাশিত হয়নি')}</span>
       {nextTier&&<span>{t('Next tier','পরবর্তী ধাপ')}: {nextTier.toLocaleString('en-BD')}</span>}
       {tierSaving!=null&&<span className="mhome-save">{t('Next saving','পরবর্তী সাশ্রয়')}: {money(tierSaving)}</span>}
       {closesAt?<span className="mhome-time-stat"><span aria-hidden="true">◷</span> {endsLabel(closesAt)}</span>:
        <span className="mhome-time-unset">{t('Schedule pending','সময়সূচি আসছে')}</span>}</div>
      <div className="mhome-pool-bottom">
       {target!==null&&<div className="mhome-progress" role="progressbar" aria-label={t('Household progress','অংশগ্রহণের অগ্রগতি')}
        aria-valuenow={Math.min(p.sampleHouseholds,target)} aria-valuemin={0} aria-valuemax={target}>
        <span style={{width:progress+'%'}}/></div>}
       <Link className="mhome-pool-link" href={p.isDemo?'/demo-pool/'+p.slug:'/pool#pool-'+p.id}>{t('Explore Pool','পুল দেখুন')} <span aria-hidden="true">→</span></Link>
      </div>
     </div>
    </article>})}</div>:
    <div className="mhome-empty">{t('No community Pools are published yet.','এখনো কোনো কমিউনিটি পুল প্রকাশিত হয়নি।')}</div>}
  </section>
 </div>
}
