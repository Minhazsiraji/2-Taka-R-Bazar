'use client'

import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {previewProducts,previewDeals,previewPools,previewPhoto,previewMoney as money} from '@/lib/home-card-preview-fixtures'
import './home-card-preview.css'

type Product=typeof previewProducts[number]
type Selection={kind:'deal';id:string}|null
type Props={section:'deals'|'exclusive'|'pools';language:MarketplaceLanguage;search:string}
function Photo({product}:{product:Product}){
 const [failed,setFailed]=useState(false)
 return <img src={failed?'/preview-app-product-placeholder.svg':previewPhoto(product.photo)}
  className={failed?'app-card-preview-placeholder':undefined} width="240" height="320"
  alt={product.name} loading="lazy" decoding="async" onError={()=>{if(!failed)setFailed(true)}}/>
}
function Progress({value,max,label}:{value:number;max:number;label:string}){
 return <div className="app-card-preview-progress" role="progressbar" aria-label={label}
  aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{width:Math.min(100,value/max*100)+'%'}}/></div>
}
function PreviewDialog({selection,language,onClose}:{selection:NonNullable<Selection>;language:MarketplaceLanguage;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null)
 const bn=language==='bn'
 const product=previewProducts.find(p=>p.id===selection.id)
 const deal=selection.kind==='deal'?previewDeals.find(p=>p.id===selection.id):undefined
 const title=product?(bn?product.nameBn:product.name):''
 useEffect(()=>{
  const dialog=ref.current
  dialog?.showModal()
  return()=>{if(dialog?.open)dialog.close()}
 },[])
 return <dialog ref={ref} className="app-card-preview-dialog" aria-label={title}
  onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div><button type="button" className="app-card-preview-close" onClick={onClose}>{bn?'বন্ধ করুন':'Close'} ×</button>
   <small>{bn?'ডেমো প্রিভিউ · বাস্তব অফার নয়':'DEMO PREVIEW · Not a real offer'}</small>
   <h3>{title}</h3>
   {product&&<><div className="app-card-preview-dialog-photo"><Photo product={product}/></div>
    <p>{product.unit} · Savar DOHS</p><p>{money(deal?.price??product.price)} <s>{money(product.oldPrice)}</s></p>
    <p>{bn?'সাশ্রয়':'Save'} {money(product.oldPrice-(deal?.price??product.price))}</p>
    {deal?<p>{deal.joined}/{deal.target} joined · Ends in {deal.days} days</p>:
     <p>{bn?'স্টকে আছে '+product.stock:'In stock · '+product.stock+' available'}</p>}</>}

   <p>{bn?'এটি শুধু ভিজুয়াল প্রিভিউ। কোনো বাস্তব অর্ডার বা যোগদানের অনুরোধ তৈরি হয় না।':'Visual preview only. No real order or participation request is created.'}</p>
  </div>
 </dialog>
}

export function PreviewHomeCards({section,language,search}:Props){
 const bn=language==='bn'
 const [selection,setSelection]=useState<Selection>(null)
 const [notice,setNotice]=useState('')
 const [basket,setBasket]=useState<Record<string,number>>({})
 const query=search.trim().toLocaleLowerCase()
 const matches=(p:Product)=>!query||[p.name,p.nameBn,p.unit].some(s=>s.toLocaleLowerCase().includes(query))
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer)},[notice])
 const demoLabel=<span className="app-card-preview-demo">{bn?'ডেমো':'DEMO'}</span>
 let cards
 if(section==='deals'){
  const rows=previewDeals.filter(d=>matches(previewProducts.find(p=>p.id===d.id)!))
  cards=rows.length?<div className="mhome-deal-list app-card-preview app-card-preview-deals" data-preview-cards="deals">
   {rows.map(d=>{const p=previewProducts.find(item=>item.id===d.id)!
    return <article className="mhome-deal-card app-card-preview-deal" key={d.id}>
     <div className="app-card-preview-deal-image">
      <Photo product={p}/><span className="app-card-preview-label">GROUP DEAL</span>{demoLabel}
     </div>
     <div className="app-card-preview-copy"><div className="app-card-preview-heading"><div className="app-card-preview-overline">BUY TOGETHER • SAVE MORE</div>
      <h3>{bn?(p.id==='rice'?'চিনিগুড়া চাল':p.nameBn):p.name}</h3>
      <p className="app-card-preview-meta">{p.unit} · Savar DOHS</p></div>
      <div className="app-card-preview-price"><strong>{money(d.price)}</strong><s>{money(p.oldPrice)}</s></div>
      <span className="app-card-preview-save">{bn?'সাশ্রয়':'Save'} {money(p.oldPrice-d.price)}</span>
      <div className="app-card-preview-deal-stats"><span>👥 {d.joined}/{d.target} joined</span><span>◷ Ends in {d.days} {d.days===1?'day':'days'}</span></div>
      <Progress value={d.joined} max={d.target} label={bn?'গ্রুপ অংশগ্রহণ':'Group participation'}/>
      <div className="app-card-preview-actions"><Link href={'/demo-product/'+d.id+'?kind=deal'}>{bn?'বিস্তারিত':'View details'}</Link>
       <button type="button" className="app-card-preview-primary" onClick={()=>setSelection({kind:'deal',id:d.id})}>{bn?'গ্রুপে যোগ দিন':'Join Deal'}</button></div>
     </div>
    </article>})}
  </div>:<div className="mhome-empty">{bn?'এই খোঁজে গ্রুপ ডিল নেই।':'No Group Deals match your search.'}</div>
 }else if(section==='exclusive'){
  const rows=previewProducts.filter(matches)
  cards=rows.length?<div className="mhome-exclusive-grid app-card-preview app-card-preview-exclusive" data-preview-cards="exclusive">
   {rows.map(p=><article className="mhome-exclusive-card app-card-preview-product" key={p.id}>
    <div className="app-card-preview-product-main"><div className="app-card-preview-product-image"><Photo product={p}/>{demoLabel}</div>
     <div className="app-card-preview-copy"><h3>{bn?p.nameBn:p.name}</h3><p className="app-card-preview-meta">{p.unit}</p>
      <div className="app-card-preview-price"><strong>{money(p.price)}</strong><s>{money(p.oldPrice)}</s></div>
      <span className="app-card-preview-save">{bn?'সাশ্রয়':'Save'} {money(p.oldPrice-p.price)}</span>
      <p className="app-card-preview-stock">{bn?'স্টকে আছে '+p.stock:'In stock · '+p.stock+' available'}</p>
     </div>
    </div>
    <div className="app-card-preview-actions"><Link href={'/demo-product/'+p.id}>{bn?'বিস্তারিত':'View details'}</Link>
     <button className="app-card-preview-primary" type="button" onClick={()=>{
      const count=(basket[p.id]??0)+1;setBasket(previous=>({...previous,[p.id]:count}))
      setNotice(bn?'ডেমো ঝুড়িতে '+count+'টি যোগ হয়েছে। বাস্তব কার্ট পরিবর্তন হয়নি।':'Added '+count+' to the preview basket. Your real cart is unchanged.')
     }}>{bn?'কার্টে যোগ দিন':'Add to cart'}</button></div>
   </article>)}
  </div>:<div className="mhome-empty">{bn?'আপনার খোঁজের সঙ্গে কোনো পণ্য মেলেনি।':'No products match your search.'}</div>
 }else{
  cards=<div className="mhome-pool-list app-card-preview app-card-preview-pools" data-preview-cards="pools">
   {previewPools.map(pool=><article className="mhome-pool-card app-card-preview-pool" key={pool.id}>
    <div className="app-card-preview-pool-photos">{pool.products.map(id=>{
     const p=previewProducts.find(item=>item.id===id)!
     return <div key={id}><Photo product={p}/></div>
    })}{demoLabel}</div>
    <div className="app-card-preview-copy"><div className="app-card-preview-pool-top"><span className="app-card-preview-label">{bn?pool.labelBn:pool.label}</span><span className="app-card-preview-active"><span aria-hidden="true">● </span>ACTIVE</span></div>
     <h3>{bn?pool.nameBn:pool.name}</h3>
     <p className="app-card-preview-meta">{bn?'3 টি পণ্য · '+pool.joined.toLocaleString('en-BD')+' পরিবারের যুক্ত':'3 products · '+pool.joined.toLocaleString('en-BD')+' households joined'}</p>
     <Progress value={pool.joined} max={pool.target} label={bn?'অংশগ্রহণের অগ্রগতি':'Household progress'}/>
     <p className="app-card-preview-deadline">◷ Commit ends in {pool.days} days · {pool.date}</p>
     <div className="app-card-preview-pool-bottom"><span className="app-card-preview-next">{bn?'পরবর্তী সাশ্রয় টিয়ার':'Next savings tier'}: {pool.target.toLocaleString('en-BD')}</span>
      <Link href={'/demo-pool/'+pool.id+'?source=home'} className="app-card-preview-primary mhome-pool-link">{bn?'পুল দেখুন':'Explore Pool'} →</Link></div>
    </div>
   </article>)}
  </div>
 }
 return <>{cards}
  {selection&&<PreviewDialog selection={selection} language={language} onClose={()=>setSelection(null)}/>}
  {notice&&<div className="app-card-preview-notice" role="status">{notice}</div>}
 </>
}
