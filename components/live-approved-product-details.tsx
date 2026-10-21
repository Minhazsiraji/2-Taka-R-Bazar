'use client'

import {useState} from 'react'
import Link from 'next/link'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {confirmedOfferPrice,priceText,safeTime,type PublicLiveProduct,type PublicLiveOffer} from '@/lib/approved-live-detail-data'
import './home-preview-native-details.css'

const missing=(bn:boolean)=>bn?'এখনো দেওয়া হয়নি':'Not provided yet'
const money=(v:number|null,bn:boolean)=>priceText(v,bn)
export function LiveApprovedProductDetails({product,kind,selectedOfferId,from,poolId,initialLanguage,hasLanguageCookie}:{
 product:PublicLiveProduct;kind:'deal'|'exclusive'|'retail';selectedOfferId?:string;
 from?:string;poolId?:string;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean
}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const [choice,setChoice]=useState(selectedOfferId??'')
 const [message,setMessage]=useState('')
 const bn=language==='bn',t=(en:string,bnText:string)=>bn?bnText:en
 const fmt=(v:number)=>new Intl.NumberFormat(bn?'bn-BD':'en-US').format(v)
 const title=t(product.name,product.nameBn)
 const group=product.offers.find(o=>o.offer_id===selectedOfferId&&o.offer_kind==='GROUP_DEAL')
  ??product.offers.find(o=>o.offer_kind==='GROUP_DEAL')
 const solo=product.offers.find(o=>o.offer_kind==='SOLO')
 const available=product.offers.filter(o=>o.offer_kind==='SOLO'||o.offer_kind==='GROUP_DEAL'||o.offer_kind==='COMMUNITY_POOL')
 const selected=available.find(o=>o.offer_id===choice)??solo??available[0]
 const selectedPrice=selected?confirmedOfferPrice(selected):null
 const backToOffer='/preview-live/product/'+product.id+
  (from==='deal'?'?kind=deal'+(selectedOfferId?'&offer='+selectedOfferId:''):'')
 const back=kind==='retail'?(from==='pool'&&poolId?'/preview-live/pool/'+poolId:backToOffer):
  '/#mobile-'+(kind==='deal'?'deals':'exclusive')
 const retailHref='/preview-live/product/'+product.id+'?kind=retail&from='+(kind==='deal'?'deal':'exclusive')+
  (kind==='deal'&&group?'&offer='+group.offer_id:'')
 const groupPrice=group?confirmedOfferPrice(group):null
 const nextPrice=group&&group.next_threshold?group.upcoming_price:null
 const market=product.retail
 const saving=market!==null&&selectedPrice!==null&&market>selectedPrice?market-selectedPrice:null
 const photo=<div className={kind==='deal'?'native-preview-group-photo':kind==='retail'?'native-preview-retail-photo':'native-preview-exclusive-photo'}>
  {product.image?<img src={product.image} alt={product.alt||title} onError={e=>{e.currentTarget.src='/preview-app-product-placeholder.svg'}}/>:
   <img src="/preview-app-product-placeholder.svg" alt={title}/>}
 </div>
 const panel=(children:React.ReactNode,className='')=><section className={'native-preview-panel '+className}>{children}</section>
 const actionNotice=()=>setMessage(t('Preview only. No real cart, booking, commitment or payment is created.','শুধু প্রিভিউ। বাস্তব কার্ট, বুকিং, অর্ডার বা পেমেন্ট হয়নি।'))
 const summary=<div className="native-preview-info-sections">
  {[
   {key:'seo',title:t('Description & specifications (SEO)','বিবরণ ও বৈশিষ্ট্য (SEO)')},
   {key:'aeo',title:t('Questions & answers (AEO)','প্রশ্ন ও উত্তর (AEO)')},
   {key:'geo',title:t('Local availability (GEO)','এলাকাভিত্তিক প্রাপ্যতা (GEO)')}
  ].map(section=><details className="native-preview-disclosure" key={section.key}>
   <summary><strong>{section.title}</strong><span>{t('Admin-managed','অ্যাডমিন নিয়ন্ত্রিত')} <b>＋</b></span></summary>
   <div className="native-preview-disclosure-content">
    {section.key==='seo'?<>
     <p>{t(product.description,product.descriptionBn)||missing(bn)}</p>
     {Object.entries(product.seo?.specs??{}).filter(([,v])=>typeof v==='string'&&v.trim()).map(([k,v])=>
      <div key={k}><span>{k.replaceAll('_',' ')}</span><strong>{v}</strong></div>)}
     {!Object.keys(product.seo?.specs??{}).length&&<div><span>{t('Specifications','বৈশিষ্ট্য')}</span><strong>{missing(bn)}</strong></div>}
    </>:section.key==='aeo'?product.seo?.faqs?.length?product.seo.faqs.map((faq,i)=>
      <div key={i}><span>{t(faq.question_en,faq.question_bn)||missing(bn)}</span><strong>{t(faq.answer_en,faq.answer_bn)||missing(bn)}</strong></div>):<p>{missing(bn)}</p>:
      <p>{t('Local availability is verified from your published community offers. Confirm delivery and pickup before ordering.',
       'কমিউনিটির প্রকাশিত অফার থেকে প্রাপ্যতা যাচাই করুন। অর্ডারের আগে ডেলিভারি ও পিকআপ নিশ্চিত করুন।')}
       {available.length===0&&' · '+missing(bn)}</p>}
   </div>
  </details>)}
 </div>
 return <main className="public-marketplace-flat market-pool-detail-page native-preview-detail-page min-h-screen" lang={language}>
  <PublicHeader storefront shopBaseHref="/" browseHref={back} actionHref={back}
   actionLabel={t('Back','ফিরুন')} mobileActionLabel={t('Back','ফিরুন')}
   language={language} onLanguageChange={setLanguage}/>
  <div className="market-pool-detail-content native-preview-content">
   <Link href={back} className="native-preview-back">‹ &nbsp;{t('Back','ফিরুন')}</Link>
   {kind==='retail'?<div className="native-preview-retail">
    {photo}<div>
     <p className="native-preview-overline">{t('PRODUCT INFORMATION','পণ্যের তথ্য')}</p>
     <h1>{title}</h1><p className="native-preview-muted">{product.unit} · SKU {product.sku??missing(bn)}</p>
     {panel(<><h2>{t('Market retail reference price','বাজারের খুচরা রেফারেন্স মূল্য')}</h2>
      <div className="home-preview-product-price native-preview-large-price"><strong>{money(market,bn)}</strong></div>
      <p className="native-preview-muted">{t('Retail reference only. Group Deal and Pool prices are not shown here.','এখানে শুধু বাজারের রেফারেন্স দাম। গ্রুপ ডিল বা পুলের দাম নয়।')}</p></>)}
     {panel(<><h2>{t('Product information','পণ্যের তথ্য')}</h2>
      <dl className="native-preview-info-list">
       {[[t('Name','পণ্যের নাম'),title],[t('Product brand','পণ্যের ব্র্যান্ড'),product.seo?.brand_type==='UNBRANDED_LOOSE'?t('Unbranded','ব্র্যান্ডবিহীন'):product.brand??missing(bn)],
        [t('Package','প্যাকেটের পরিমাণ'),product.unit||missing(bn)],['SKU',product.sku??missing(bn)],
        [t('Category','বিভাগ'),product.category||missing(bn)]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl></>)}
     {summary}
     <Link href={back} className="native-preview-secondary native-preview-return">← {t('Back to Offer','অফারে ফিরুন')}</Link>
    </div>
   </div>:kind==='deal'&&group?<div className="native-preview-group-layout">
    {photo}<div className="native-preview-group-body">
     <div className="native-preview-split native-preview-group-eyebrow"><strong>GROUP DEAL</strong>
      <Link href={retailHref} className="native-preview-outline-action">{t('Product Details','পণ্যের বিস্তারিত')} →</Link></div>
     <h1>{title}</h1><p className="native-preview-muted">{product.unit} · SKU {product.sku??missing(bn)}</p>
     {panel(<><p className="native-preview-eyebrow">{t('Current qualifying tier · Price not final','বর্তমান যোগ্য স্তর · চূড়ান্ত মূল্য নয়')}</p>
      <div className="home-preview-product-price native-preview-large-price"><strong>{money(groupPrice,bn)}</strong></div>
      <p className="native-preview-muted">{t('Market retail','বাজারের খুচরা দাম')}: {money(market,bn)}</p>
      {market!==null&&groupPrice!==null&&market>groupPrice&&<p className="native-preview-accent">{t('Potential saving','সম্ভাব্য সাশ্রয়')}: {money(market-groupPrice,bn)}</p>}
      {nextPrice!=null&&<p className="native-preview-muted">{t('Next tier at','পরবর্তী স্তর')} {fmt(group.next_threshold!)} {t('people','জন')}: {money(nextPrice,bn)}</p>}
     </>)}
     {panel(<><h2>{t('Group Deal price tiers','গ্রুপ ডিলের দামের ধাপ')}</h2>
      <div className="native-preview-tier-grid">
       <div className="native-preview-tier"><small>{t('Starting','শুরুর দাম')}</small><strong>—</strong><span>{t('Not published','প্রকাশিত হয়নি')}</span></div>
       <div className="native-preview-tier is-current"><small>{t('Current tier','বর্তমান ধাপ')}</small><strong>{money(groupPrice,bn)}</strong></div>
       <div className="native-preview-tier"><small>{t('Next tier','পরবর্তী ধাপ')}</small><strong>{money(nextPrice??null,bn)}</strong></div>
      </div><p className="native-preview-hint">{t('Only server-published qualifying prices are displayed. Unpublished tiers remain blank.','সার্ভারে প্রকাশিত দাম দেখানো হচ্ছে। অপ্রকাশিত ধাপ ফাঁকা থাকবে।')}</p></>)}
     {panel(<><h2>{t('Community progress','কমিউনিটির অগ্রগতি')}</h2>
      <div className="native-preview-split native-preview-small-row"><strong>👥 {fmt(group.buyer_count)}{group.next_threshold?'/'+fmt(group.next_threshold):''} {t('joined','যুক্ত')}</strong>
       <span>{safeTime(group.closes_at)?t('Deadline: ','শেষ সময়: ')+new Date(group.closes_at!).toLocaleDateString(bn?'bn-BD':'en-BD'):t('Deadline pending','সময় প্রকাশিত হয়নি')}</span></div>
      {group.next_threshold!=null&&<div className="native-preview-progress" role="progressbar" aria-valuemin={0} aria-valuemax={group.next_threshold} aria-valuenow={Math.min(group.buyer_count,group.next_threshold)}><span style={{width:Math.min(100,group.buyer_count/group.next_threshold*100)+'%'}}/></div>}
      <p className="native-preview-muted">{t('Qualified buyers and closing rules determine the final price.','যোগ্য ক্রেতা ও সময়সীমার নিয়মে চূড়ান্ত দাম নির্ধারিত হবে।')}</p></>)}
     <div className="native-preview-actions"><Link href={retailHref} className="native-preview-secondary">{t('Product Details','পণ্যের বিস্তারিত')}</Link><button type="button" className="native-preview-primary" onClick={actionNotice}>{t('Join Deal · Preview','গ্রুপে যোগ দিন · ডেমো')}</button></div>
    </div>
   </div>:<div className="native-preview-exclusive">
    <p className="native-preview-overline">{t('PRODUCT DETAILS','পণ্যের বিস্তারিত')}</p><h1>{title}</h1>
    <div className="native-preview-exclusive-grid">{photo}
     {panel(<><p className="native-preview-muted">{product.unit} · {selected?.offer_title||t('Your community','আপনার কমিউনিটি')}</p>
      <div className="home-preview-product-price native-preview-split-price"><strong>{money(selectedPrice,bn)}</strong>{market!==null&&<s>{money(market,bn)}</s>}</div>
      {saving!==null&&<span className="native-preview-saving">{t('Potential saving','সম্ভাব্য সাশ্রয়')} {money(saving,bn)}</span>}
      <h2>{t('Same product · Available offers','একই পণ্য · উপলব্ধ অফার')}</h2>
      <div className="native-preview-offers">{available.map(o=><button type="button" key={o.offer_id} aria-pressed={selected?.offer_id===o.offer_id}
       className={'native-preview-offer-option '+(selected?.offer_id===o.offer_id?'is-selected':'')}
       onClick={()=>{setChoice(o.offer_id);setMessage('')}}><span>{o.offer_kind==='SOLO'?t('Direct / Exclusive','সরাসরি / এক্সক্লুসিভ'):o.offer_kind==='GROUP_DEAL'?t('Group Deal','গ্রুপ ডিল'):t('Community Pool','কমিউনিটি পুল')} · {o.offer_title}</span>
       <strong>{money(confirmedOfferPrice(o),bn)}</strong></button>)}</div>
      {!available.length&&<p className="native-preview-hint">{t('No eligible community offer currently published.','বর্তমানে কোনো যোগ্য কমিউনিটি অফার প্রকাশিত নেই।')}</p>}
      <div className="native-preview-actions"><Link href={retailHref} className="native-preview-secondary">{t('View details','বিস্তারিত দেখুন')}</Link><button type="button" onClick={actionNotice} className="native-preview-primary">{t('Review Offer · Preview','অফার দেখুন · ডেমো')}</button></div>
     </>,'native-preview-exclusive-card')}
    </div>
   </div>}
   {message&&<p role="status" className="native-preview-status">{message}</p>}
   <p className="native-preview-hint">{t('Preview display only. Verified availability and payable prices must be reconfirmed before any purchase.','শুধু প্রিভিউ। কেনার আগে স্টক ও পরিশোধযোগ্য দাম পুনরায় যাচাই করতে হবে।')}</p>
  </div><PublicFooter storefront language={language}/>
 </main>
}
