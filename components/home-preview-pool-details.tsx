'use client'

import {useState} from 'react'
import Link from 'next/link'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {previewPools,previewProducts,previewPhoto,previewMoney} from '@/lib/home-card-preview-fixtures'
import './home-preview-pool-details.css'

type Pool=typeof previewPools[number]
type Product=typeof previewProducts[number]

function PoolProductPhoto({product}:{product:Product}){
 const [failed,setFailed]=useState(false)
 return <img src={failed?'/preview-app-product-placeholder.svg':previewPhoto(product.photo)}
  alt={product.name} width={600} height={600} loading="lazy" decoding="async"
  onError={()=>setFailed(true)} className={failed?'home-preview-pool-placeholder':undefined}/>
}

/** This component receives only approved preview fixtures from a server-gated route.
 * No checkout, database, real cart, reservation or join request can originate here. */
export function HomePreviewPoolDetails({pool,initialLanguage,hasLanguageCookie}:{
 pool:Pool;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean
}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const bn=language==='bn'
 const t=(en:string,local:string)=>bn?local:en
 const name=t(pool.name,pool.nameBn)
 const products=pool.products.map(id=>previewProducts.find(item=>item.id===id)).filter((p):p is Product=>Boolean(p))
 return <main className="public-marketplace-flat market-pool-detail-page home-preview-pool-detail min-h-screen">
  <PublicHeader storefront shopBaseHref="/" browseHref="/#mobile-pools" actionHref="/#mobile-pools"
   actionLabel={t('Back to Pools','পুলে ফিরে যান')} mobileActionLabel={t('Pools','পুল')}
   language={language} onLanguageChange={setLanguage}/>
  <div className="market-pool-detail-content home-preview-pool-content" lang={language}>
   <nav className="market-pool-breadcrumb" aria-label={t('Breadcrumb','পথ নির্দেশনা')}>
    <Link href="/">{t('Home','হোম')}</Link><span aria-hidden="true">/</span>
    <Link href="/#mobile-pools">{t('Community Pools','কমিউনিটি পুল')}</Link><span aria-hidden="true">/</span>
    <span aria-current="page">{name}</span>
   </nav>
   <p className="market-demo-detail-banner" role="status">{t(
    'DEMO PREVIEW — sample products and participation only. No real ordering or joining.',
    'ডেমো প্রিভিউ — নমুনা পণ্য ও অংশগ্রহণ। বাস্তব অর্ডার বা যোগদান নয়।')}</p>
   <section className="home-preview-pool-hero market-ui-card">
    <div className="home-preview-pool-photos" aria-label={t('Pool product photos','পুলের পণ্যের ছবি')}>
     {products.map(p=><Link key={p.id} href={'/demo-product/'+p.id} aria-label={t('View ','দেখুন: ')+t(p.name,p.nameBn)}>
      <PoolProductPhoto product={p}/></Link>)}
    </div>
    <div className="home-preview-pool-summary">
     <div className="home-preview-pool-badges"><span>{t(pool.label,pool.labelBn)}</span>
      <span className="home-preview-pool-active">● ACTIVE · DEMO</span></div>
     <h1>{name}</h1>
     <p className="home-preview-pool-muted">{products.length} {t('products','টি পণ্য')} · {pool.joined.toLocaleString('en-BD')} {t('households joined','পরিবার যুক্ত')}</p>
     <div className="home-preview-pool-count"><strong>{pool.joined.toLocaleString('en-BD')}</strong><span>/ {pool.target.toLocaleString('en-BD')} {t('households','পরিবার')}</span></div>
     <div className="home-preview-pool-progress" role="progressbar"
      aria-label={t('Household progress','পরিবারের অংশগ্রহণ')}
      aria-valuemin={0} aria-valuemax={pool.target} aria-valuenow={pool.joined}>
      <span style={{width:Math.min(100,pool.joined/pool.target*100)+'%'}}/></div>
     <div className="home-preview-pool-info">
      <p>◷ {t('Commit ends in','কমিট শেষ হবে')} {pool.days} {t('days','দিনে')} · {pool.date}</p>
      <p>{t('Next savings tier','পরবর্তী সাশ্রয় টিয়ার')}: <strong>{pool.target.toLocaleString('en-BD')}</strong> {t('households','পরিবার')}</p>
     </div>
     <div className="home-preview-pool-actions">
      <a className="btn-primary" href="#pool-products">{t('View Pool products','পুলের পণ্য দেখুন')} ↓</a>
      <Link className="btn-secondary" href="/#mobile-pools">← {t('Back to Community Pools','কমিউনিটি পুলে ফিরে যান')}</Link>
     </div>
    </div>
   </section>
   <section className="home-preview-pool-products" id="pool-products">
    <h2>{t('Products in this Pool','এই পুলের পণ্য')}</h2>
    <p className="home-preview-pool-muted">{t('Illustrative product prices; each item opens its own full details page.',
     'নমুনা পণ্যমূল্য; প্রতিটি পণ্যের আলাদা বিস্তারিত পৃষ্ঠা রয়েছে।')}</p>
    <div className="home-preview-pool-products-grid">
     {products.map(p=><article className="home-preview-pool-product market-ui-card" key={p.id}>
      <Link href={'/demo-product/'+p.id} className="home-preview-pool-product-image" aria-label={t('View ','দেখুন: ')+t(p.name,p.nameBn)}>
       <PoolProductPhoto product={p}/></Link>
      <div>
       <h3>{t(p.name,p.nameBn)}</h3><p className="home-preview-pool-muted">{p.unit}</p>
       <div className="home-preview-pool-price"><strong>{previewMoney(p.price)}</strong><s>{previewMoney(p.oldPrice)}</s></div>
       <span className="home-preview-pool-save">{t('Save','সাশ্রয়')} {previewMoney(p.oldPrice-p.price)}</span>
       <Link href={'/demo-product/'+p.id} className="home-preview-pool-product-link">{t('View details','বিস্তারিত দেখুন')} →</Link>
      </div>
     </article>)}
    </div>
   </section>
   <section className="home-preview-pool-note market-ui-card">
    <h2>{t('How participation works','কীভাবে অংশগ্রহণ করবেন')}</h2>
    <p>{t('Community members can join an eligible Pool when real availability, savings tiers and a deadline are published.',
     'বাস্তব পুলে পণ্যের প্রাপ্যতা, সাশ্রয়ের ধাপ ও শেষ সময় প্রকাশ হলে যোগ্য কমিউনিটির সদস্যরা অংশ নিতে পারবেন।')}</p>
    <p>{t('Joining and payment are disabled for this preview. The household counts, prices and dates above are examples only.',
     'এই প্রিভিউতে যোগদান ও পেমেন্ট বন্ধ। উপরের পরিবারের সংখ্যা, দাম ও তারিখ শুধু নমুনা।')}</p>
   </section>
  </div>
  <PublicFooter storefront language={language}/>
 </main>
}
