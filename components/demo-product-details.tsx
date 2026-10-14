'use client'
import {useState} from 'react'
import Link from 'next/link'
import {PublicFooter} from '@/components/public-footer'
import {PublicHeader} from '@/components/public-header'
import type {StorefrontOffer} from '@/lib/storefront'
import {chooseText} from '@/lib/storefront-language'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {formatPrice} from '@/lib/storefront'
type BuyMode='solo'|'group'
export function DemoProductDetails({offer,initialLanguage='en',hasLanguageCookie=false}:{offer:StorefrontOffer;initialLanguage?:MarketplaceLanguage;hasLanguageCookie?:boolean}){
 const [lang,setLang]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const [quantity,setQuantity]=useState(1)
 const [mode,setMode]=useState<BuyMode>('group')
 const [cart,setCart]=useState<Record<BuyMode,number>>({solo:0,group:0})
 const [delivery,setDelivery]=useState<'pickup'|'home'>('pickup')
 const t=(en:string,bn:string)=>chooseText(lang,en,bn)
 const name=t(offer.product_name,offer.product_name_bn??offer.product_name)
 const solo=Number(offer.solo_price)||0
 const group=Number(offer.confirmed_price)||0
 const price=mode==='solo'?solo:group
 const subtotal=quantity*price
 const deliveryCharge=delivery==='pickup'?0:subtotal<=1000?20:30
 const cartSubtotal=cart.solo*solo+cart.group*group
 const cartDelivery=delivery==='pickup'||cartSubtotal===0?0:cartSubtotal<=1000?20:30
 const households=Number(offer.buyer_count)||0
 const nextThreshold=Number(offer.next_threshold)||0
 const remaining=Math.max(0,nextThreshold-households)
 return <main className="public-marketplace-flat market-pool-detail-page min-h-screen">
  <PublicHeader storefront shopBaseHref="/" browseHref="/#deals" actionHref="/#deals" actionLabel={t('Back to shopping','বাজারে ফিরুন')} mobileActionLabel={t('Shop','বাজার')} language={lang} onLanguageChange={setLang}/>

  <div className="market-pool-detail-content">
   <div className="market-demo-detail-banner" role="status">{t('DEMO PRODUCT — all prices, group participation and product availability are fictional. No real ordering.','ডেমো পণ্য — দাম, গ্রুপে অংশগ্রহণ ও মজুত কাল্পনিক। বাস্তবে অর্ডার করা যাবে না।')}</div>
   <div className="market-demo-detail-grid market-ui-product-detail">
    <div className="market-demo-detail-image market-ui-card"><img src={offer.image_url??'/grocery-hero-glass.svg'} alt={name}/></div>
    <section className="market-demo-detail-copy market-ui-card">
     <p className="market-story-eyebrow">{t('Sample product details','নমুনা পণ্যের বিবরণ')}</p>
     <h1>{name}</h1>
     <p>{offer.package_size} · {t('Sample packaging design','প্যাকেটের নমুনা ছবি')}</p>
     <p className="market-demo-pill">DEMO / নমুনা</p>
     <div className="market-demo-prices">
      <button type="button" aria-pressed={mode==='solo'} onClick={()=>setMode('solo')} className={mode==='solo'?'selected':''}>
       <span>{t('Buy Alone','একা কিনুন')}</span><strong>{formatPrice(solo)}</strong>
      </button>
      <button type="button" aria-pressed={mode==='group'} onClick={()=>setMode('group')} className={mode==='group'?'selected':''}>
       <span>{t('Group Buy','গ্রুপে কিনুন')}</span><strong>{formatPrice(group)}</strong>
      </button>
     </div>
     <section className="market-demo-product-tier" aria-label={t('Group buying terms','গ্রুপ কেনার শর্ত')}>
      <h2>{t('Group-price example','গ্রুপ দামের নমুনা')}</h2>
      <div><span>{t('Currently displayed example group price','বর্তমান নমুনা গ্রুপ মূল্য')}</span><b>{formatPrice(group)}</b></div>
      <div><span>{t('Example households participating','ডেমোতে অংশ নেওয়া পরিবার')}</span><b>{households}</b></div>
      <div><span>{t('Next household target','পরবর্তী পরিবারের লক্ষ্য')}</span><b>{nextThreshold||'—'}</b></div>
      <p>{remaining>0?t(`${remaining} more example households are needed for the next threshold; no further price is quoted.`,`পরের লক্ষ্য পূরণে আরও ${remaining}টি নমুনা পরিবার দরকার; পরবর্তী দাম এখনও নির্ধারিত নয়।`):t('Example threshold reached; next price has not been quoted.','ডেমোতে লক্ষ্য পূরণ; পরের দাম এখনও নির্ধারিত নয়।')}</p>
     </section>
     <div className="market-product-mode-selection">
      <label>{t('Quantity / packs','পরিমাণ / প্যাকেট')}</label>
      <div className="market-demo-quantity" role="group" aria-label={t('Product quantity','পণ্যের পরিমাণ')}>
       <button type="button" disabled={quantity===1} onClick={()=>setQuantity(v=>Math.max(1,v-1))} aria-label={t('Decrease quantity','পরিমাণ কমান')}>−</button>
       <output>{quantity}</output>
       <button type="button" disabled={quantity===20} onClick={()=>setQuantity(v=>Math.min(20,v+1))} aria-label={t('Increase quantity','পরিমাণ বাড়ান')}>+</button>
      </div>
     </div>
     <div className="market-demo-delivery" role="group" aria-label={t('Delivery choice','ডেলিভারি বাছুন')}>
      <label><input type="radio" name="product-delivery" checked={delivery==='pickup'} onChange={()=>setDelivery('pickup')}/>{t('Pickup · Free','পয়েন্ট থেকে সংগ্রহ · ফ্রি')}</label>
      <label><input type="radio" name="product-delivery" checked={delivery==='home'} onChange={()=>setDelivery('home')}/>{t('Home delivery · ৳20/৳30','হোম ডেলিভারি · ৳২০/৳৩০')}</label>
     </div>
     <div className="market-basket-totals">
      <div><span>{t('Product subtotal · sample','পণ্যমূল্য · নমুনা')}</span><b>{formatPrice(subtotal)}</b></div>
      <div><span>{t('Delivery · separate','ডেলিভারি · আলাদা')}</span><b>{formatPrice(deliveryCharge)}</b></div>
      <div><span>{t('Estimated demo total','মোট নমুনা হিসাব')}</span><b>{formatPrice(subtotal+deliveryCharge)}</b></div>
     </div>
     <div className="market-demo-buttons">
      <button type="button" className="btn-primary" onClick={()=>setCart(previous=>({...previous,[mode]:Math.min(20,previous[mode]+quantity)}))}>{t('Add to Demo Basket','ডেমো কার্টে যোগ করুন')}</button>
      <button disabled type="button" className="btn-secondary">{mode==='group'?t('Join Group · Unavailable','গ্রুপে যোগ দিন · বন্ধ'):t('Buy Now · Unavailable','এখন কিনুন · বন্ধ')}</button>
     </div>
     {(cart.solo>0||cart.group>0)&&<div className="market-demo-cart-preview" role="status">
      <strong>{t('On-screen demo basket · no real order','শুধু স্ক্রিনের ডেমো কার্ট · বাস্তব অর্ডার নয়')}</strong>
      {cart.solo>0&&<span>{t('Buy Alone','একা কেনা')}: {cart.solo} × {formatPrice(solo)} = {formatPrice(cart.solo*solo)}</span>}
      {cart.group>0&&<span>{t('Group Buy','গ্রুপ কেনা')}: {cart.group} × {formatPrice(group)} = {formatPrice(cart.group*group)}</span>}
      <b>{t('Demo total incl. delivery','ডেলিভারিসহ নমুনা মোট')}: {formatPrice(cartSubtotal+cartDelivery)}</b>
      <button type="button" onClick={()=>setCart({solo:0,group:0})}>{t('Clear demo basket','ডেমো কার্ট খালি করুন')}</button>
     </div>}
     <p className="market-demo-message">{t('Stock, delivery time, location eligibility, supplier assurance and refunds must be confirmed before a real product can be sold. No payment is available in this demo.','বিক্রির আগে মজুত, সরবরাহের সময়, এলাকার যোগ্যতা, সরবরাহকারী ও রিফান্ডের নিয়ম নিশ্চিত করতে হবে। ডেমোতে পেমেন্ট নেই।')}</p>
     <Link href="/" className="btn-secondary">{t('← Back to storefront','← দোকানের হোমপেজে ফিরুন')}</Link>
    </section>
   </div>
  </div>
 <PublicFooter language={lang}/>
 </main>
}
