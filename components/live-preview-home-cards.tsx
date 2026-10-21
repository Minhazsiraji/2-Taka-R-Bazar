'use client'
import {useState} from 'react'
import Link from 'next/link'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import type {LiveHomepageData,PublicLiveOffer} from '@/lib/approved-live-detail-data'
import {publishedLiveOffers,publishedLivePools,confirmedOfferPrice,priceText} from '@/lib/approved-live-detail-data'
import {publicShowcaseImageUrl} from '@/lib/showcase-media'
import './home-card-preview.css'

type Props={section:'deals'|'exclusive'|'pools';language:MarketplaceLanguage;search:string;selectedArea:string;data:LiveHomepageData}
type ProductRow={id:string;name:string;bn:string;unit:string;image:string|null;offer:PublicLiveOffer|null;reference:number|null;solo:number|null;stock:number|null}
const max=(n:number,maxNum:number)=>Math.min(Math.max(n,0),maxNum)
function RealPhoto({name,url}:{name:string;url:string|null}){
 const [fail,setFail]=useState(false)
 const src=!fail&&url&&publicShowcaseImageUrl(url)?url:'/preview-app-product-placeholder.svg'
 return <img src={src} alt={name} className={src==='/preview-app-product-placeholder.svg'?'app-card-preview-placeholder':undefined}
  loading="lazy" width={240} height={320} decoding="async" onError={()=>setFail(true)}/>
}
export function LivePreviewHomeCards({section,language,search,selectedArea,data}:Props){
 const bn=language==='bn',t=(en:string,local:string)=>bn?local:en
 const money=(n:number|null)=>priceText(n,bn)
 const query=search.trim().toLowerCase()
 const [notice,setNotice]=useState('')
 const active=publishedLiveOffers(data.offers,selectedArea)
 const pools=publishedLivePools(data.pools,selectedArea)
 const deals=active.filter(o=>o.offer_kind==='GROUP_DEAL').filter(o=>
  !query||[o.product_name,o.product_name_bn,o.offer_title].some(s=>(s??'').toLowerCase().includes(query))).slice(0,6)
 const productMap=new Map<string,ProductRow>()
 const published=new Map(data.catalog.map(p=>[p.product_id,p]))
 const showcase=new Map(data.products.filter(p=>!p.is_demo).map(p=>[p.product_id,p]))
 for(const offer of active){
  const sku=published.get(offer.product_id),gallery=showcase.get(offer.product_id)
  if(!productMap.has(offer.product_id))productMap.set(offer.product_id,{id:offer.product_id,
   name:sku?.title_en||gallery?.name||offer.product_name,
   bn:sku?.title_bn||gallery?.name_bn||offer.product_name_bn||offer.product_name,
   unit:sku?.package_size||gallery?.package_size||offer.package_size,
   image:sku?.image_url||gallery?.image_url||offer.image_url,
   offer:null,reference:typeof offer.reference_price==='number'&&offer.reference_price>0?offer.reference_price:null,
   solo:null,stock:null})
  const record=productMap.get(offer.product_id)!
  if(offer.offer_kind==='SOLO'&&(!record.offer||record.offer.offer_kind!=='SOLO')){
   record.offer=offer
   record.solo=confirmedOfferPrice(offer)
   record.stock=typeof offer.commerce_available_quantity==='number'&&offer.commerce_available_quantity>=0?Math.max(0,offer.commerce_available_quantity):null
  }
 }
 for(const p of data.catalog){
  if(productMap.has(p.product_id))continue
  const gallery=showcase.get(p.product_id)
  productMap.set(p.product_id,{id:p.product_id,name:p.title_en,bn:p.title_bn,unit:p.package_size,
   image:p.image_url||gallery?.image_url||null,offer:null,reference:null,solo:null,stock:null})
 }
 for(const p of data.products.filter(x=>!x.is_demo)){
  if(!productMap.has(p.product_id))productMap.set(p.product_id,{id:p.product_id,name:p.name,bn:p.name_bn??p.name,unit:p.package_size,
   image:p.image_url,offer:null,reference:null,solo:null,stock:null})
 }
 const products=[...productMap.values()].filter(p=>
  !query||[p.name,p.bn,p.unit].some(s=>s.toLowerCase().includes(query))).slice(0,4)
 const note=(message:string)=>setNotice(message)
 const alert=()=>note(t('Preview details only. Buying and joining must use verified checkout.',
  'শুধু প্রিভিউ। কেনা ও যোগদানের জন্য যাচাইকৃত চেকআউট প্রয়োজন।'))
 const liveTag=<span className="app-card-preview-demo">{t('PUBLISHED','প্রকাশিত')}</span>
 const Progress=({current,target}:{current:number;target:number|null})=>target!==null&&target>0?
  <div className="app-card-preview-progress" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(current,target)}>
   <span style={{width:max(current/target*100,100)+'%'}}/></div>:null
 let cards
 if(section==='deals')cards=deals.length?
  <div className="mhome-deal-list app-card-preview app-card-preview-deals" data-preview-cards="deals">
   {deals.map(o=>{const p=productMap.get(o.product_id)
    const current=confirmedOfferPrice(o),reference=typeof o.reference_price==='number'&&o.reference_price>0?o.reference_price:null
    const saving=current!==null&&reference!==null&&reference>current?reference-current:null
    const route='/preview-live/product/'+o.product_id+'?kind=deal&offer='+o.offer_id
    const name=t(p?.name??o.product_name,p?.bn??o.product_name_bn??o.product_name)
    return <article key={o.offer_id+'-'+o.community_id} className="mhome-deal-card app-card-preview-deal">
     <div className="app-card-preview-deal-image"><RealPhoto url={p?.image??o.image_url} name={name}/><span className="app-card-preview-label">GROUP DEAL</span>{liveTag}</div>
     <div className="app-card-preview-copy"><div className="app-card-preview-heading">
      <div className="app-card-preview-overline">BUY TOGETHER • SAVE MORE</div>
      <h3>{name}</h3><p className="app-card-preview-meta">{o.package_size} · {o.offer_title}</p></div>
      <div className="app-card-preview-price"><strong>{money(current)}</strong>{reference!==null&&<s>{money(reference)}</s>}</div>
      {saving!==null&&<span className="app-card-preview-save">{t('Potential saving','সম্ভাব্য সাশ্রয়')} {money(saving)}</span>}
      <div className="app-card-preview-deal-stats"><span>👥 {o.buyer_count}{o.next_threshold?'/'+o.next_threshold:''} {t('joined','যুক্ত')}</span>
       <span>◷ {o.closes_at?new Date(o.closes_at).toLocaleDateString(bn?'bn-BD':'en-BD'):t('Date pending','সময় নির্ধারিত নয়')}</span></div>
      <Progress current={o.buyer_count} target={o.next_threshold}/>
      <div className="app-card-preview-actions"><Link href={route}>{t('View details','বিস্তারিত')}</Link>
       <button className="app-card-preview-primary" type="button" onClick={alert}>{t('Join Deal','গ্রুপে যোগ দিন')}</button></div>
     </div></article>})}
  </div>:<div className="mhome-empty">{t('No published Group Deals yet.','এখনো প্রকাশিত গ্রুপ ডিল নেই।')}</div>
 else if(section==='exclusive')cards=products.length?
  <div className="mhome-exclusive-grid app-card-preview app-card-preview-exclusive" data-preview-cards="exclusive">
   {products.map(p=>{const name=t(p.name,p.bn),route='/preview-live/product/'+p.id
    const save=p.reference!==null&&p.solo!==null&&p.reference>p.solo?p.reference-p.solo:null
    return <article className="mhome-exclusive-card app-card-preview-product" key={p.id}>
     <div className="app-card-preview-product-main"><div className="app-card-preview-product-image"><RealPhoto name={name} url={p.image}/>{liveTag}</div>
      <div className="app-card-preview-copy"><h3>{name}</h3><p className="app-card-preview-meta">{p.unit}</p>
       <div className="app-card-preview-price"><strong>{money(p.solo)}</strong>{p.reference!==null&&<s>{money(p.reference)}</s>}</div>
       {save!==null&&<span className="app-card-preview-save">{t('Potential saving','সম্ভাব্য সাশ্রয়')} {money(save)}</span>}
       <p className="app-card-preview-stock">{p.stock!==null?t('Available: ','স্টক: ')+p.stock:t('Stock not confirmed','স্টক নিশ্চিত নয়')}</p>
      </div></div>
     <div className="app-card-preview-actions"><Link href={route}>{t('View details','বিস্তারিত')}</Link>
      <button className="app-card-preview-primary" type="button" onClick={alert}>{t('Add to cart','কার্টে যোগ দিন')}</button></div>
    </article>})}
  </div>:<div className="mhome-empty">{t('No published products yet.','এখনো প্রকাশিত পণ্য নেই।')}</div>
 else cards=pools.length?<div className="mhome-pool-list app-card-preview app-card-preview-pools" data-preview-cards="pools">
  {pools.slice(0,2).map(pool=>{
   const items=pool.featuredProductIds.map(id=>pool.bundle.find(row=>row.offer.product_id===id)?.offer).filter((x):x is PublicLiveOffer=>!!x).slice(0,3)
   const photos=items.length?items:pool.bundle.slice(0,3).map(x=>x.offer)
   const deadline=[...new Set(pool.bundle.map(x=>x.offer.closes_at).filter(Boolean))]
   const closes=deadline.length===1?deadline[0]:null
   const target=typeof pool.minHouseholds==='number'&&pool.minHouseholds>0?pool.minHouseholds:null
   return <article className="mhome-pool-card app-card-preview-pool" key={pool.id}>
    <div className="app-card-preview-pool-photos">{photos.map(o=><div key={o.offer_id}><RealPhoto url={o.image_url} name={o.product_name}/></div>)}{liveTag}</div>
    <div className="app-card-preview-copy"><div className="app-card-preview-pool-top">
     <span className="app-card-preview-label">{t(pool.slug.toUpperCase()+' POOL',pool.slug==='weekly'?'সাপ্তাহিক পুল':pool.slug==='monthly'?'মাসিক পুল':'বিশেষ পুল')}</span>
     <span className="app-card-preview-active">● ACTIVE</span></div>
     <h3>{t(pool.title.en,pool.title.bn)}</h3><p className="app-card-preview-meta">{pool.bundle.length} {t('products','পণ্য')} · {pool.sampleHouseholds} {t('households joined','পরিবার যুক্ত')}</p>
     <Progress current={pool.sampleHouseholds} target={target}/>
     <p className="app-card-preview-deadline">◷ {closes?new Date(closes).toLocaleDateString(bn?'bn-BD':'en-BD'):t('Deadline not published','সময় প্রকাশিত হয়নি')}</p>
     <div className="app-card-preview-pool-bottom"><span className="app-card-preview-next">{target?t('Next milestone','পরবর্তী ধাপ')+': '+target:t('Next milestone not published','পরবর্তী ধাপ প্রকাশিত হয়নি')}</span>
      <Link href={'/preview-live/pool/'+pool.id} className="app-card-preview-primary mhome-pool-link">Explore Pool →</Link>
     </div>
    </div>
   </article>})}
  </div>:<div className="mhome-empty">{t('No published Community Pools yet.','এখনো প্রকাশিত কমিউনিটি পুল নেই।')}</div>
 return <>{cards}{notice&&<p role="status" className="app-card-preview-notice">{notice}</p>}</>
}
