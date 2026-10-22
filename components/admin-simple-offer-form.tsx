'use client'
import {useRef,useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import {saveSimpleOffer} from '@/app/actions/simple-offers'
type Product={id:string;name:string;package_size:string;image_url:string|null;available_quantity:number;price?:number;old_price?:number}
type Saved={id:string;kind:string;community_id:string;title:string;published:boolean;closes_at:string|null;simple_sale_offer_items:{product_id:string;price:number;old_price:number}[]}
export function AdminSimpleOfferForm({products,communities,offer}:{products:Product[];communities:{id:string;name:string}[];offer?:Saved}){
 const router=useRouter(),form=useRef<HTMLFormElement>(null)
 const [selected,setSelected]=useState<string[]>(offer?.simple_sale_offer_items.map(p=>p.product_id)??[])
 const [status,setStatus]=useState(''),[error,setError]=useState(''),[pending,start]=useTransition()
 const [savedId,setSavedId]=useState(offer?.id??'')
 return <form ref={form} className="card grid min-w-0 gap-4" onSubmit={e=>{
  e.preventDefault();if(pending)return;setError('');setStatus('')
  const fd=new FormData(e.currentTarget)
  fd.set('id',savedId)
  fd.set('items',JSON.stringify(selected.map(id=>({product_id:id,price:Number(fd.get('price:'+id)),old_price:Number(fd.get('old:'+id)||0),
   // Blank preserves the live shared balance, including orders placed since page load.
   available_quantity:String(fd.get('stock:'+id)??'').trim()||null}))))
  const closing=String(fd.get('closes_at')??'');if(closing)fd.set('closes_at',new Date(closing).toISOString())
  start(async()=>{try{const result=await saveSimpleOffer(fd);if(!result.ok){setError(result.message);return}setSavedId(result.id??savedId);setStatus(result.message);router.refresh()}catch{setError('Could not save. Your entries are still here; retry.')}})
 }} aria-label="Shared offer setup">
  <h2 className="section-title">{offer?'Edit offer':'Create offer'}</h2>
  {error&&<p role="alert" className="error">{error}</p>}{status&&<p role="status" className="success">{status}</p>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label><span className="label">Sale type</span><select name="kind" className="input" defaultValue={offer?.kind??'SOLO'}><option value="SOLO">Direct / Exclusive product</option><option value="GROUP_DEAL">Group Deal</option><option value="COMMUNITY_POOL">Community Pool</option></select></label>
   <label><span className="label">Community / area</span><select className="input" name="community_id" required defaultValue={offer?.community_id??''}><option value="" disabled>Choose area</option>{communities.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
   <label className="sm:col-span-2"><span className="label">Offer title</span><input className="input" name="title" required minLength={2} maxLength={180} defaultValue={offer?.title??''} placeholder="e.g. Weekly grocery offer"/></label>
  </div>
  <fieldset className="grid min-w-0 gap-3"><legend className="mb-2 font-bold">Select products and set prices · up to 6</legend>
   {products.map(p=>{const chosen=selected.includes(p.id),line=offer?.simple_sale_offer_items.find(i=>i.product_id===p.id);return <div className="rounded-2xl border p-3" key={p.id}>
    <label className="flex items-center gap-3"><input type="checkbox" checked={chosen} disabled={!chosen&&selected.length>=6} onChange={()=>setSelected(ids=>chosen?ids.filter(id=>id!==p.id):[...ids,p.id])}/>
     {p.image_url&&<img src={p.image_url} width={48} height={48} className="rounded-lg object-contain" alt=""/>}<span><b>{p.name}</b> · {p.package_size}<small className="block muted">Shared available: {p.available_quantity}</small></span></label>
    {chosen&&<div className="mt-3 grid gap-3 sm:grid-cols-3">
     <label><span className="label">Selling price (৳)</span><input className="input" type="number" min="0.01" max="9999999999" step="0.01" name={'price:'+p.id} defaultValue={line?.price??p.price??''} required/></label>
     <label><span className="label">Old price (optional)</span><input className="input" type="number" min="0" step="0.01" name={'old:'+p.id} defaultValue={line?.old_price??p.old_price??0}/></label>
     <label><span className="label">Set shared available (optional)</span><input className="input" type="number" min="0" max="2147483647" step="1" name={'stock:'+p.id} placeholder={'Keep current: '+p.available_quantity}/></label>
    </div>}
   </div>})}
  </fieldset>
  <label><span className="label">Closing time (optional · your local time)</span><input className="input" type="datetime-local" name="closes_at" defaultValue={offer?.closes_at?new Date(new Date(offer.closes_at).getTime()-new Date(offer.closes_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''}/></label>
  <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={offer?.published??false}/>Publish on website</label>
  <p className="muted text-sm">Orders use these prices and go to manual approval. Images come from the master product. Stock is shared across all three sale types.</p>
  <button type="submit" className="btn-primary" disabled={pending||!selected.length} aria-busy={pending}>{pending?'Saving…':'Save offer'}</button>
 </form>
}
