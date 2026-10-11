'use client'

import {useState} from 'react'
import Link from 'next/link'
import type {StorefrontOffer} from '@/lib/storefront'
import {chooseText} from '@/lib/storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'

export function DemoProductDetails({offer}:{offer:StorefrontOffer}){
 const [lang,setLang]=useState<MarketplaceLanguage>('bn')
 const t=(en:string,bn:string)=>chooseText(lang,en,bn)
 const demoName=t(offer.product_name,offer.product_name_bn??offer.product_name)
 return <main className="public-marketplace-flat min-h-screen">
  <header className="market-demo-detail-header">
   <Link href="/" className="font-black">← 2-TAKA-R-BAZAR</Link>
   <div className="market-language-switch" role="group" aria-label="Language / ভাষা">
    <button aria-pressed={lang==='bn'} onClick={()=>setLang('bn')} type="button">বাংলা</button>
    <button aria-pressed={lang==='en'} onClick={()=>setLang('en')} type="button">English</button>
   </div>
  </header>
  <div className="market-demo-detail-container">
   <div className="market-demo-detail-banner" role="status">{t('DEMO PRODUCT — design preview only. No live inventory, price commitment or purchase.','ডেমো পণ্য — শুধু ডিজাইন পরীক্ষার জন্য। এখানে কোনো বাস্তব স্টক, নিশ্চিত মূল্য বা কেনাকাটা নেই।')}</div>
   <div className="market-demo-detail-grid">
    <div className="market-demo-detail-image"><img src={offer.image_url??'/grocery-hero-glass.svg'} alt={demoName}/></div>
    <section className="market-demo-detail-copy">
     <p className="market-story-eyebrow">{t('Sample product details','নমুনা পণ্যের বিবরণ')}</p>
     <h1>{demoName}</h1><p>{offer.package_size} · {t('Sample packaging artwork','নমুনা প্যাকেটের ছবি')}</p>
     <p className="market-demo-pill">DEMO / নমুনা</p>
     <div className="market-demo-prices">
      <div><span>{t('Buy Alone','একা কিনুন')}</span><strong>৳{offer.solo_price}</strong></div>
      <div><span>{t('Group Buy','গ্রুপে কিনুন')}</span><strong>৳{offer.confirmed_price}</strong></div>
     </div>
     <p className="market-demo-message">{t('These are example prices for UI review. They are not approved sale prices, and no discount is being offered.','এগুলো শুধু ডিজাইন পরীক্ষার নমুনা মূল্য। এগুলো অনুমোদিত বিক্রয়মূল্য নয় এবং কোনো প্রকৃত ছাড় দেওয়া হচ্ছে না।')}</p>
     <div className="market-demo-buttons">
      <button disabled type="button">{t('Buy Alone · Demo only','একা কিনুন · শুধু ডেমো')}</button>
      <button disabled type="button">{t('Group Buy · Demo only','গ্রুপে কিনুন · শুধু ডেমো')}</button>
     </div>
     <p className="market-demo-message">{t('Sample group participation and sample area assignment are fictional. Return to the storefront to review carousel, cards, filtering and responsive layout.','নমুনা গ্রুপের অংশগ্রহণ ও এলাকা বাস্তব নয়। ক্যারোসেল, কার্ড, ফিল্টার ও মোবাইল ডিজাইন দেখতে হোমপেজে ফিরে যান।')}</p>
     <Link href="/" className="btn-secondary">{t('← Back to storefront','← দোকানের হোমপেজে ফিরুন')}</Link>
    </section>
   </div>
  </div>
 </main>
}
