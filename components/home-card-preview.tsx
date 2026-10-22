'use client'

import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {joinSimpleSaleDeal} from '@/app/actions/simple-offer-joins'
import {addLaunchItem,readLaunchCart} from '@/lib/launch-cart'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {previewProducts,previewDeals,previewPools,previewPhoto,previewMoney as money} from '@/lib/home-card-preview-fixtures'
import type {ApprovedProduct,ApprovedHomeView,ApprovedDeal,ApprovedPool} from '@/lib/approved-card-view'
import './home-card-preview.css'
import './approved-data-state.css'

type Product=ApprovedProduct
type Selection={kind:'deal';id:string}|null
type Props={section:'deals'|'exclusive'|'pools';language:MarketplaceLanguage;search:string;view?:ApprovedHomeView;selectedArea?:string}
function Photo({product}:{product:Product}){
 const [failed,setFailed]=useState(false)
 const src=product.image!==undefined?product.image:previewPhoto(product.photo)
 return <img data-empty={failed||!src||undefined} src={failed||!src?'/preview-app-product-placeholder.svg':src}
  className={failed||!src?'app-card-preview-placeholder':undefined} width="240" height="320"
  alt={product.name} loading="lazy" decoding="async" onError={()=>{if(!failed)setFailed(true)}}/>
}
function Progress({value,max,label}:{value:number;max:number;label:string}){
 return <div className="app-card-preview-progress" role="progressbar" aria-label={label}
  aria-valuemin={0} aria-valuemax={Math.max(1,max,value)} aria-valuenow={value}><span style={{width:(max>0?Math.min(100,value/max*100):0)+'%'}}/></div>
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
    <p>{product.unit} · Savar DOHS</p><p>{money(deal?.price??product.price??0)} <s>{money(product.oldPrice??0)}</s></p>
    <p>{bn?'সাশ্রয়':'Save'} {money((product.oldPrice??0)-(deal?.price??product.price??0))}</p>
    {deal?<p>{deal.joined}/{deal.target} joined · Ends in {deal.days} days</p>:
     <p>{bn?'স্টকে আছে '+product.stock:'In stock · '+product.stock+' available'}</p>}</>}

   <p>{bn?'এটি শুধু ভিজুয়াল প্রিভিউ। কোনো বাস্তব অর্ডার বা যোগদানের অনুরোধ তৈরি হয় না।':'Visual preview only. No real order or participation request is created.'}</p>
  </div>
 </dialog>
}

export function PreviewHomeCards({section,language,search,view,selectedArea=''}:Props){
 const router=useRouter()
 const [joining,setJoining]=useState('')
 const bn=language==='bn'
 const [selection,setSelection]=useState<Selection>(null)
 const [notice,setNotice]=useState('')
 const [basket,setBasket]=useState<Record<string,number>>({})
 const query=search.trim().toLocaleLowerCase()
 const matches=(p:Product)=>!query||[p.name,p.nameBn,p.unit].some(s=>s.toLocaleLowerCase().includes(query))
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer)},[notice])
 const rowsProducts:readonly ApprovedProduct[]=view?.products??previewProducts
 const lookup:readonly ApprovedProduct[]=view?.lookup??previewProducts
 const rowsDeals:readonly ApprovedDeal[]=view?.deals??previewDeals
 const rowsPools:readonly ApprovedPool[]=view?.pools??previewPools
 const showMoney=(n:number|null)=>money(n??0)
 const productHref=(id:string,kind='')=>view?'/preview-live/product/'+id+(kind?'?kind='+kind:''):'/demo-product/'+id+(kind?'?kind='+kind:'')
 const demoLabel=view?null:<span className="app-card-preview-demo">{bn?'ডেমো':'DEMO'}</span>
 let cards
 if(section==='deals'){
  const rows=rowsDeals.filter(d=>matches(lookup.find(p=>p.id===d.id)!))
  cards=rows.length?<div className="mhome-deal-list app-card-preview app-card-preview-deals" data-preview-cards="deals">
   {rows.map(d=>{const p=lookup.find(item=>item.id===d.id)!
    const reference=view?(d.reference??null):p.oldPrice
    return <article className="mhome-deal-card app-card-preview-deal" key={d.id+('offerId' in d?d.offerId:'')} data-empty={d.empty||undefined} inert={d.empty||undefined}>
     <div className="app-card-preview-deal-image">
      <Photo product={p}/><span className="app-card-preview-label">GROUP DEAL</span>{demoLabel}
     </div>
     <div className="app-card-preview-copy"><div className="app-card-preview-heading"><div className="app-card-preview-overline">BUY TOGETHER • SAVE MORE</div>
      <h3>{bn?(p.id==='rice'?'চিনিগুড়া চাল':p.nameBn):p.name}</h3>
      <p className="app-card-preview-meta">{p.unit} · {view?(d.community||' '):'Savar DOHS'}</p></div>
      <div className="app-card-preview-price"><strong data-empty={d.price===null||undefined}>{showMoney(d.price)}</strong><s data-empty={reference===null||undefined}>{showMoney(reference)}</s></div>
      <span className="app-card-preview-save" data-empty={reference===null||d.price===null||undefined}>{bn?'সাশ্রয়':'Save'} {showMoney(reference!==null&&d.price!==null?Math.max(0,reference-d.price):null)}</span>
      <div className="app-card-preview-deal-stats"><span>👥 {d.joined}{d.target>0||!d.launchOfferId?'/'+d.target:''} joined</span><span>{d.nextPrice!=null&&d.target>0?`${bn?'পরবর্তী':'Next'} ${d.target} → ${showMoney(d.nextPrice)}${d.reference!=null&&d.reference>0?` · ${bn?'সাশ্রয়':'Save'} ${showMoney(Math.max(0,d.reference-d.nextPrice))}`:''}`:view&&d.target>0?`${bn?'পরবর্তী লক্ষ্য':'Next target'}: ${d.target} · ${bn?'টিয়ার সাশ্রয় নির্ধারিত হয়নি':'Tier savings not set'}`:d.days!==null?`◷ ${view?(bn?'শেষ':'Ends in'):'Ends in'} ${d.days} ${d.days===1?'day':'days'}`:bn?'শেষের তারিখ নেই':'No end date set'}</span></div>
      <Progress value={d.joined} max={d.target} label={bn?'গ্রুপ অংশগ্রহণ':'Group participation'}/>
      <div className="app-card-preview-actions"><Link href={d.empty?'#':productHref(d.id,'deal')+(view&&d.offerId?'&offer='+d.offerId:'')+(view&&selectedArea?'&area='+encodeURIComponent(selectedArea):'')}>{bn?'বিস্তারিত':'View details'}</Link>
       <button type="button" className="app-card-preview-primary" disabled={Boolean(view)&&(!d.purchasable||joining===d.offerId)} onClick={async()=>{
        if(d.launchOfferId&&d.offerId){
         setJoining(d.offerId)
         try{
          const result=await joinSimpleSaleDeal(d.offerId,d.id,selectedArea)
          if(result.ok){
           if(!readLaunchCart().some(i=>i.product_id===d.id&&i.offer_id===d.launchOfferId))addLaunchItem(d.id,d.launchOfferId)
           setNotice(bn?'গ্রুপ ডিলে যোগ দিয়েছেন। কার্টে যোগ হয়েছে।':'Joined Group Deal and added to cart. Checkout is still required.')
           window.dispatchEvent(new Event('2tbr-notifications-refresh'))
           router.refresh()
          }else{
           setNotice(result.message)
           if(result.code==='SIGN_IN')router.push('/login?next=%2F')
          }
         }catch{setNotice('Could not join this Group Deal. Please retry.')}
         finally{setJoining('')}
         return
        }
        if(!view)setSelection({kind:'deal',id:d.id})
       }}>{bn?'গ্রুপে যোগ দিন':'Join Deal'}</button></div>
     </div>
    </article>})}
  </div>:view?<div className="mhome-empty" data-empty="true"> </div>:<div className="mhome-empty">{bn?'এই খোঁজে গ্রুপ ডিল নেই।':'No Group Deals match your search.'}</div>
 }else if(section==='exclusive'){
  const rows=rowsProducts.filter(matches)
  cards=rows.length?<div className="mhome-exclusive-grid app-card-preview app-card-preview-exclusive" data-preview-cards="exclusive">
   {rows.map(p=><article className="mhome-exclusive-card app-card-preview-product" key={p.id} data-empty={p.empty||undefined} inert={p.empty||undefined}>
    <div className="app-card-preview-product-main"><div className="app-card-preview-product-image"><Photo product={p}/>{demoLabel}</div>
     <div className="app-card-preview-copy"><h3>{bn?p.nameBn:p.name}</h3><p className="app-card-preview-meta">{p.unit}</p>
      <div className="app-card-preview-price"><strong data-empty={p.price===null||undefined}>{showMoney(p.price)}</strong><s data-empty={p.oldPrice===null||undefined}>{showMoney(p.oldPrice)}</s></div>
      <span className="app-card-preview-save" data-empty={p.oldPrice===null||p.price===null||undefined}>{bn?'সাশ্রয়':'Save'} {showMoney(p.oldPrice!==null&&p.price!==null?Math.max(0,p.oldPrice-p.price):null)}</span>
      <p className="app-card-preview-stock" data-empty={p.stock===null||undefined}>{bn?'স্টকে আছে '+(p.stock??0):'In stock · '+(p.stock??0)+' available'}</p>
     </div>
    </div>
    <div className="app-card-preview-actions"><Link href={p.empty?'#':productHref(p.id)}>{bn?'বিস্তারিত':'View details'}</Link>
     <button className="app-card-preview-primary" type="button" disabled={Boolean(view)&&!p.purchasable} onClick={()=>{
      if(p.purchasable){addLaunchItem(p.id,p.launchOfferId);setNotice(bn?'কার্টে যোগ হয়েছে।':'Added to cart.');return}
      const count=(basket[p.id]??0)+1;setBasket(previous=>({...previous,[p.id]:count}))
      setNotice(bn?'ডেমো ঝুড়িতে '+count+'টি যোগ হয়েছে। বাস্তব কার্ট পরিবর্তন হয়নি।':'Added '+count+' to the preview basket. Your real cart is unchanged.')
     }}>{bn?'কার্টে যোগ দিন':'Add to cart'}</button></div>
   </article>)}
  </div>:view?<div className="mhome-empty" data-empty="true"> </div>:<div className="mhome-empty">{bn?'আপনার খোঁজের সঙ্গে কোনো পণ্য মেলেনি।':'No products match your search.'}</div>
 }else{
  cards=<div className="mhome-pool-list app-card-preview app-card-preview-pools" data-preview-cards="pools">
   {rowsPools.map(pool=><article className="mhome-pool-card app-card-preview-pool" key={pool.id} data-empty={pool.empty||undefined} inert={pool.empty||undefined}>
    <div className="app-card-preview-pool-photos">{pool.products.map(id=>{
     const p=lookup.find(item=>item.id===id)!
     return <div key={id}><Photo product={p}/></div>
    })}{demoLabel}</div>
    <div className="app-card-preview-copy"><div className="app-card-preview-pool-top"><span className="app-card-preview-label">{bn?pool.labelBn:pool.label}</span><span className="app-card-preview-active"><span aria-hidden="true">● </span>ACTIVE</span></div>
     <h3>{bn?pool.nameBn:pool.name}</h3>
     <p className="app-card-preview-meta">{bn?(pool.productCount??3)+' টি পণ্য · '+pool.joined.toLocaleString('en-BD')+' পরিবারের যুক্ত':(pool.productCount??3)+' products · '+pool.joined.toLocaleString('en-BD')+' households joined'}</p>
     <Progress value={pool.joined} max={pool.target} label={bn?'অংশগ্রহণের অগ্রগতি':'Household progress'}/>
     <p className="app-card-preview-deadline">{pool.days!==null?`◷ ${bn?'শেষ হতে':'Commit ends in'} ${pool.days} ${bn?'দিন':'days'} · ${pool.date}`:bn?'শেষের তারিখ দেওয়া নেই':'No closing date set'}</p>
     <div className="app-card-preview-pool-bottom"><span className="app-card-preview-next">{pool.wholePoolNext?`${bn?'পরবর্তী':'Next'} ${pool.wholePoolNext.target} → ${bn?'সম্পূর্ণ পুল':'whole Pool'} ${showMoney(pool.wholePoolNext.total)}${pool.wholePoolNext.savings!==null?` · ${bn?'মোট সাশ্রয়':'total saving'} ${showMoney(pool.wholePoolNext.savings)}`:''}`:pool.target>0?`${bn?'পরবর্তী লক্ষ্য':'Next target'}: ${pool.target.toLocaleString('en-BD')} · ${bn?'আনলক মূল্য নির্ধারিত হয়নি':'Unlock price not configured'}`:bn?'টিয়ার নির্ধারিত হয়নি':'Tier not configured'}</span>
      <Link href={pool.empty?'#':view?'/preview-live/pool/'+pool.id:'/demo-pool/'+pool.id+'?source=home'} className="app-card-preview-primary mhome-pool-link">Explore Pool →</Link></div>
    </div>
   </article>)}
  </div>
 }
 return <div data-approved-data={view?true:undefined}>{cards}
  {selection&&<PreviewDialog selection={selection} language={language} onClose={()=>setSelection(null)}/>}
  {notice&&<div className="app-card-preview-notice" role="status">{notice}</div>}
 </div>
}
