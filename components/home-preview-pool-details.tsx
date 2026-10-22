'use client'

import {useState} from 'react'
import Link from 'next/link'
import {addLaunchItems} from '@/lib/launch-cart'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {previewPhoto} from '@/lib/home-card-preview-fixtures'
import {previewPoolItems} from '@/lib/preview-native-detail-data'
import type {ApprovedPool,ApprovedProduct,ApprovedPoolLine} from '@/lib/approved-card-view'
import './approved-data-state.css'
import './home-preview-pool-details.css'
import './home-preview-native-details.css'

type Pool=ApprovedPool
type Product=ApprovedProduct
function PoolProductPhoto({product}:{product:Product}){
 const [failed,setFailed]=useState(false)
 return <img data-empty={product.image!==undefined&&(product.image===null||failed)||undefined} src={failed?'/preview-app-product-placeholder.svg':product.image!==undefined?(product.image||'/preview-app-product-placeholder.svg'):previewPhoto(product.photo)}
  alt={product.name} width={600} height={600} loading="lazy" decoding="async"
  onError={()=>setFailed(true)} className={failed?'home-preview-pool-placeholder':undefined}/>
}

/** Preview-only fixture. Quantity and totals remain on-device; no database, order or payment writes. */
export function HomePreviewPoolDetails({pool,initialLanguage,hasLanguageCookie,view}:{
 view?:{lines:ApprovedPoolLine[]};pool:Pool;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean
}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const [quantities,setQuantities]=useState<Record<string,number>>({})
 const [status,setStatus]=useState('')
 const bn=language==='bn'
 const t=(en:string,local:string)=>bn?local:en
 const n=(num:number)=>new Intl.NumberFormat(bn?'bn-BD':'en-US').format(num)
 const cash=(num:number|null)=>'৳'+n(num??0)
 const name=t(pool.name,pool.nameBn)
 const lines:ApprovedPoolLine[]=view?.lines??previewPoolItems(pool.id)
 const selected=lines.filter(line=>(quantities[line.product.id]??0)>0)
 const units=selected.reduce((sum,line)=>sum+(quantities[line.product.id]??0),0)
 const total=(value:'opening'|'current'|'next')=>selected.some(line=>line.tiers[value]===null)?null:selected.reduce((sum,line)=>sum+(line.tiers[value]??0)*(quantities[line.product.id]??0),0)
 const retail=selected.some(line=>line.product.oldPrice===null)?null:selected.reduce((sum,line)=>sum+(line.product.oldPrice??0)*(quantities[line.product.id]??0),0)
 const starting=total('opening'),current=total('current'),next=total('next')
 const endDate=()=>{
  if(view&&pool.closesAt)return new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(pool.closesAt))
  const match=pool.date.match(/^(\d+)\s+([A-Za-z]+)$/)
  if(!match)return pool.date
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month=months.indexOf(match[2]);if(month<0)return pool.date
  return new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})
   .format(new Date(Date.UTC(2026,month,Number(match[1]))))
 }
 function changeQty(id:string,diff:number){
  setQuantities(old=>({...old,[id]:Math.min(20,Math.max(0,(old[id]??0)+diff))}))
  setStatus('')
 }
 return <main className="public-marketplace-flat market-pool-detail-page home-preview-pool-detail native-preview-detail-page min-h-screen" lang={language} data-approved-data={view?true:undefined}>
  <PublicHeader storefront shopBaseHref="/" browseHref="/#mobile-pools" actionHref="/#mobile-pools"
   actionLabel={t('Back to Pools','পুলে ফিরে যান')} mobileActionLabel={t('Pools','পুল')}
   language={language} onLanguageChange={setLanguage}/>
  <div className="market-pool-detail-content home-preview-pool-content native-preview-content">
   <Link href="/#mobile-pools" className="native-preview-back">‹ &nbsp;{t('Back','ফিরুন')}</Link>
   <div className="native-preview-pool-header">
    <div className="native-preview-pool-badges">
     <span className="native-preview-pill">{(pool.id==='weekly'||pool.label==='Weekly Pool')?t('WEEKLY POOL','সাপ্তাহিক পুল'):t('MONTHLY POOL','মাসিক পুল')}</span>
     <span className="native-preview-pill native-preview-active">● ACTIVE</span>
     <span className="native-preview-pill native-preview-demo" data-empty={view?true:undefined}>{view?' ':t('DEMO DATA','ডেমো তথ্য')}</span>
    </div>
    <h1>{name}</h1>
    <p className="native-preview-muted">{n(lines.length)} {t('products','টি পণ্য')} · {n(pool.joined)} {t('households joined','পরিবার যুক্ত')}</p>
   </div>

   <section className="native-preview-panel native-preview-pool-progress home-preview-pool-summary">
    <h2>{t('Community savings progress','কমিউনিটির অগ্রগতি')}</h2>
    <div className="native-preview-split native-preview-small-row">
     <strong>{n(pool.joined)} {t('households joined','পরিবার যুক্ত')}</strong>
     <span data-empty={pool.target===0||undefined}>{n(pool.target)} {t('next milestone','পরবর্তী ধাপ')}</span>
    </div>
    <div className="home-preview-pool-progress native-preview-progress" role="progressbar"
     aria-label={t('Household progress','পরিবারের অগ্রগতি')}
     aria-valuemin={0} aria-valuemax={Math.max(1,pool.target,pool.joined)} aria-valuenow={pool.joined}>
     <span style={{width:(pool.target>0?Math.min(100,pool.joined/pool.target*100):0)+'%'}}/>
    </div>
    <p className="native-preview-muted">{t('No cap on participation. Progress shows the next price milestone, not Pool capacity.','অংশগ্রহণ সীমাহীন। অগ্রগতি পরের দামের ধাপ বোঝায়, পুলের সদস্যসীমা নয়।')}</p>
    <div className="native-preview-split native-preview-pool-deadline">
     <strong data-empty={pool.days===null||undefined}>◷ {t('Commitment ends','যোগদান শেষ')}: {endDate()}</strong>
     <strong>{n(pool.days??0)} {t('days left','দিন বাকি')}</strong>
    </div>
   </section>

   <section className="native-preview-pool-shop">
    <div className="native-preview-split native-preview-pool-shop-heading">
     <div><h2>{t('Choose your products','প্রয়োজনীয় পণ্য বেছে নিন')}</h2>
      <p className="native-preview-muted">{t('Pick only what you need · 1–20 products per Pool','যা প্রয়োজন শুধু তাই নিন · পুলে ১–২০টি পণ্য')}</p></div>
     <span className="native-preview-selected">{n(selected.length)} {t('selected','নির্বাচিত')}</span>
    </div>
    <div className="home-preview-pool-products-grid native-preview-pool-products">
     {lines.map(({product,tiers})=>{
      const q=quantities[product.id]??0
      const productHref=(view?'/preview-live/product/':'/demo-product/')+product.id+'?kind=retail&from=pool&pool='+pool.id+(pool.launchOfferId?'&offer='+pool.launchOfferId:'')
      return <article className={'home-preview-pool-product native-preview-pool-item native-preview-panel '+(q?'is-selected':'')} key={product.id}>
       <Link href={productHref} className="home-preview-pool-product-image" aria-label={t('Product Details: ','পণ্যের বিস্তারিত: ')+t(product.name,product.nameBn)}>
        <PoolProductPhoto product={product}/></Link>
       <div className="native-preview-pool-item-copy">
        <div className="native-preview-split native-preview-item-name"><h3>{t(product.name,product.nameBn)}</h3><small>{product.unit}</small></div>
        <div className="native-preview-item-price"><strong data-empty={tiers.current===null||undefined}>{cash(tiers.current)}</strong><s data-empty={product.oldPrice===null||undefined}>{cash(product.oldPrice)}</s></div>
        <p className="native-preview-accent" data-empty={product.oldPrice===null||tiers.current===null||undefined}>{t('Potential saving','সম্ভাব্য সাশ্রয়')} {cash(Math.max(0,(product.oldPrice??0)-(tiers.current??0)))} / {product.unit}</p>
        <p className="native-preview-muted" data-empty={tiers.next===null||undefined}>{t('Next tier','পরবর্তী স্তর')}: {cash(tiers.next)} · {n(pool.target)} {t('households','পরিবার')}</p>
        <div className="native-preview-split native-preview-item-bottom">
         <Link className="native-preview-product-link" href={productHref}>{t('Product Details','পণ্যের বিস্তারিত')} →</Link>
         <div className="native-preview-quantity" role="group" aria-label={t('Quantity for ','পরিমাণ: ')+t(product.name,product.nameBn)}>
          <button type="button" disabled={q===0} aria-label={'Decrease '+product.name} onClick={()=>changeQty(product.id,-1)}>−</button>
          <output>{n(q)}</output>
          <button type="button" disabled={q>=20} aria-label={'Increase '+product.name} onClick={()=>changeQty(product.id,1)}>＋</button>
         </div>
        </div>
       </div>
      </article>
     })}
    </div>
   </section>

   <section className="native-preview-panel native-preview-pool-tiers">
    <h2>{t('How Pool prices unlock','পুলের দাম কীভাবে কমে')}</h2>
    <div className="native-preview-tier-grid">
     {[
      {title:t('Starting total','শুরুর মোট মূল্য'),value:starting},
      {title:t('Current Pool total','বর্তমান পুল মূল্য'),value:current},
      {title:t('Next-tier total','পরবর্তী স্তরের মূল্য'),value:next}
     ].map((tier,i)=><div key={i} className={'native-preview-tier '+(i===1?'is-current':'')}>
      <small>{tier.title}</small><strong data-empty={tier.value===null||undefined}>{view?cash(tier.value):units?cash(tier.value):'—'}</strong>
     </div>)}
    </div>
    <p className="native-preview-hint">{pool.launchOfferId&&units?t('Totals for your selected quantities. Staff confirm delivery charges.','আপনার নির্বাচিত পরিমাণের মোট মূল্য। টিম ডেলিভারি চার্জ নিশ্চিত করবে।'):units?t('Illustrative totals for selected quantities. All final prices require qualification and confirmation.','নির্বাচিত পরিমাণের নমুনা দাম। চূড়ান্ত মূল্য যাচাই ও নিশ্চিতকরণ সাপেক্ষ।'):
     t('Select one or more products above to compare starting, current and next-tier prices.','শুরুর, বর্তমান ও পরবর্তী দামের তুলনায় ওপর থেকে এক বা একাধিক পণ্য বেছে নিন।')}</p>
   </section>

   <section className="native-preview-panel native-preview-pool-basket">
    <div className="native-preview-split">
     <h2>{t('Your Pool basket','আপনার পুলের বাজার')}</h2>
     <small>{n(selected.length)} {t('products','পণ্য')} · {n(units)} {t('units','ইউনিট')}</small>
    </div>
    {[
     [t('Market retail total','খুচরা বাজারমূল্য'),retail],
     [t('Current estimated Pool total','বর্তমান পুলের আনুমানিক মূল্য'),current],
     [t('Potential savings','সম্ভাব্য সাশ্রয়'),Math.max(0,(retail??0)-(current??0))],
     [t('Total at next tier','পরবর্তী স্তরে মোট মূল্য'),next]
    ].map(([label,value],i)=><div className="native-preview-split native-preview-basket-row" key={String(label)}>
     <span>{label}</span><strong data-empty={value===null||undefined} className={i===1?'native-preview-total':''}>{cash(value===null?null:Number(value))}</strong>
    </div>)}
    <p className="native-preview-hint">{pool.launchOfferId?t('Excludes delivery fees. Your order requires manual staff approval.','ডেলিভারি চার্জ বাদে। অর্ডারের জন্য টিমের ম্যানুয়াল অনুমোদন প্রয়োজন।'):t('Excludes delivery fees. No real stock, booking or payment occurs in demo.','ডেলিভারি চার্জ বাদে। ডেমোতে বাস্তব স্টক, বুকিং বা পেমেন্ট হয় না।')}</p>
   </section>

   <section className="native-preview-panel native-preview-pool-before">
    <h2>{t('Before you join','যোগদানের আগে জানুন')}</h2>
    <p>{t('Select only what you need. The final price, availability, deadline and delivery rules must be confirmed.','শুধু প্রয়োজনীয় পণ্য বেছে নিন। চূড়ান্ত দাম, প্রাপ্যতা, সময়সীমা ও ডেলিভারি নিশ্চিত করতে হবে।')}</p>
    <p>{pool.launchOfferId?t('Review your selection in the cart and sign in at checkout to submit your order.','কার্টে নির্বাচন দেখুন এবং অর্ডার করতে চেকআউটে লগইন করুন।'):t('No order, Pool commitment or payment is created from this preview.','এই প্রিভিউ থেকে কোনো অর্ডার, পুলে যোগদান বা পেমেন্ট তৈরি হয় না।')}</p>
   </section>
   <div className="native-preview-pool-review" role="region" aria-label={t('Pool selection review','পুল নির্বাচন পর্যালোচনা')}>
    <div><small>{n(units)} {t('units selected','টি ইউনিট নির্বাচিত')}</small><strong>{cash(current)}</strong></div>
    <button type="button" disabled={Boolean(view)&&!pool.launchOfferId||!units||selected.some(l=>(quantities[l.product.id]??0)>(l.product.stock??100))} onClick={()=>{if(pool.launchOfferId){const added=addLaunchItems(selected.map(l=>({product_id:l.product.id,offer_id:pool.launchOfferId,quantity:quantities[l.product.id]})));if(!added){setStatus(t('Your cart can hold 6 different products. Review it before adding this Pool.','কার্টে ৬টি ভিন্ন পণ্য রাখা যায়। আগে কার্ট দেখুন।'));return}window.location.assign('/cart');return}setStatus(t('Your Pool selection is saved for this on-screen demo only. No real commitment or payment.','নির্বাচনটি শুধু ডেমোর জন্য। কোনো বাস্তব যোগদান বা পেমেন্ট হয়নি।'))}}>
     {pool.launchOfferId?t('Review Pool order','পুল অর্ডার দেখুন'):t('Review Join Pool · Demo','পুলে যোগদান দেখুন · ডেমো')} →</button>
   </div>
   {status&&<p role="status" className="native-preview-status">{status}</p>}
  </div>
  <PublicFooter storefront language={language}/>
 </main>
}
