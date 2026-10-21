'use client'

import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {previewProducts,previewDeals,previewPhoto,previewMoney as money} from '@/lib/home-card-preview-fixtures'
import {previewAvailableOffers,previewGroupPriceTiers,nativeProductMeta,nativeProductSections} from '@/lib/preview-native-detail-data'
import './home-card-preview.css'
import './home-preview-native-details.css'

type Product=typeof previewProducts[number]
type Deal=typeof previewDeals[number]
type Props={product:Product;deal?:Deal;retail?:boolean;from?:string;poolId?:string;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean}
function ProductPhoto({product,alt,hero=false}:{product:Product;alt:string;hero?:boolean}){
 const [failed,setFailed]=useState(false)
 const ref=useRef<HTMLImageElement>(null)
 useEffect(()=>{if(ref.current?.complete&&ref.current.naturalWidth===0)setFailed(true)},[])
 return <img ref={ref} width={600} height={600} loading={hero?'eager':'lazy'} decoding="async"
  className={failed?'native-preview-fallback':undefined}
  src={failed?'/preview-app-product-placeholder.svg':previewPhoto(product.photo)} alt={alt}
  onError={()=>setFailed(true)}/>
}
function DemoPanel({children,className=''}:{children:React.ReactNode;className?:string}){
 return <section className={'native-preview-panel '+className}>{children}</section>
}
export function HomePreviewProductDetails({product,deal,retail=false,from,poolId,initialLanguage,hasLanguageCookie}:Props){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const [chosen,setChosen]=useState('solo')
 const [basket,setBasket]=useState(0)
 const [status,setStatus]=useState('')
 const bn=language==='bn'
 const t=(en:string,local:string)=>bn?local:en
 const n=(num:number)=>new Intl.NumberFormat(bn?'bn-BD':'en-US').format(num)
 const title=t(product.name,product.nameBn)
 const group=deal?previewGroupPriceTiers(product.id):null
 const offers=previewAvailableOffers(product.id)
 const selected=offers.find(o=>o.id===chosen)??offers.find(o=>o.id==='solo')
 const price=selected?.price??product.price
 const origin=from==='pool'&&poolId?'/demo-pool/'+poolId+'?source=home':
  from==='deal'||deal?'/demo-product/'+product.id+'?kind=deal':
  from==='exclusive'?'/demo-product/'+product.id:
  '/#mobile-exclusive'
 const retailHref='/demo-product/'+product.id+'?kind=retail&from='+(deal?'deal':from==='pool'?'pool':'exclusive')+
  (poolId?'&pool='+poolId:'')
 const back=retail?origin:deal?'/#mobile-deals':'/#mobile-exclusive'
 const heading=retail?t('PRODUCT INFORMATION','পণ্যের তথ্য'):
  deal?'GROUP DEAL':t('PRODUCT DETAILS','পণ্যের বিস্তারিত')
 return <main className="public-marketplace-flat market-pool-detail-page native-preview-detail-page home-preview-product-detail min-h-screen" lang={language}>
  <PublicHeader storefront shopBaseHref="/" browseHref={back} actionHref={back}
   actionLabel={t('Back','ফিরুন')} mobileActionLabel={t('Back','ফিরুন')}
   language={language} onLanguageChange={setLanguage}/>
  <div className="market-pool-detail-content native-preview-content">
   <Link href={back} className="native-preview-back">‹ &nbsp;{t('Back','ফিরুন')}</Link>
   {deal&&!retail?<div className="native-preview-group-layout">
    <div className="native-preview-group-photo"><ProductPhoto product={product} alt={title} hero/></div>
    <div className="native-preview-group-body">
     <div className="native-preview-split native-preview-group-eyebrow">
      <strong>GROUP DEAL</strong>
      <Link className="native-preview-outline-action" href={retailHref}>{t('Product Details','পণ্যের বিস্তারিত')} →</Link>
     </div>
     <h1>{title}</h1>
     <p className="native-preview-muted">{product.unit} · Savar DOHS · SKU {product.id}</p>
     <DemoPanel>
      <p className="native-preview-eyebrow">{t('Current qualifying tier · Price not final','বর্তমান যোগ্য স্তর · চূড়ান্ত মূল্য নয়')}</p>
      <div className="home-preview-product-price native-preview-large-price"><strong>{money(group?.current.price??deal.price)}</strong></div>
      <p className="native-preview-muted">{t('Market retail','বাজারের খুচরা দাম')}: {money(product.oldPrice)}</p>
      <p className="native-preview-accent">{t('Potential saving','সম্ভাব্য সাশ্রয়')}: {money(Math.max(0,product.oldPrice-(group?.current.price??deal.price)))}</p>
      {group?.next&&<p className="native-preview-muted">{t('Next tier at','পরবর্তী স্তর')} {n(group.next.minimum)} {t('people','জন')}: {money(group.next.price)} · {n(Math.max(0,group.next.minimum-deal.joined))} {t('more needed','জন আরও প্রয়োজন')}</p>}
     </DemoPanel>
     {group&&<DemoPanel>
      <h2>{t('Group Deal price tiers','গ্রুপ ডিলের দামের ধাপ')}</h2>
      <div className="native-preview-tier-grid">
       {group.tiers.map(tier=><div key={tier.minimum} className={'native-preview-tier '+(group.current.minimum===tier.minimum?'is-current':'')}>
        <small>{tier.minimum===1?t('Starting','শুরুর দাম'):n(tier.minimum)+' '+t('people','জন')}</small>
        <strong>{money(tier.price)}</strong>
        <span>{group.current.minimum===tier.minimum?t('Current tier','বর্তমান স্তর'):tier.minimum>deal.joined?t('Not yet unlocked','এখনো আনলক হয়নি'):t('Unlocked','আনলক হয়েছে')}</span>
       </div>)}
      </div>
      <p className="native-preview-hint">{t('Demo price tiers only. Server-authoritative prices required before checkout.','এগুলো নমুনা দাম। চেকআউটের আগে সার্ভার-যাচাইকৃত মূল্য প্রয়োজন।')}</p>
     </DemoPanel>}
     <DemoPanel>
      <h2>{t('Community progress','কমিউনিটির অগ্রগতি')}</h2>
      <div className="native-preview-split native-preview-small-row"><strong>👥 {n(deal.joined)}/{n(deal.target)} {t('joined','যুক্ত')}</strong><span>◷ {t('Ends in','শেষ হবে')} {n(deal.days)} {t('day(s)','দিনে')}</span></div>
      <div className="native-preview-progress" role="progressbar" aria-label={t('Group participation','গ্রুপের অংশগ্রহণ')}
       aria-valuemin={0} aria-valuemax={deal.target} aria-valuenow={deal.joined}><span style={{width:Math.min(100,deal.joined/deal.target*100)+'%'}}/></div>
      <p className="native-preview-muted">{t('Qualified buyers and closing rules determine the final price. Below-minimum groups expire without payment.','যোগ্য ক্রেতা ও সময়সীমার নিয়মে চূড়ান্ত দাম নির্ধারিত হবে। ন্যূনতম সদস্য না হলে টাকা ছাড়া গ্রুপ শেষ হবে।')}</p>
     </DemoPanel>
     <div className="native-preview-actions">
      <Link className="native-preview-secondary" href={retailHref}>{t('Product Details','পণ্যের বিস্তারিত')}</Link>
      <button className="native-preview-primary" type="button" onClick={()=>setStatus(t('Preview Group Deal draft noted locally. No real join or order was placed.','ডেমো গ্রুপ ডিল নির্বাচন দেখানো হয়েছে। বাস্তব যোগদান বা অর্ডার হয়নি।'))}>{t('Join Deal · Preview','গ্রুপে যোগ দিন · ডেমো')}</button>
     </div>
     <p className="native-preview-hint">{t('Demo only — no real order has been placed.','শুধু ডেমো — কোনো বাস্তব অর্ডার হয়নি।')}</p>
     {status&&<p role="status" className="native-preview-status">{status}</p>}
    </div>
   </div>:retail?<div className="native-preview-retail">
    <div className="native-preview-retail-photo"><ProductPhoto product={product} alt={title} hero/></div>
    <div>
     <p className="native-preview-overline">{heading}</p>
     <h1>{title}</h1><p className="native-preview-muted">{product.unit} · SKU {product.id}</p>
     <DemoPanel>
      <h2>{t('Market retail reference price','বাজারের খুচরা রেফারেন্স মূল্য')}</h2>
      <div className="home-preview-product-price native-preview-large-price"><strong>{money(product.oldPrice)}</strong></div>
      <p className="native-preview-muted">{t('Retail reference only. Group Deal and Pool tier prices are not displayed on the individual product page.','এখানে শুধু বাজারের রেফারেন্স দাম। গ্রুপ বা পুলের দামের ধাপ দেখানো হয় না।')}</p>
     </DemoPanel>
     <DemoPanel>
      <h2>{t('Product information','পণ্যের তথ্য')}</h2>
      <dl className="native-preview-info-list">
       <div><dt>{t('Name','নাম')}</dt><dd>{title}</dd></div>
       <div><dt>{t('Product brand','পণ্যের ব্র্যান্ড')}</dt><dd>{t('Not provided yet','এখনো দেওয়া হয়নি')}</dd></div>
       <div><dt>{t('Package','প্যাকেটের পরিমাণ')}</dt><dd>{product.unit}</dd></div>
       <div><dt>SKU</dt><dd>{product.id}</dd></div>
       <div><dt>{t('Category','বিভাগ')}</dt><dd>{t(nativeProductMeta[product.id].category,nativeProductMeta[product.id].categoryBn)}</dd></div>
      </dl>
     </DemoPanel>
     <div className="native-preview-info-sections">
      {nativeProductSections.map(section=><details key={section.id} className="native-preview-disclosure">
       <summary><strong>{t(section.title,section.titleBn)}</strong><span>{t('Admin-managed','অ্যাডমিন নিয়ন্ত্রিত')} <b>＋</b></span></summary>
       <div className="native-preview-disclosure-content">
        <p>{t('Verified product data will appear when Admin supplies it.','অ্যাডমিন যাচাইকৃত তথ্য দিলে এখানে দেখানো হবে।')}</p>
        {section.fields.map(field=><div key={field[0]}><span>{t(field[0],field[1])}</span><strong>{t('Not provided yet','এখনো দেওয়া হয়নি')}</strong></div>)}
       </div>
      </details>)}
     </div>
     <Link href={back} className="native-preview-secondary native-preview-return">← {t(deal?'Back to Group Deal':from==='pool'?'Back to Pool':'Back to Offer',deal?'গ্রুপ ডিলে ফিরুন':from==='pool'?'পুলে ফিরুন':'অফারে ফিরুন')}</Link>
    </div>
   </div>:<div className="native-preview-exclusive">
    <p className="native-preview-overline">{heading}</p>
    <h1>{title}</h1>
    <div className="native-preview-exclusive-grid">
     <div className="native-preview-exclusive-photo"><ProductPhoto product={product} alt={title} hero/></div>
     <DemoPanel className="native-preview-exclusive-card">
      <p className="native-preview-muted">{product.unit} · Savar DOHS</p>
      <div className="home-preview-product-price native-preview-split-price"><strong>{money(price)}</strong><s>{money(product.oldPrice)}</s></div>
      <span className="native-preview-saving">{t('Save','সাশ্রয়')} {money(Math.max(0,product.oldPrice-price))}</span>
      <h2>{t('Same product · Available offers','একই পণ্য · উপলব্ধ অফার')}</h2>
      <div className="native-preview-offers">
       {offers.map(o=><button type="button" key={o.id}
        onClick={()=>{setChosen(o.id);setStatus('')}}
        aria-pressed={o.id===selected?.id} className={'native-preview-offer-option '+(o.id===selected?.id?'is-selected':'')}>
        <span>{t(o.label,o.labelBn)}</span><strong>{money(o.price)}</strong>
       </button>)}
      </div>
      <div className="native-preview-actions">
       <Link href={retailHref} className="native-preview-secondary">{t('View details','বিস্তারিত দেখুন')}</Link>
       <button type="button" className="native-preview-primary" onClick={()=>{
        if(selected?.kind==='solo'){setBasket(q=>q+1);setStatus(t('Added to the preview basket. Your real cart is unchanged.','ডেমো ঝুড়িতে যোগ হয়েছে। বাস্তব কার্ট অপরিবর্তিত।'))}
        else setStatus(t('Preview offer selected. No real Group Deal or Pool participation was created.','ডেমো অফার নির্বাচন হয়েছে। বাস্তব গ্রুপ বা পুলে যোগদান হয়নি।'))
       }}>{selected?.kind==='solo'?t('Add to Cart','কার্টে যোগ করুন'):t('Join · Preview','যোগ দিন · ডেমো')}</button>
      </div>
      <p className="native-preview-hint">{t('Demo only — no real order has been placed.','শুধু ডেমো — কোনো বাস্তব অর্ডার হয়নি।')}</p>
      {status&&<p role="status" className="native-preview-status">{status}{basket>0&&' · '+n(basket)+' '+t('items in preview basket','টি পণ্য ডেমো ঝুড়িতে')}</p>}
     </DemoPanel>
    </div>
   </div>}
  </div>
  <PublicFooter storefront language={language}/>
 </main>
}
