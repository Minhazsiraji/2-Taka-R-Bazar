'use client'
import {useState} from 'react'
import Link from 'next/link'
import type {DemoFeaturedPool} from '@/lib/featured-pools'
import {demoPoolBasketTotal,demoPoolTierState,demoPoolTierThresholds,demoPoolTierFactor,demoPoolUnitPrice} from '@/lib/featured-pools'
import {formatPrice} from '@/lib/storefront'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'

type Delivery='pickup'|'home'
const clamp=(n:number)=>Math.min(20,Math.max(0,Math.round(n)))
export function DemoPoolDetail({pool}:{pool:DemoFeaturedPool}){
 const [language,setLanguage]=useState<MarketplaceLanguage>('bn')
 const [quantities,setQuantities]=useState<Record<string,number>>(
  Object.fromEntries(pool.bundle.map(({offer,qty})=>[offer.product_id,qty]))
 )
 const [cart,setCart]=useState<Record<string,number>>({})
 const [delivery,setDelivery]=useState<Delivery>('pickup')
 const [status,setStatus]=useState('')
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const tier=demoPoolTierState(pool)
 const tiers=demoPoolTierThresholds(pool)
 const selectedItems=pool.bundle.filter(({offer})=>(quantities[offer.product_id]??0)>0)
 const itemCount=selectedItems.reduce((sum,{offer})=>sum+(quantities[offer.product_id]??0),0)
 const currentTotal=demoPoolBasketTotal(pool,tier.current,quantities)
 const nextTotal=tier.upcoming===null?null:demoPoolBasketTotal(pool,tier.upcoming,quantities)
 const soloTotal=pool.bundle.reduce((sum,{offer})=>sum+(quantities[offer.product_id]??0)*(Number(offer.solo_price)||0),0)
 const saving=Math.max(0,soloTotal-currentTotal)
 const deliveryFee=delivery==='pickup'||currentTotal===0?0:currentTotal<=1000?20:30
 const cartUnits=Object.values(cart).reduce((sum,qty)=>sum+qty,0)
 const cartTotal=demoPoolBasketTotal(pool,tier.current,cart)
 const cartDelivery=delivery==='pickup'||cartTotal===0?0:cartTotal<=1000?20:30
 const progress=Math.min(100,Math.round(pool.sampleHouseholds/pool.minHouseholds*100))
 function adjust(id:string,step:number){
  setQuantities(previous=>({...previous,[id]:clamp((previous[id]??0)+step)}))
  setStatus('')
 }
 function addOne(id:string){
  const qty=quantities[id]??0
  if(qty<=0)return
  setCart(previous=>({...previous,[id]:clamp((previous[id]??0)+qty)}))
  setStatus(t('Added to your on-screen demo basket; no real cart or order was created.','স্ক্রিনের ডেমো বাস্কেটে যোগ হয়েছে; বাস্তব কার্ট বা অর্ডার তৈরি হয়নি।'))
 }
 function addBundle(){
  if(!itemCount)return
  setCart(previous=>{
   const next={...previous}
   for(const {offer} of selectedItems)next[offer.product_id]=clamp((next[offer.product_id]??0)+(quantities[offer.product_id]??0))
   return next
  })
  setStatus(t('Selected items added to the demo basket. No checkout or payment is available.','পণ্য ডেমো বাস্কেটে যোগ হয়েছে। চেকআউট বা পেমেন্ট চালু নেই।'))
 }
 return <main className="public-marketplace-flat market-pool-detail-page min-h-screen">
  <header className="market-pool-detail-header">
   <Link href="/" className="market-pool-home-link">← 2-TAKA-R-BAZAR</Link>
   <div className="market-language-toggle" role="group" aria-label="Language / ভাষা">
    <button type="button" aria-pressed={language==='bn'} onClick={()=>setLanguage('bn')}>বাংলা</button>
    <button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button>
   </div>
  </header>
  <div className="market-pool-detail-content" lang={language}>
   <div className="market-demo-detail-banner" role="status">{t('DEMO ONLY — fictional households, prices and quantities. No live availability, order or payment.','শুধু ডেমো — পরিবার, মূল্য ও পরিমাণ কাল্পনিক। বাস্তব মজুত, অর্ডার বা পেমেন্ট নেই।')}</div>
   <div className="market-pool-detail-intro market-ui-card">
    <img src={pool.image} alt={t(pool.title.en,pool.title.bn)}/>
    <div>
     <span className="market-featured-pool-eyebrow">DEMO / নমুনা · {pool.slug.toUpperCase()} POOL</span>
     <h1>{t(pool.title.en,pool.title.bn)}</h1>
     <p>{t(pool.description.en,pool.description.bn)}</p>
     <div className="market-pool-detail-stats">
      <div><span>{t('Current unlocked example','বর্তমানে আনলক · ডেমো')}</span><b>{formatPrice(tier.currentPrice)}</b></div>
      <div><span>{t('Next potential example','পরবর্তী সম্ভাব্য · ডেমো')}</span><b>{tier.nextPrice===null?'—':formatPrice(tier.nextPrice)}</b></div>
      <div><span>{t('Example households','নমুনা পরিবার')}</span><b>{pool.sampleHouseholds}/{pool.minHouseholds}</b></div>
     </div>
     <div className="market-tier-progress">
      <div className="market-tier-track" role="progressbar" aria-valuemin={0} aria-valuemax={pool.minHouseholds} aria-valuenow={pool.sampleHouseholds} aria-label={t('Example household progress','নমুনা পরিবারের অগ্রগতি')}><span style={{width:`${progress}%`}}/></div>
      <p>{tier.upcoming?t(`${tier.householdsNeeded} more households needed for the next illustrative price.`,`পরের নমুনা দাম পেতে আরও ${tier.householdsNeeded} পরিবার দরকার।`):t('Example final tier reached.','নমুনায় সর্বশেষ স্তর অর্জিত।')}</p>
     </div>
    </div>
   </div>
   <div className="market-shopper-essentials">
    <div><b>{t('Service area','সেবার এলাকা')}</b><span>{t('Choose and verify your community before joining','যোগ দেওয়ার আগে কমিউনিটি নির্বাচন ও যাচাই করুন')}</span></div>
    <div><b>{t('Order window','অর্ডারের সময়সীমা')}</b><span>{t('Not scheduled · demonstration','নির্ধারিত নয় · ডেমো')}</span></div>
    <div><b>{t('Collection / delivery','সংগ্রহ / ডেলিভারি')}</b><span>{t('Date and location confirmed only when a real Pool opens','বাস্তব পুল চালু হলে দিন ও স্থান নিশ্চিত হবে')}</span></div>
    <div><b>{t('If target is not reached','লক্ষ্য পূরণ না হলে')}</b><span>{t('No automatic payment; next steps must be confirmed','স্বয়ংক্রিয় টাকা কাটা নয়; পরবর্তী ধাপ নিশ্চিত করতে হবে')}</span></div>
   </div>
   <section className="market-pool-detail-section">
    <h2>{t('See exactly how the example prices unlock','নমুনা মূল্য কীভাবে আনলক হবে দেখুন')}</h2>
    <div className="market-tier-table-wrap"><table className="market-tier-table">
     <thead><tr><th>{t('Households','পরিবার')}</th><th>{t('Example basket price','নমুনা বাজারের দাম')}</th><th>{t('Status','অবস্থা')}</th></tr></thead>
     <tbody>{tiers.map(threshold=><tr key={threshold} data-current={tier.current===threshold}>
      <td>{threshold===1?'1+':`${threshold}+`}</td>
      <td>{formatPrice(demoPoolBasketTotal(pool,threshold))}</td>
      <td>{tier.current===threshold?t('Current example tier','বর্তমান নমুনা স্তর'):tier.upcoming===threshold?t('Next potential tier','পরবর্তী সম্ভাব্য স্তর'):threshold<tier.current?t('Earlier tier','আগের স্তর'):t('Future tier · conditional','ভবিষ্যৎ স্তর · শর্তসাপেক্ষ')}</td>
     </tr>)}</tbody>
    </table></div>
    <p className="market-demo-disclaimer">{t('Prices are illustrative, not quotes. Real tiers must be backed by supplier pricing, eligibility, group commitments and confirmed fulfillment.','এগুলো প্রকৃত অফার নয়, শুধু উদাহরণ। বাস্তব দাম নির্ভর করবে সরবরাহকারীর কোটেশন, যোগ্যতা, অংশগ্রহণ ও সরবরাহ নিশ্চিত হওয়ার ওপর।')}</p>
   </section>
   <section className="market-pool-detail-section">
    <h2>{t('Choose products & quantities','পণ্য ও পরিমাণ নির্বাচন করুন')}</h2>
    <p className="market-demo-disclaimer">{t('Change quantities to preview your basket total. Each item is optional in this UI example.','পরিমাণ কমবেশি করে মোট দাম দেখুন। এই ডেমোতে প্রতিটি পণ্য ঐচ্ছিক।')}</p>
    <div className="market-pool-detail-items">{pool.bundle.map(({offer})=>{
     const qty=quantities[offer.product_id]??0
     const unit=demoPoolUnitPrice(offer,demoPoolTierFactor(pool,tier.current))
     return <article key={offer.product_id} className="market-pool-detail-item market-ui-card">
      <Link href={`/demo-product/${offer.product_id}`}><img src={offer.image_url??'/grocery-hero-glass.svg'} alt={t(offer.product_name,offer.product_name_bn??offer.product_name)}/></Link>
      <div className="market-pool-detail-item-info">
       <h3>{t(offer.product_name,offer.product_name_bn??offer.product_name)}</h3>
       <p>{offer.package_size} · {t('Current sample unit','নমুনা ইউনিট মূল্য')} {formatPrice(unit)}</p>
       <Link href={`/demo-product/${offer.product_id}`}>{t('See product details','পণ্যের বিস্তারিত দেখুন')} →</Link>
      </div>
      <div className="market-pool-detail-item-controls">
       <div className="market-demo-quantity" role="group" aria-label={t('Quantity for ','পরিমাণ: ')+t(offer.product_name,offer.product_name_bn??offer.product_name)}>
        <button type="button" onClick={()=>adjust(offer.product_id,-1)} disabled={qty===0} aria-label={t('Decrease quantity','পরিমাণ কমান')}>−</button><output>{qty}</output>
        <button type="button" onClick={()=>adjust(offer.product_id,1)} disabled={qty===20} aria-label={t('Increase quantity','পরিমাণ বাড়ান')}>+</button>
       </div>
       <strong>{formatPrice(unit*qty)}</strong>
       <button type="button" className="market-demo-add-line" onClick={()=>addOne(offer.product_id)} disabled={qty===0}>{t('Add to demo basket','ডেমো কার্টে যোগ')}</button>
      </div>
     </article>
    })}</div>
   </section>
   <section className="market-pool-detail-section market-pool-detail-terms market-ui-card">
    <h2>{t('Your basket estimate · DEMO','আপনার বাজারের হিসাব · ডেমো')}</h2>
    <div className="market-basket-totals">
     <div><span>{t('Selected units','নির্বাচিত ইউনিট')}</span><b>{itemCount}</b></div>
     <div><span>{t('Solo-price comparison','একা কেনার তুলনামূলক দাম')}</span><b>{formatPrice(soloTotal)}</b></div>
     <div><span>{t('Current sample tier subtotal','বর্তমান নমুনা পণ্যমূল্য')}</span><b>{formatPrice(currentTotal)}</b></div>
     <div><span>{t('Potential next-tier subtotal','পরবর্তী সম্ভাব্য দাম')}</span><b>{nextTotal===null?'—':formatPrice(nextTotal)}</b></div>
     <div><span>{t('Illustrative product saving','নমুনা পণ্যের সাশ্রয়')}</span><b>{formatPrice(saving)}</b></div>
    </div>
    <div className="market-demo-delivery" role="group" aria-label={t('Delivery option','ডেলিভারি পদ্ধতি')}>
     <label><input type="radio" name="demo-delivery" checked={delivery==='pickup'} onChange={()=>setDelivery('pickup')}/>{t('Community pickup · Free','কমিউনিটি পয়েন্ট থেকে সংগ্রহ · ফ্রি')}</label>
     <label><input type="radio" name="demo-delivery" checked={delivery==='home'} onChange={()=>setDelivery('home')}/>{t('Home delivery · ৳20/৳30','হোম ডেলিভারি · ৳২০/৳৩০')}</label>
    </div>
    <div className="market-basket-grand"><span>{t('Demo total (products + delivery)','ডেমো মোট (পণ্য + ডেলিভারি)')}</span><strong>{formatPrice(currentTotal+deliveryFee)}</strong></div>
    <p className="market-demo-disclaimer">{t('Delivery: free community pickup; home delivery within community ৳20 for subtotals of ৳1,000 or less, ৳30 above ৳1,000. Charges are separate from savings.','ডেলিভারি: কমিউনিটি পয়েন্টে ফ্রি; বাসায় ৳১,০০০ পর্যন্ত পণ্যে ৳২০, তার বেশি হলে ৳৩০। ডেলিভারি সাশ্রয় থেকে আলাদা।')}</p>
    <button type="button" className="btn-primary" onClick={addBundle} disabled={itemCount===0}>{t('Add selected items to Demo Basket','নির্বাচিত পণ্য ডেমো কার্টে যোগ করুন')}</button>
    <div aria-live="polite" className="market-demo-status">{status}</div>
    {cartUnits>0&&<div className="market-demo-cart-preview">
     <strong>{t('On-screen demo basket · no real cart created','শুধু স্ক্রিনের ডেমো কার্ট · বাস্তব কার্ট নয়')}</strong>
     <span>{cartUnits} {t('units','ইউনিট')} · {formatPrice(cartTotal)} + {formatPrice(cartDelivery)} {t('delivery','ডেলিভারি')} = {formatPrice(cartTotal+cartDelivery)}</span>
     <button type="button" onClick={()=>{setCart({});setStatus('')}}>{t('Clear preview basket','ডেমো কার্ট খালি করুন')}</button>
    </div>}
    <button type="button" disabled aria-disabled="true" className="btn-secondary">{t('Join / Buy · unavailable in Demo','যোগ দিন / কিনুন · ডেমোতে বন্ধ')}</button>
    <Link href="/" className="btn-secondary">{t('Return to storefront','দোকানে ফিরুন')}</Link>
   </section>
  </div>
 </main>
}
