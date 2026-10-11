'use client'

import Link from 'next/link'
import type {ReactNode} from 'react'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {formatPrice} from '@/lib/storefront'
import {SITE_TAGLINE_BN,SITE_TAGLINE_EN} from '@/lib/site'

type Props={
  areas:StorefrontArea[]
  offers:StorefrontOffer[]
  selectedArea:string
  authenticated:boolean
  onChooseArea:(id:string)=>void
}

const steps=[
  {number:'01',title:'Find your neighbourhood',bn:'আপনার এলাকা বাছুন',description:'Explore real available products in your selected area. No account or location permission is needed to browse.'},
  {number:'02',title:'Compare the two prices',bn:'দুইভাবে দাম দেখুন',description:'Choose Buy Alone or join a Community Pool / Group Deal. Only approved individual and earned group prices are shown as confirmed.'},
  {number:'03',title:'Verify when you are ready',bn:'কেনার সময় যাচাই করুন',description:'Use mobile OTP when you want to transact. Nearby Group Deals also require valid community location verification.'},
  {number:'04',title:'Collect or request delivery',bn:'সংগ্রহ বা হোম ডেলিভারি',description:'Confirm your own quantity and final price. Community-point collection is free; optional home delivery has a separate visible fee.'},
] as const

const benefits=[
  {icon:'◉',title:'No invented discounts',bn:'ভুয়া সাশ্রয় নয়',description:'Market benchmarks and selling prices are distinguished. Savings are verified after successful fulfilment.'},
  {icon:'⇄',title:'Two ways to buy',bn:'একা অথবা একসাথে',description:'Group Deals and Community Pools combine buying power. Buy Alone is being prepared for stocked and approved supplier-listed products.'},
  {icon:'⌂',title:'Free community collection',bn:'কমিউনিটি পয়েন্টে ফ্রি',description:'Pick up at your enabled community point at no collection fee. Choose optional within-community home delivery instead.'},
  {icon:'✓',title:'Verified buying process',bn:'নিরাপদ কেনাকাটা',description:'OTP and eligibility checks protect group participation. You confirm what belongs to your household—not a whole group’s basket.'},
] as const

const faqs=[
  {question:'Can I browse without signing in?',answer:'Yes. Browse products, operating areas, public deal prices and qualified buyer counts freely. Mobile OTP is required only before buying or joining.'},
  {question:'What is the difference between Buy Alone, Community Pool and Group Deal?',answer:'Buy Alone uses a separately confirmed individual price and stock check. A Community Pool gathers household quantities before final procurement pricing. A Group Deal combines verified nearby buyers to unlock specific price tiers. Individual checkout is still being implemented.'},
  {question:'Will Buy Alone include supplier products?',answer:'Yes. Both 2-TAKA-R-BAZAR-stocked and approved supplier-listed items are in scope. A supplier-listed item will need a verified availability and fulfilment commitment before an individual purchase is accepted.'},
  {question:'How much does delivery cost?',answer:'Collection from an enabled community delivery point is free. Optional home delivery within the community costs ৳20 for a product basket of ৳1,000 or less and ৳30 when it is above ৳1,000. Delivery is shown separately from product savings.'},
  {question:'What happens if a group does not reach its threshold?',answer:'A Group Deal that does not qualify closes without silently creating a paid order. Community Pool demand is not a purchase: its customer must explicitly confirm after the final price is published. Consult the live offer status for the exact next step.'},
  {question:'Does the website track my precise GPS location?',answer:'No continuous tracking is used for guest browsing. You can select your area manually. The browser requests location only when you click the location button, and the guest location match runs on your device. The secured Group Deal qualification step is separate and requires login.'},
  {question:'Can I cancel, return or report an issue?',answer:'Issues and remedies are governed by the published Return and Refund Policies. Use the order issue flow after signing in; do not assume an unqualified group commitment is a paid order.'},
] as const

function Eyebrow({children}:{children:ReactNode}){
  return <p className="market-story-eyebrow">{children}</p>
}
function Heading({english,bangla,description}:{english:string;bangla:string;description?:string}){
  return <div className="market-story-heading"><h2>{english}</h2><p lang="bn" className="market-story-bn">{bangla}</p>{description&&<p className="market-story-description">{description}</p>}</div>
}

export function PublicMarketplaceLower({areas,offers,selectedArea,authenticated,onChooseArea}:Props){
  const inArea=offers.filter(o=>!selectedArea||o.community_id===selectedArea)
  const popular=[...inArea].sort((a,b)=>Number(b.buyer_count)-Number(a.buyer_count)||Number(b.quantity_joined)-Number(a.quantity_joined)).filter(o=>Number(o.buyer_count)>0).slice(0,4)
  const areaCards=areas.map(area=>({...area,live:offers.filter(o=>o.community_id===area.community_id).length}))
  return <div className="market-story mx-auto max-w-6xl px-5 pb-10 md:px-8">
    <section id="popular-nearby" className="market-story-section">
      <Eyebrow>Real local buying activity</Eyebrow>
      <Heading english="Popular in your community" bangla="আপনার এলাকায় জনপ্রিয়" description="Qualified buyers and actual order interest from currently open, eligible offers—not simulated social activity."/>
      {popular.length>0?<div className="market-popular-grid">
        {popular.map(offer=><Link key={offer.offer_kind+offer.offer_id+offer.community_id} href={'/shop/'+offer.product_id+'?area='+offer.community_id} className="market-popular-card">
          <div className="market-popular-image">{offer.image_url?<img alt={offer.product_name} src={offer.image_url} loading="lazy"/>:<img src="/grocery-hero-glass.svg" alt="" loading="lazy"/>}</div>
          <div><span className="market-story-eyebrow">{offer.offer_kind==='GROUP_DEAL'?'Group Deal':'Community Pool'}</span><h3>{offer.product_name}</h3><p className="market-story-description">{Number(offer.buyer_count)} qualified {Number(offer.buyer_count)===1?'buyer':'buyers'} · {Number(offer.quantity_joined)} units</p><b>{formatPrice(offer.confirmed_price??offer.upcoming_price)}</b><p className="market-small-note">{offer.confirmed_price?'Published or unlocked price':'Potential next-tier price; not yet confirmed'}</p></div>
        </Link>)}
      </div>:<div className="market-empty-real"><span aria-hidden="true">◎</span><div><b>Your community’s next popular product starts with real demand.</b><p>We will show verified participation here as soon as eligible people join an open offer. No sample purchases or invented activity.</p></div><a href="#deals">See available offers →</a></div>}
    </section>

    <section id="how-it-works" className="market-story-section">
      <Eyebrow>Simple, open and community-first</Eyebrow>
      <Heading english="How 2-TAKA-R-BAZAR works" bangla="কীভাবে কাজ করে" description="Browse first. Compare prices. Verify when you decide. Receive only what you order."/>
      <div className="market-steps-grid">{steps.map(step=><article key={step.number} className="market-step">
        <span className="market-step-number">{step.number}</span><h3>{step.title}</h3><p className="market-story-bn" lang="bn">{step.bn}</p><p>{step.description}</p>
      </article>)}</div>
      <div className="market-dual-flow">
        <div><span className="market-dual-chip">Buy Alone</span><h3>One basket. Your confirmed price.</h3><p>Both 2TBR-owned stock and verified supplier-listed goods will be eligible after the dedicated solo checkout and availability controls pass testing.</p><span className="market-small-note">Individual checkout is not open yet.</span></div>
        <div><span className="market-dual-chip">Group Buy</span><h3>Join neighbours. Unlock together.</h3><p>Community Pools build demand before the final price; Group Deals count verified nearby buyers toward price tiers. You pay only for your own confirmed order.</p><a href="#deals">Explore group opportunities →</a></div>
      </div>
    </section>

    <section id="our-communities" className="market-story-section">
      <Eyebrow>Local before national</Eyebrow>
      <Heading english="Choose your community" bangla="আপনার কমিউনিটি বেছে নিন" description="Community selection changes the offers you see. A listed community does not necessarily have a live deal at this moment."/>
      {areaCards.length>0?<div className="market-area-grid">{areaCards.map(area=><button key={area.community_id} type="button" onClick={()=>{
        onChooseArea(area.community_id)
        document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'})
      }} className={'market-area-card '+(selectedArea===area.community_id?'is-selected':'')} aria-pressed={selectedArea===area.community_id}>
        <span className="market-area-icon" aria-hidden="true">⌖</span>
        <strong>{area.community_name}</strong><span>{area.live>0?area.live+' current public '+(area.live===1?'offer':'offers'):'Area listed · deals not open yet'}</span><small>View area offers →</small>
      </button>)}</div>:<p className="market-empty-real">No operating communities have been published yet. Please check back after community setup.</p>}
      <p className="market-small-note mt-4">You may also scan an official building/community QR poster to enter its dedicated onboarding flow. QR scanning alone never joins a group or places an order.</p>
    </section>

    <section id="why-2tbr" className="market-story-section">
      <Eyebrow>Why households choose this approach</Eyebrow>
      <Heading english="Why shop with 2-TAKA-R-BAZAR?" bangla="কেন 2-TAKA-R-BAZAR?" description="Real savings should be easy to understand before an order—not a surprise after checkout."/>
      <div className="market-benefits-grid">{benefits.map(benefit=><article className="market-benefit" key={benefit.title}>
        <span className="market-benefit-icon" aria-hidden="true">{benefit.icon}</span>
        <h3>{benefit.title}</h3><p lang="bn" className="market-story-bn">{benefit.bn}</p><p>{benefit.description}</p>
      </article>)}</div>
      <div className="market-delivery-panel">
        <div><span className="market-story-eyebrow">Your delivery choices</span><h3>Product savings and delivery cost are separate.</h3><p>We do not call a delivery charge a discount, and pickup charges do not hide inside a product price.</p></div>
        <div className="market-delivery-rates"><div><b>Free</b><span>Community-point pickup</span></div><div><b>৳20</b><span>Home delivery · basket ৳1,000 or less</span></div><div><b>৳30</b><span>Home delivery · basket over ৳1,000</span></div></div>
      </div>
    </section>

    <section id="customer-experiences" className="market-story-section">
      <Eyebrow>Trust must be earned</Eyebrow>
      <Heading english="Customer experiences" bangla="গ্রাহকরা যা বলছেন" description="We publish authentic reviews only after a completed order, specific publication consent and moderation."/>
      <div className="market-review-pending">
        <div className="market-review-mark" aria-hidden="true">“</div>
        <div><h3>Real reviews are coming as the pilot grows.</h3><p>We haven’t published any customer testimonials yet. No borrowed quotes, invented customers, fabricated ratings or unverified savings will be displayed here.</p>
          <Link href={authenticated?'/feedback':'/signup'}>{authenticated?'Share feedback on a completed order':'Join your community'} →</Link></div>
        <span className="market-review-note">Verified purchases only</span>
      </div>
    </section>

    <section id="supplier-network" className="market-story-section">
      <Eyebrow>Two sources · One clear customer experience</Eyebrow>
      <Heading english="Our products & supply partners" bangla="আমাদের পণ্য ও সরবরাহকারী" description="Buy Alone will support both 2TBR-held inventory and products supplied by approved partner companies."/>
      <div className="market-supply-grid">
        <article><span className="market-supply-icon" aria-hidden="true">▣</span><h3>2TBR-stocked products</h3><p>Products we physically stock and manage through receiving, inventory, pricing, safe reservations and community handover.</p><span>Owned stock · Verified availability</span></article>
        <article><span className="market-supply-icon" aria-hidden="true">◈</span><h3>Verified supplier-listed products</h3><p>Partner-listed items will require supplier authorization, current price and availability, fulfillment commitments, returns ownership and reconciliation checks.</p><span>Partner stock · Confirmed supply</span></article>
      </div>
      <div className="market-supplier-cta"><div><strong>Are you a supplier, brand or local producer?</strong><p>Tell our operations team about your products, supply capacity and service area. Approval is required before listings go live.</p></div>
       <a href="mailto:business@agentsiraji.com?subject=2TBR%20Supplier%20Partnership" className="btn-secondary">Become a supply partner →</a></div>
    </section>

    <section id="marketplace-faq" className="market-story-section">
      <Eyebrow>Clear answers before checkout</Eyebrow>
      <Heading english="Frequently asked questions" bangla="সাধারণ প্রশ্নোত্তর"/>
      <div className="market-faqs">{faqs.map(faq=><details key={faq.question} className="market-faq">
        <summary><span>{faq.question}</span><span aria-hidden="true" className="market-faq-arrow">+</span></summary>
        <p>{faq.answer}</p>
      </details>)}</div>
      <p className="market-small-note mt-4">For the full terms, read our <Link href="/faq">FAQ</Link>, <Link href="/return-policy">Return Policy</Link> and <Link href="/refund-policy">Refund Policy</Link>.</p>
    </section>

    <section className="market-closing">
      <div><span className="market-story-eyebrow">Ready for smarter local shopping?</span><h2>{SITE_TAGLINE_EN}</h2><p lang="bn">{SITE_TAGLINE_BN}</p><p>Find an actual offer in your community, or sign up with your mobile number to get ready for the next buying opportunity.</p></div>
      <div className="market-closing-actions"><a href="#deals" className="btn-primary">Explore local products</a><Link href={authenticated?'/home':'/signup'} className="btn-secondary">{authenticated?'My dashboard':'Join the community'}</Link></div>
    </section>
  </div>
}
