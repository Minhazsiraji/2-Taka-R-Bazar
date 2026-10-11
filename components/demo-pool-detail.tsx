'use client'
import {useState} from 'react'
import Link from 'next/link'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import {featuredPoolTotals} from '@/lib/featured-pools'
import {formatPrice} from '@/lib/storefront'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'

export function DemoPoolDetail({pool}:{pool:DemoFeaturedPool}){
 const [language,setLanguage]=useState<MarketplaceLanguage>('bn')
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const total=featuredPoolTotals(pool)
 return <main className="public-marketplace-flat market-pool-detail-page min-h-screen">
  <header className="market-pool-detail-header">
   <Link href="/" className="market-pool-home-link">← 2-TAKA-R-BAZAR</Link>
   <div className="market-language-toggle" role="group" aria-label="Language / ভাষা">
    <button type="button" aria-pressed={language==='bn'} onClick={()=>setLanguage('bn')}>বাংলা</button>
    <button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button>
   </div>
  </header>
  <div className="market-pool-detail-content" lang={language}>
   <div className="market-demo-detail-banner" role="status">{t('DEMO POOL — design preview only. Prices, products, participants and thresholds are illustrative. Orders are disabled.','ডেমো পুল — শুধু ডিজাইন পরীক্ষার জন্য। দাম, পণ্য, ক্রেতা ও লক্ষ্যমাত্রা কাল্পনিক। অর্ডার বন্ধ।')}</div>
   <div className="market-pool-detail-intro">
    <img src={pool.image} alt={t(pool.title.en,pool.title.bn)} />
    <div><span className="market-featured-pool-eyebrow">DEMO / নমুনা · {pool.slug.toUpperCase()} POOL</span>
     <h1>{t(pool.title.en,pool.title.bn)}</h1>
     <p>{t(pool.description.en,pool.description.bn)}</p>
     <div className="market-pool-detail-stats">
      <div><span>{t('Example group basket','নমুনা গ্রুপ বাজার')}</span><b>{formatPrice(total.group)}</b></div>
      <div><span>{t('Example individual basket','নমুনা একক বাজার')}</span><b>{formatPrice(total.solo)}</b></div>
      <div><span>{t('Sample participants','নমুনা অংশগ্রহণ')}</span><b>{pool.sampleHouseholds}/{pool.minHouseholds}</b></div>
     </div>
    </div>
   </div>
   <section className="market-pool-detail-section">
    <h2>{t('Products included in this example','এই নমুনা পুলের পণ্যসমূহ')}</h2>
    <div className="market-pool-detail-items">{pool.bundle.map(({offer,qty})=><article key={offer.product_id} className="market-pool-detail-item">
     <Link href={`/demo-product/${offer.product_id}`}><img src={offer.image_url??'/grocery-hero-glass.svg'} alt={t(offer.product_name,offer.product_name_bn??offer.product_name)}/></Link>
     <div><h3>{t(offer.product_name,offer.product_name_bn??offer.product_name)}</h3><p>{offer.package_size} · {t('Quantity','পরিমাণ')}: {qty}</p><Link href={`/demo-product/${offer.product_id}`}>{t('See product details','পণ্যের বিস্তারিত দেখুন')} →</Link></div>
     <div className="market-pool-detail-item-price"><strong>{formatPrice((Number(offer.confirmed_price)||0)*qty)}</strong><span>{t('Sample group price','নমুনা গ্রুপ দাম')}</span></div>
    </article>)}</div>
   </section>
   <section className="market-pool-detail-section market-pool-detail-terms">
    <h2>{t('How this Pool would work','এই পুল যেভাবে কাজ করবে')}</h2>
    <p>{t('Customers first choose their own community. A future published Pool will show its opening and closing dates, confirmed item prices, eligibility, required group size and fulfillment plan. None of these sample values creates a real commitment.','ক্রেতা প্রথমে নিজের কমিউনিটি বাছবেন। ভবিষ্যতে বাস্তব পুল চালু হলে শুরুর ও শেষ সময়, নিশ্চিত মূল্য, সদস্যপদের যোগ্যতা, ক্রেতার লক্ষ্যমাত্রা ও সরবরাহ পরিকল্পনা দেখা যাবে। এই নমুনার কোনো তথ্য বাস্তব অর্ডার নয়।')}</p>
    <p>{t('Community-point pickup will be free when enabled. Optional within-community home delivery is ৳20 for baskets up to ৳1,000 and ৳30 above ৳1,000. Delivery is separate from product savings.','কমিউনিটি পয়েন্টে সংগ্রহ চালু থাকলে ফ্রি। কমিউনিটির মধ্যে ৳১,০০০ পর্যন্ত অর্ডারে ৳২০ এবং এর বেশি হলে ৳৩০ হোম ডেলিভারি। ডেলিভারি খরচ ও পণ্যের সাশ্রয় আলাদা।')}</p>
    <button type="button" disabled aria-disabled="true" className="btn-primary">{t('Join Pool · Demo disabled','পুলে যোগ দিন · ডেমো বন্ধ')}</button>
    <Link className="btn-secondary" href="/">{t('Back to homepage','হোমপেজে ফিরুন')}</Link>
   </section>
  </div>
 </main>
}
