'use client'

import {useEffect,useRef,useState,useTransition} from 'react'
import type {FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {ProductImageInput} from '@/components/product-image-input'
import {createQuickProduct} from '@/app/actions/quick-product'

const fields=['name','brand','category','package_size','unit','sku','source_type']
const draftName=(id:string)=>'2tbr:quick-product:v1:'+id
export function AdminQuickProductForm({userId}:{userId:string}){
 const formRef=useRef<HTMLFormElement>(null)
 const sending=useRef(false)
 const [pending,startTransition]=useTransition()
 const [error,setError]=useState('')
 const [saved,setSaved]=useState(false)
 const [hadImage,setHadImage]=useState(false)
 const [success,setSuccess]=useState('')
 const router=useRouter()
 const key=draftName(userId)
 useEffect(()=>{
  try{
   const raw=sessionStorage.getItem(key)
   if(!raw||!formRef.current)return
   const data=JSON.parse(raw) as {version:number;fields:Record<string,string>;hadImage:boolean}
   if(data.version!==1||!data.fields)return
   for(const name of fields){
    const node=formRef.current.elements.namedItem(name)
    if(node instanceof HTMLInputElement||node instanceof HTMLSelectElement)
     node.value=String(data.fields[name]??(name==='source_type'?'SUPPLIER_POOL':''))
   }
   setHadImage(data.hadImage)
   setSaved(true)
  }catch{/* Damaged tab-only draft must not prevent a new upload. */}
 },[key])
 function saveDraft(){
  const form=formRef.current
  if(!form)return
  const current=Object.fromEntries(fields.map(name=>{
   const item=form.elements.namedItem(name)
   return [name,item instanceof HTMLInputElement||item instanceof HTMLSelectElement?item.value:'']
  }))
  const file=form.elements.namedItem('image_file')
  try{
   sessionStorage.setItem(key,JSON.stringify({version:1,fields:current,
    hadImage:file instanceof HTMLInputElement&&Boolean(file.files?.length)}))
   setSaved(true)
  }catch{/* The form still retains entered values until navigation. */}
 }
 function submit(e:FormEvent<HTMLFormElement>){
  // ProductImageInput blocks submission while it optimizes a chosen PC image.
  if(e.defaultPrevented)return
  e.preventDefault()
  if(sending.current||pending)return
  const form=formRef.current
  if(!form)return
  sending.current=true
  saveDraft()
  setSuccess('');setError('')
  const fd=new FormData(form)
  startTransition(async()=>{
   try{
    const result=await createQuickProduct(fd)
    if(!result.ok){
     setError(result.message)
     if(result.field){
      const field=form.elements.namedItem(result.field)
      if(field instanceof HTMLElement)field.focus()
     }
     return
    }
    sessionStorage.removeItem(key)
    form.reset()
    setSaved(false);setHadImage(false)
    setSuccess(result.message)
    router.refresh()
   }catch{
    setError('Could not save the product. Your entries are still here; check your connection and retry.')
   }finally{sending.current=false}
  })
 }
 return <form id="quick-product-upload" ref={formRef} onSubmit={submit} onInput={saveDraft} onChange={saveDraft}
  className="card min-w-0 p-4 sm:p-5 grid gap-4" aria-label="Quick Product Upload">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div>
    <div className="card-title">Product catalog</div>
    <h2 className="section-title">Quick Product Upload</h2>
    <p className="muted mt-1 text-sm">Upload once. Add Direct, Exclusive, Group Deal or Pool pricing and stock later in the relevant offer workflow.</p>
   </div>
   <span className="chip">1 step · No SEO review</span>
  </div>
  <div className="muted text-xs" role="status">
   {saved?'Draft saved in this browser tab.': 'Your entries stay on the form if saving fails.'}
   {saved&&hadImage?' If restoring after refresh, reselect your image file.':''}
  </div>
  {error&&<div role="alert" className="rounded-xl border border-red-400 bg-red-50 p-3 text-sm text-red-900">
   <strong>Product not saved.</strong> {error} Your form entries are preserved.
  </div>}
  {success&&<div role="status" className="rounded-xl border border-teal-400 bg-teal-50 p-3 text-sm text-teal-900">
   {success}
  </div>}
  <div className="grid min-w-0 gap-3 md:grid-cols-2">
   <label><span className="label">Product name *</span>
    <input className="input" name="name" required minLength={2} maxLength={180} placeholder="e.g. Chinigura Rice"/></label>
   <label><span className="label">Category *</span>
    <input className="input" name="category" required minLength={2} maxLength={120} placeholder="e.g. Rice & Grains"/></label>
   <label><span className="label">Selling quantity / package size *</span>
    <input className="input" name="package_size" required maxLength={60} placeholder="e.g. 1 kg"/></label>
   <label><span className="label">Selling unit *</span>
    <input className="input" name="unit" required maxLength={30} placeholder="e.g. kg, pcs, pack"/></label>
   <label><span className="label">Unique SKU *</span>
    <input className="input" name="sku" required minLength={3} maxLength={80}
     pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,79}" placeholder="e.g. RICE-CHINI-1KG"/>
    <span className="muted mt-1 block text-xs">Must be new; archived product SKUs remain reserved for order history.</span>
   </label>
   <label><span className="label">Brand (optional)</span>
    <input className="input" name="brand" maxLength={180} placeholder="Leave blank for loose / unbranded goods"/></label>
   <label className="md:col-span-2"><span className="label">Product source (internal)</span>
    <select className="input" name="source_type" defaultValue="SUPPLIER_POOL">
     <option value="SUPPLIER_POOL">Supplier-listed · can be offered in Pools, Deals and Direct</option>
     <option value="DIRECT_PRODUCT">Own / stocked product · set inventory separately</option>
     <option value="EXCLUSIVE_PARTNER">Exclusive partner · set supply and price separately</option>
    </select>
    <span className="muted mt-1 block text-xs">Selecting a source does not create stock, supplier payment, offers or an order.</span>
   </label>
   <ProductImageInput label="Product image from your PC (optional)"/>
  </div>
  <p className="muted text-xs">SEO, AEO, GEO, English/Bangla descriptions, FAQs and marketing media are optional. Add them later from the saved product&apos;s details. A saved master is active for Admin use, but does not become customer-orderable until an eligible offer and stock are set.</p>
  <div className="flex flex-wrap items-center gap-3">
   <button className="btn-primary" type="submit" disabled={pending} aria-busy={pending}>
    {pending?'Saving product…':'Save & activate product'}
   </button>
   <span className="muted text-xs">Only Super Admin and authorized Admin accounts can save.</span>
  </div>
 </form>
}
