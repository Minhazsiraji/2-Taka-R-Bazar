'use client'

import Link from 'next/link'
import type {ReactNode} from 'react'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {formatPrice} from '@/lib/storefront'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'
import {SITE_TAGLINE_BN,SITE_TAGLINE_EN} from '@/lib/site'

type Props={areas:StorefrontArea[];offers:StorefrontOffer[];selectedArea:string;authenticated:boolean;
 onChooseArea:(id:string)=>void;language:MarketplaceLanguage;demoMode?:boolean}

const steps=[
 {number:'01',en:'Find your neighbourhood',bn:'আপনার এলাকা বাছুন',d:'Browse available products in your community. No account is needed to look.',db:'আপনার এলাকার পণ্য দেখুন। শুধু দেখার জন্য অ্যাকাউন্ট দরকার নেই।'},
 {number:'02',en:'Compare two prices',bn:'দুইভাবে দাম দেখুন',d:'See Buy Alone and Group Buy. Unconfirmed group prices are clearly labelled.',db:'একা কেনা ও গ্রুপে কেনার দাম দেখুন। অনিশ্চিত গ্রুপ মূল্য আলাদা করে দেখানো হবে।'},
 {number:'03',en:'Verify when buying',bn:'কেনার সময় যাচাই করুন',d:'Use mobile OTP only when buying or joining. Group eligibility needs a verified area.',db:'কেনা বা যোগ দেওয়ার সময় মোবাইল OTP দিন। গ্রুপে যোগ দিতে এলাকা যাচাই প্রয়োজন।'},
 {number:'04',en:'Collect or get delivery',bn:'সংগ্রহ বা হোম ডেলিভারি',d:'Collect free at the community point, or pay the separate home-delivery charge.',db:'কমিউনিটি পয়েন্ট থেকে বিনা ফিতে নিন, অথবা আলাদা ফি দিয়ে বাসায় নিন।'},
] as const
const benefits=[
 {icon:'◉',en:'No fake savings',bn:'ভুয়া সাশ্রয় নয়',d:'Prices and verified savings remain separate. There are no invented discounts.',db:'মূল্য ও যাচাইকৃত সাশ্রয় আলাদা থাকবে। কাল্পনিক ছাড় দেখানো হবে না।'},
 {icon:'⇄',en:'Two buying modes',bn:'দুইভাবে কেনাকাটা',d:'Buy Alone will cover stocked and approved supplier products. Groups combine buying power.',db:'একা কেনায় নিজস্ব স্টক ও অনুমোদিত সরবরাহকারীর পণ্য থাকবে। গ্রুপ কেনায় একসঙ্গে দাম কমানোর সুযোগ।'},
 {icon:'⌂',en:'Free community pickup',bn:'ফ্রি কমিউনিটি সংগ্রহ',d:'Pickup at an active community point has no charge. Home delivery is optional.',db:'সক্রিয় কমিউনিটি পয়েন্ট থেকে সংগ্রহ ফ্রি। বাসায় ডেলিভারি চাইলে আলাদা ফি।'},
 {icon:'✓',en:'Verified participation',bn:'যাচাইকৃত অংশগ্রহণ',d:'Secure OTP and eligibility checks protect local group buying.',db:'মোবাইল OTP ও এলাকা যাচাইয়ের মাধ্যমে স্থানীয় গ্রুপ কেনাকাটা সুরক্ষিত থাকে।'},
] as const
const faqs=[
 {q:'Can I browse without signing in?',qb:'লগইন ছাড়াই পণ্য দেখতে পারব?',a:'Yes. Browse free. OTP is only needed when you join or buy.',ab:'হ্যাঁ। লগইন ছাড়াই পণ্য ও দাম দেখতে পারবেন। কেনা বা যোগ দেওয়ার সময় OTP লাগবে।'},
 {q:'What is Buy Alone vs Group Buy?',qb:'একা কেনা ও গ্রুপে কেনার পার্থক্য কী?',a:'Buy Alone has a separately approved price. Community Pools aggregate household quantities, while Group Deals unlock thresholds with verified participants.',ab:'একা কেনার দাম আলাদাভাবে অনুমোদিত হয়। কমিউনিটি পুলে চাহিদা একত্র হয়, আর গ্রুপ ডিলে যাচাইকৃত ক্রেতার সংখ্যা অনুযায়ী মূল্য পরিবর্তিত হয়।'},
 {q:'Will suppliers sell through Buy Alone?',qb:'সরবরাহকারীর পণ্য কি একা কেনা যাবে?',a:'Both 2TBR stock and verified supplier-listed products are planned. Actual solo checkout still requires inventory and finance controls.',ab:'নিজস্ব স্টক ও অনুমোদিত সরবরাহকারীর পণ্য—দুই ধরনেরই পরিকল্পনা আছে। একা কেনার চেকআউট এখনও পরীক্ষাধীন।'},
 {q:'What are the delivery fees?',qb:'ডেলিভারি খরচ কত?',a:'Community-point pickup is free. Within-community delivery is ৳20 up to ৳1,000 product subtotal and ৳30 above ৳1,000.',ab:'কমিউনিটি পয়েন্টে সংগ্রহ ফ্রি। কমিউনিটির মধ্যে ৳১,০০০ পর্যন্ত অর্ডারে ৳২০, তার বেশি হলে ৳৩০ হোম ডেলিভারি।'},
 {q:'What if the group threshold is not reached?',qb:'গ্রুপের নির্ধারিত সংখ্যা পূরণ না হলে কী হবে?',a:'A group does not become a paid order automatically. Only confirmed amounts and eligible commitments can proceed.',ab:'গ্রুপের সংখ্যা পূরণ না হলে স্বয়ংক্রিয়ভাবে অর্থপ্রদত্ত অর্ডার হয় না। শর্ত পূরণ ও নিশ্চিতকরণের পরই পরবর্তী ধাপ।'},
 {q:'Does the app track GPS constantly?',qb:'অ্যাপ কি সবসময় GPS ট্র্যাক করে?',a:'No continuous guest tracking. A one-time browser location request helps suggest an area. Manual selection remains available.',ab:'না। একবার ব্রাউজার লোকেশন চাইতে পারে, শুধু কাছের এলাকা খুঁজতে। চাইলে নিজে এলাকা বেছে নিন।'},
 {q:'How can I request a refund or return?',qb:'পণ্য ফেরত বা রিফান্ড কীভাবে পাব?',a:'Refer to the published return and refund policies and the order issue process.',ab:'রিটার্ন ও রিফান্ড নীতিমালা দেখুন এবং অর্ডারের সমস্যার জন্য নির্ধারিত প্রক্রিয়া ব্যবহার করুন।'},
] as const

function Eyebrow({children}:{children:ReactNode}){return <p className="market-story-eyebrow">{children}</p>}
function Heading({title,description}:{title:string;description?:string}) {
 return <div className="market-story-heading"><h2>{title}</h2>{description&&<p className="market-story-description">{description}</p>}</div>
}
export function PublicMarketplaceLower({areas,offers,selectedArea,authenticated,onChooseArea,language,demoMode=false}:Props){
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const inArea=offers.filter(o=>!selectedArea||o.community_id===selectedArea)
 const popular=[...inArea].sort((a,b)=>Number(b.buyer_count)-Number(a.buyer_count)||Number(b.quantity_joined)-Number(a.quantity_joined)).filter(o=>Number(o.buyer_count)>0).slice(0,4)
 const areaCards=areas.map(area=>({...area,live:offers.filter(o=>o.community_id===area.community_id).length}))
 return <div className="market-story" lang={language}>
  <section id="popular-nearby" className="market-story-section market-band"><div className="market-content">
   <Eyebrow>{demoMode?t('Illustrative design activity · DEMO','ডিজাইনের নমুনা · ডেমো'):t('Real local buying activity','স্থানীয় কেনাকাটার তথ্য')}</Eyebrow>
   <Heading title={t('Popular in your community','আপনার এলাকায় জনপ্রিয়')} description={demoMode?t('Illustrative counters, not real participation.','নমুনা সংখ্যা; প্রকৃত অংশগ্রহণ নয়।'):t('Qualified buyers from open, eligible local offers.','চলমান স্থানীয় অফারের যাচাইকৃত ক্রেতার সংখ্যা।')}/>
   {popular.length>0?<div className="market-popular-grid">{popular.map(offer=>
    <Link key={offer.offer_kind+offer.offer_id+offer.community_id} href={(offer.is_demo?'/demo-product/':'/shop/')+offer.product_id} className="market-popular-card">
     <div className="market-popular-image">{offer.image_url?<img alt={t(offer.product_name,offer.product_name_bn??offer.product_name)} src={offer.image_url} loading="lazy"/>:<img src="/grocery-hero-glass.svg" alt=""/>}</div>
     <div><span className="market-story-eyebrow">{offer.is_demo?'DEMO / নমুনা':offer.offer_kind==='GROUP_DEAL'?t('Group Deal','গ্রুপ ডিল'):t('Community Pool','কমিউনিটি পুল')}</span>
      <h3>{t(offer.product_name,offer.product_name_bn??offer.product_name)}</h3>
      <p className="market-story-description">{Number(offer.buyer_count)} {t('buyers','জন ক্রেতা')} · {Number(offer.quantity_joined)} {t('units','ইউনিট')} {offer.is_demo?'(DEMO)':''}</p>
      <b>{formatPrice(offer.confirmed_price??offer.upcoming_price)}</b>
      <p className="market-small-note">{offer.is_demo?t('Sample price only','শুধু নমুনা মূল্য'):t('Published or pending tier price','প্রকাশিত বা অপেক্ষমাণ দাম')}</p>
     </div>
    </Link>)}</div>
   :<div className="market-empty-real"><span aria-hidden="true">◎</span><div><b>{t('No active popular items yet','এখনও জনপ্রিয় কোনো সক্রিয় পণ্য নেই')}</b><p>{t('Verified activity will appear once customers join live offers.','সক্রিয় অফারে গ্রাহক যোগ দিলে এখানে প্রকৃত তথ্য দেখানো হবে।')}</p></div><a href="#deals">{t('See available offers →','পণ্য দেখুন →')}</a></div>}
  </div></section>

  <section id="how-it-works" className="market-story-section market-band"><div className="market-content">
   <Eyebrow>{t('Simple, open and community-first','সহজ, স্বচ্ছ ও কমিউনিটি-ভিত্তিক')}</Eyebrow>
   <Heading title={t('How 2-TAKA-R-BAZAR works','2-TAKA-R-BAZAR যেভাবে কাজ করে')} description={t('Browse, compare, verify and collect.','পণ্য দেখুন, দাম তুলনা করুন, যাচাই করুন, সংগ্রহ করুন।')}/>
   <div className="market-steps-grid">{steps.map(s=><article className="market-step" key={s.number}><span className="market-step-number">{s.number}</span><h3>{t(s.en,s.bn)}</h3><p>{t(s.d,s.db)}</p></article>)}</div>
   <div className="market-dual-flow">
    <div><span className="market-dual-chip">{t('Buy Alone','একা কিনুন')}</span><h3>{t('Your basket, your price','নিজের পণ্য, নিজের দাম')}</h3>
     <p>{t('Both 2TBR-stocked products and verified supplier products are planned for individual ordering.','নিজস্ব স্টক ও যাচাইকৃত সরবরাহকারীর পণ্য একা কেনার সুবিধা চালুর পরিকল্পনা আছে।')}</p>
     <span className="market-small-note">{t('Individual checkout is not open yet.','একা কেনার চেকআউট এখনও চালু হয়নি।')}</span></div>
    <div><span className="market-dual-chip">{t('Group Buy','গ্রুপে কিনুন')}</span><h3>{t('Buy together, save together','একসঙ্গে কিনি, সাশ্রয় করি')}</h3>
     <p>{t('Community Pools combine demand and Group Deals unlock price tiers. You confirm only your own share.','কমিউনিটি পুলে চাহিদা একত্র হয়, গ্রুপ ডিলে ক্রেতা বাড়লে দাম কমতে পারে। নিজস্ব অংশই নিশ্চিত করতে হয়।')}</p>
     <a href="#deals">{t('Explore group opportunities →','গ্রুপ ডিল দেখুন →')}</a></div>
   </div>
  </div></section>

  <section id="our-communities" className="market-story-section market-band"><div className="market-content">
   <Eyebrow>{t('Shop in your area','নিজের এলাকায় কেনাকাটা')}</Eyebrow>
   <Heading title={t('Choose your community','আপনার কমিউনিটি বেছে নিন')} description={demoMode?t('Sample areas for Preview; not active communities.','প্রিভিউয়ের জন্য নমুনা এলাকা; সক্রিয় কমিউনিটি নয়।'):t('Your selected area filters eligible offers.','নির্বাচিত এলাকা অনুযায়ী উপযুক্ত অফার দেখানো হবে।')}/>
   {areaCards.length>0?<div className="market-area-grid">{areaCards.map(area=><button key={area.community_id} type="button" onClick={()=>{
    onChooseArea(area.community_id)
    document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'})
   }} className={'market-area-card '+(selectedArea===area.community_id?'is-selected':'')} aria-pressed={selectedArea===area.community_id}>
    <span className="market-area-icon" aria-hidden="true">⌖</span><strong>{area.community_name}</strong>
    <span>{demoMode?t('Demo community / sample deals only','নমুনা কমিউনিটি / ডেমো ডিল'):area.live>0?area.live+' '+t('active offers','সক্রিয় অফার'):t('No active offers yet','এখনও সক্রিয় অফার নেই')}</span>
    <small>{t('View area offers →','এলাকার অফার দেখুন →')}</small>
   </button>)}</div>:<p className="market-empty-real">{t('No operating communities have been published yet.','এখনও কোনো চালু কমিউনিটি প্রকাশিত হয়নি।')}</p>}
   <p className="market-small-note mt-4">{t('Official building QR invitations are separate from verified group membership.','বিল্ডিংয়ের অফিসিয়াল QR আমন্ত্রণ ও যাচাইকৃত গ্রুপ সদস্যপদ আলাদা বিষয়।')}</p>
  </div></section>

  <section id="why-2tbr" className="market-story-section market-band"><div className="market-content">
   <Eyebrow>{t('Clear benefits','স্পষ্ট সুবিধা')}</Eyebrow>
   <Heading title={t('Why shop with 2-TAKA-R-BAZAR?','কেন 2-TAKA-R-BAZAR-এ কিনবেন?')} description={t('Understand savings before confirming your order.','অর্ডার নিশ্চিত করার আগেই সম্ভাব্য সাশ্রয় বুঝে নিন।')}/>
   <div className="market-benefits-grid">{benefits.map(b=><article className="market-benefit" key={b.en}><span className="market-benefit-icon" aria-hidden="true">{b.icon}</span><h3>{t(b.en,b.bn)}</h3><p>{t(b.d,b.db)}</p></article>)}</div>
   <div className="market-delivery-panel">
    <div><span className="market-story-eyebrow">{t('Your delivery choices','ডেলিভারি সুবিধা')}</span>
     <h3>{t('Delivery costs are separate from savings.','ডেলিভারি খরচ ও পণ্যের সাশ্রয় আলাদা।')}</h3>
     <p>{t('Product savings exclude delivery charges.','পণ্যের সাশ্রয় হিসাবের সঙ্গে ডেলিভারি ফি মেশানো হবে না।')}</p></div>
    <div className="market-delivery-rates"><div><b>{t('Free','ফ্রি')}</b><span>{t('Community-point pickup','কমিউনিটি পয়েন্টে সংগ্রহ')}</span></div>
     <div><b>৳20</b><span>{t('Home delivery · basket ৳1,000 or less','হোম ডেলিভারি · ৳১,০০০ বা কম')}</span></div>
     <div><b>৳30</b><span>{t('Home delivery · basket over ৳1,000','হোম ডেলিভারি · ৳১,০০০-এর বেশি')}</span></div></div>
   </div>
  </div></section>

  <section id="customer-experiences" className="market-story-section market-band"><div className="market-content">
   <Eyebrow>{t('Trust must be earned','বিশ্বাস অর্জন করতে হয়')}</Eyebrow>
   <Heading title={t('Customer experiences','গ্রাহকদের অভিজ্ঞতা')} description={t('Only real, consented and moderated feedback is published.','শুধু প্রকৃত, অনুমতিপ্রাপ্ত ও যাচাইকৃত মতামত প্রকাশিত হবে।')}/>
   <div className="market-review-pending">
    <div className="market-review-mark" aria-hidden="true">“</div><div>
     <h3>{t('Real reviews are coming as the pilot grows.','পাইলট এগোলে গ্রাহকদের প্রকৃত মতামত আসবে।')}</h3>
     <p>{t('We haven’t published any customer testimonials yet. No borrowed quotes, invented customers, fabricated ratings or unverified savings will be displayed here.','এখনও কোনো গ্রাহকের প্রকাশযোগ্য মতামত নেই। এখানে কল্পিত রিভিউ, নাম, রেটিং বা সাশ্রয় দেখানো হবে না।')}</p>
     <Link href={authenticated?'/feedback':'/signup'}>{authenticated?t('Share your feedback','মতামত দিন'):t('Join your community','কমিউনিটিতে যোগ দিন')} →</Link>
    </div><span className="market-review-note">{t('Verified purchases only','শুধু যাচাইকৃত ক্রয়')}</span>
   </div>
  </div></section>

  <section id="supplier-network" className="market-story-section market-band"><div className="market-content">
   <Eyebrow>{t('Two sources · One shopping experience','দুই উৎস · একই কেনাকাটার অভিজ্ঞতা')}</Eyebrow>
   <Heading title={t('Our products & supply partners','আমাদের পণ্য ও সরবরাহকারী')} description={t('Buy Alone will support both our own stock and approved suppliers.','একা কেনায় নিজস্ব স্টক ও অনুমোদিত সরবরাহকারী—দুই ধরনের পণ্যই থাকবে।')}/>
   <div className="market-supply-grid">
    <article><span className="market-supply-icon" aria-hidden="true">▣</span><h3>{t('2TBR-stocked products','2TBR-এর নিজস্ব স্টকের পণ্য')}</h3><p>{t('Products stocked and monitored by 2TBR, with receiving, price and inventory controls.','2TBR-এর গুদামে থাকা পণ্য, যেগুলোর মজুত, গ্রহণ ও মূল্য যাচাই করা হয়।')}</p><span>{t('Owned stock · Verified availability','নিজস্ব স্টক · যাচাইকৃত মজুত')}</span></article>
    <article><span className="market-supply-icon" aria-hidden="true">◈</span><h3>{t('Verified supplier-listed products','যাচাইকৃত সরবরাহকারীর পণ্য')}</h3><p>{t('Partner products need confirmed availability, fulfillment, return and payment controls.','পার্টনার পণ্যের জন্য মজুত, ডেলিভারি, রিটার্ন ও অর্থপ্রদানের যাচাই প্রয়োজন।')}</p><span>{t('Partner stock · Confirmed supply','পার্টনার স্টক · নিশ্চিত সরবরাহ')}</span></article>
   </div>
   <div className="market-supplier-cta"><div><strong>{t('Are you a supplier, brand or producer?','আপনি কি সরবরাহকারী, ব্র্যান্ড বা উৎপাদক?')}</strong>
    <p>{t('Tell our team about your products and capacity. Approval is required before listings go live.','আপনার পণ্য ও সরবরাহ সক্ষমতা আমাদের জানান। তালিকাভুক্তির আগে অনুমোদন প্রয়োজন।')}</p></div>
    <a href="mailto:business@agentsiraji.com?subject=2TBR%20Supplier%20Partnership" className="btn-secondary">{t('Become a supply partner →','সরবরাহকারী হতে যোগাযোগ করুন →')}</a></div>
  </div></section>

  <section id="marketplace-faq" className="market-story-section market-band"><div className="market-content">
   <Eyebrow>{t('Answers before checkout','অর্ডারের আগে জেনে নিন')}</Eyebrow>
   <Heading title={t('Frequently asked questions','সাধারণ প্রশ্নোত্তর')}/>
   <div className="market-faqs">{faqs.map(f=><details key={f.q} className="market-faq">
    <summary><span>{t(f.q,f.qb)}</span><span aria-hidden="true" className="market-faq-arrow">+</span></summary><p>{t(f.a,f.ab)}</p>
   </details>)}</div>
   <p className="market-small-note mt-4">{t('Read our published','বিস্তারিত পড়ুন:')} <Link href="/faq">FAQ</Link>, <Link href="/return-policy">{t('Return Policy','রিটার্ন নীতি')}</Link> {t('and','এবং')} <Link href="/refund-policy">{t('Refund Policy','রিফান্ড নীতি')}</Link>.</p>
  </div></section>

  <section className="market-closing market-band"><div className="market-content market-closing-inner">
   <div><span className="market-story-eyebrow">{t('Start shopping together','একসাথে কেনাকাটা শুরু করুন')}</span>
    <h2>{t(SITE_TAGLINE_EN,SITE_TAGLINE_BN)}</h2><p>{t('Find your local offer or join the next opportunity.','আপনার এলাকার অফার দেখুন অথবা পরবর্তী কেনাকাটার সুযোগের জন্য যোগ দিন।')}</p></div>
   <div className="market-closing-actions"><a href="#deals" className="btn-primary">{t('Explore products','পণ্য দেখুন')}</a>
    <Link href={authenticated?'/home':'/signup'} className="btn-secondary">{authenticated?t('My dashboard','আমার ড্যাশবোর্ড'):t('Join the community','কমিউনিটিতে যোগ দিন')}</Link></div>
  </div></section>
 </div>
}
