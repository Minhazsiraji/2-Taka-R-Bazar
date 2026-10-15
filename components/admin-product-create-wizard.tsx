'use client'
import {useEffect,useRef,useState,useTransition} from 'react'
import type {FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {ProductImageInput} from '@/components/product-image-input'
import {createProductWithSeo} from '@/app/actions/product-wizard'
const tabs=[
 ['1','Product'],['2','Specs'],['3','SEO · EN/BN'],
 ['4','AEO / GEO'],['5','Media'],['6','Review']
] as const
type FieldProps={name:string;label:string;placeholder?:string;multiline?:boolean;hint?:string;maxLength?:number;value?:string}
function Field({name,label,placeholder,multiline,hint,maxLength,value}:FieldProps){
 return <label className={multiline?'md:col-span-2':'block'}>
  <span className="label">{label}</span>
  {multiline?<textarea className="input min-h-24" name={name} defaultValue={value} placeholder={placeholder} maxLength={maxLength}/>:
    <input className="input" name={name} defaultValue={value} placeholder={placeholder} maxLength={maxLength}/>}
  {hint&&<span className="muted mt-1 block text-xs">{hint}</span>}
 </label>
}
function FAQ({index}:{index:number}){return <div className="rounded-xl border border-slate-200 p-3">
 <h4 className="font-semibold">FAQ {index}</h4>
 <div className="mt-3 grid gap-3 md:grid-cols-2">
  <Field name={'q_en_'+index} label="Question — English" maxLength={300}/>
  <Field name={'q_bn_'+index} label="প্রশ্ন — বাংলা" maxLength={300}/>
  <Field name={'a_en_'+index} label="Answer — English" multiline maxLength={1200}/>
  <Field name={'a_bn_'+index} label="উত্তর — বাংলা" multiline maxLength={1200}/>
 </div>
 </div>}
type FieldInput=HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement
type WizardIssue={message:string;field?:string;step?:number}
type SavedDraft={version:1;step:number;values:Record<string,string|boolean>;hadImage:boolean}
export function AdminProductCreateWizard({userId}:{userId:string}){
 const [step,setStep]=useState(0)
 const [kind,setKind]=useState('UNBRANDED_LOOSE')
 const [issue,setIssue]=useState<WizardIssue|null>(null)
 const [success,setSuccess]=useState('')
 const [saved,setSaved]=useState(false)
 const [restored,setRestored]=useState(false)
 const [needsFile,setNeedsFile]=useState(false)
 const [pending,startTransition]=useTransition()
 const formRef=useRef<HTMLFormElement>(null)
 const router=useRouter()
 // Private to this account and browser TAB. Do not store image bytes or upload any unsaved draft.
 const storageKey='2tbr:product-draft:v1:'+userId
 const fields=['variety','origin','processing','ingredients','storage','package_kind','net_quantity']
 function saveDraft(nextStep=step){
  const form=formRef.current
  if(!form)return
  const values:Record<string,string|boolean>={}
  for(const element of Array.from(form.elements)){
   if(!(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||
     element instanceof HTMLSelectElement)||!element.name||element.type==='file')continue
   values[element.name]=element instanceof HTMLInputElement&&element.type==='checkbox'
     ?element.checked:element.value
  }
  const hadImage=Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]')).some(input=>Boolean(input.files?.length))
  try{window.sessionStorage.setItem(storageKey,JSON.stringify({version:1,step:nextStep,values,hadImage} satisfies SavedDraft));setSaved(true)}
  catch{setSaved(false)}
 }
 useEffect(()=>{
  try{
   const raw=window.sessionStorage.getItem(storageKey)
   if(!raw)return
   const data=JSON.parse(raw) as SavedDraft
   if(data.version!==1||!data.values||!formRef.current)return
   for(const [name,val] of Object.entries(data.values)){
    const element=formRef.current.elements.namedItem(name)
    if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||
       element instanceof HTMLSelectElement){
     if(element instanceof HTMLInputElement&&element.type==='checkbox')element.checked=val===true
     else if(element.type!=='file')element.value=String(val)
    }
   }
   const brand=formRef.current.elements.namedItem('brand_type')
   if(brand instanceof HTMLSelectElement)setKind(brand.value)
   setStep(Math.min(5,Math.max(0,Number(data.step)||0)))
   setNeedsFile(Boolean(data.hadImage))
   setSaved(true);setRestored(true)
  }catch{
   // Damaged tab draft must never block a new product.
  }
 },[storageKey])
 function goToStep(i:number){const next=Math.min(5,Math.max(0,i));saveDraft(next);setStep(next);setIssue(null);setSuccess('')}
 function newProduct(){
  if(!window.confirm('Start a new product? This will clear the unfinished draft saved in this tab.'))return
  window.sessionStorage.removeItem(storageKey)
  formRef.current?.reset()
  setStep(0);setKind('UNBRANDED_LOOSE');setIssue(null);setSuccess('')
  setSaved(false);setRestored(false);setNeedsFile(false)
 }
 function handleSubmit(event:FormEvent<HTMLFormElement>){
  if(event.defaultPrevented||pending)return
  event.preventDefault()
  const form=formRef.current
  if(!form)return
  saveDraft(5)
  setIssue(null);setSuccess('')
  const formData=new FormData(form)
  startTransition(async()=>{
   try{
    const result=await createProductWithSeo(formData)
    if(!result.ok){
     setIssue({message:result.message,field:result.field,step:result.step})
     const next=result.step??5
     setStep(next);saveDraft(next)
     if(result.field)window.requestAnimationFrame(()=>{
      const field=formRef.current?.elements.namedItem(result.field!)
      if(field instanceof HTMLElement){field.focus();field.scrollIntoView({block:'center',behavior:'smooth'})}
     })
     return
    }
    window.sessionStorage.removeItem(storageKey)
    form.reset();setSaved(false);setRestored(false);setNeedsFile(false)
    setKind('UNBRANDED_LOOSE');setStep(0);setIssue(null);setSuccess(result.message)
    router.refresh()
   }catch{
    setIssue({message:'Connection interrupted. Your product information remains in this tab; check your connection and retry.',step:5})
    setStep(5)
   }
  })
 }
 return <form ref={formRef} onSubmit={handleSubmit} onInput={()=>saveDraft()} onChange={()=>saveDraft()}
  className="card product-create-wizard min-w-0 p-4 sm:p-5" id="guided-create-product">
  <div className="product-wizard-heading mb-4 flex flex-wrap items-start justify-between gap-3">
   <div><span className="product-wizard-eyebrow">Product catalog</span><h2 className="section-title">Create product</h2>
    <p className="muted mt-1 text-sm">One guided form · Product details, verified facts and bilingual SEO draft.</p></div>
   <span className="product-wizard-counter" aria-live="polite">Step {step+1} of 6</span>
  </div>
  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
    <span role="status" className="font-semibold text-teal-800 dark:text-teal-200">
      {saved?'Draft saved in this browser tab — not published':'Draft is kept while this form is open'}
    </span>
    {saved&&<button type="button" className="underline underline-offset-2" onClick={newProduct}>
      Clear draft / New product
    </button>}
  </div>
  {restored&&<p role="status" className="mb-3 rounded-lg border border-teal-300 p-3 text-sm">
    Your unfinished product information was recovered from this browser tab.
    {needsFile?' Please reselect the main or supplementary images; browsers do not restore selected files.':''}
  </p>}
  {issue&&<div role="alert" className="mb-4 rounded-xl border border-red-400 bg-red-50 p-4 text-sm text-red-900">
    <strong>Product not saved. All your entries are preserved.</strong>
    <p className="mt-1">{issue.message}</p>
    {typeof issue.step==='number'&&<button type="button" className="mt-2 underline underline-offset-2"
      onClick={()=>goToStep(issue.step!)}>Go to Step {issue.step+1}</button>}
  </div>}
  {success&&<div role="status" className="mb-4 rounded-xl border border-teal-400 bg-teal-50 p-4 text-sm text-teal-900">{success}</div>}
  <nav aria-label="Product creation steps" className="product-wizard-steps mb-5">
    {tabs.map(([n,label],i)=><button key={n} type="button" onClick={()=>goToStep(i)}
      aria-current={step===i?'step':undefined}
      aria-label={i===0 ? 'Step 1: Product & SKU' : `Step ${n}: ${label}`}
      className={'product-wizard-step'+(step===i?' is-current':'')}>
      <span className="product-wizard-step-number" aria-hidden="true">{n}</span>
      <span className="product-wizard-step-label">{label}</span>
    </button>)}
  </nav>
  <div className="product-wizard-progress" role="progressbar" aria-label="Product creation progress" aria-valuemin={1} aria-valuemax={6} aria-valuenow={step+1}>
    <span style={{width:`${(step+1)/6*100}%`}}/>
  </div>
  <section hidden={step!==0} aria-label="Product identity and master photo">
   <h3 className="mb-3 text-lg font-bold">1. Product identity and master image</h3>
   <div className="grid gap-4 md:grid-cols-2">
    <Field name="name" label="Product name (required)" placeholder="Brown Rice (Loose) – 1 kg" maxLength={180}/>
    <label><span className="label">Brand type</span><select className="input" value={kind} name="brand_type" onChange={e=>setKind(e.target.value)}>
     <option value="UNBRANDED_LOOSE">Unbranded / Loose</option>
     <option value="SUPPLIER_BRAND">Supplier / Third-party Brand</option>
     <option value="2TBR_PRIVATE_LABEL">2TBR Own Brand (only if genuinely packaged)</option>
    </select></label>
    <Field name="brand" label="Actual brand" placeholder={kind==='UNBRANDED_LOOSE'?'Leave blank for loose unbranded goods':'Enter the verified real brand'}/>
    <Field name="category" label="Category (required)" placeholder="Rice & Grains" maxLength={120}/>
    <Field name="package_size" label="Selling quantity / package size" placeholder="1 kg" maxLength={60} hint="For loose goods this is the selected selling quantity, not factory-sealed packaging."/>
    <Field name="unit" label="Selling unit" placeholder="kg" maxLength={30}/>
    <Field name="sku" label="Unique SKU (required)" placeholder="RICE-BRN-LOOSE-1KG" hint="Do not reuse historical SKUs. Existing orders always retain their original product."/>
    <div className="md:col-span-2"><ProductImageInput/></div>
    <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="is_demo"/><span>Demo / test product — not searchable or purchasable</span></label>
   </div>
  </section>
  <section hidden={step!==1} aria-label="Verified specifications">
   <h3 className="mb-3 text-lg font-bold">2. Verified product specifications</h3>
   <p className="muted mb-4 text-sm">Enter only supplier-verified facts. Leave uncertain fields empty; do not claim “Full Fiber”, organic, chemical-free or disease-related benefits without supporting evidence.</p>
   <div className="grid gap-4 md:grid-cols-2">{fields.map(f=>
    <Field key={f} name={'spec_'+f} label={f.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase())} maxLength={500}
      placeholder={f==='package_kind'?'Loose by weight':f==='net_quantity'?'1 kg per selling unit':'Verified '+f}/>)}</div>
  </section>
  <section hidden={step!==2} aria-label="English and Bangla SEO">
   <h3 className="mb-3 text-lg font-bold">3. SEO and bilingual descriptions</h3>
   <p className="muted mb-4 text-sm">English is the storefront default. Add the real Bangla version so both public pages are accurate. Saving creates a Draft only.</p>
   <div className="grid gap-4 md:grid-cols-2">
    <Field name="slug" label="Unique URL slug" placeholder="brown-rice-loose-1kg" maxLength={120}/>
    <div><span className="label">Canonical product URL</span><p className="muted mt-2 break-all text-sm">/p/[slug] · /bn/p/[slug]</p></div>
    <Field name="title_en" label="Product name — English (required)" placeholder="Brown Rice (Loose) – 1 kg" maxLength={180}/>
    <Field name="title_bn" label="Product name — বাংলা (required)" placeholder="ব্রাউন রাইস (খোলা চাল) – ১ কেজি" maxLength={180}/>
    <Field name="short_en" label="Short description — EN" multiline maxLength={320}/>
    <Field name="short_bn" label="Short description — বাংলা" multiline maxLength={320}/>
    <Field name="description_en" label="Full description — EN" multiline maxLength={8000}/>
    <Field name="description_bn" label="Full description — বাংলা" multiline maxLength={8000}/>
    <Field name="meta_title_en" label="Search title — EN" maxLength={110}/>
    <Field name="meta_title_bn" label="Search title — বাংলা" maxLength={110}/>
    <Field name="meta_description_en" label="Meta description — EN" multiline maxLength={320}/>
    <Field name="meta_description_bn" label="Meta description — বাংলা" multiline maxLength={320}/>
   </div>
  </section>
  <section hidden={step!==3} aria-label="FAQ and claim evidence">
   <h3 className="mb-3 text-lg font-bold">4. AEO answers and GEO evidence</h3>
   <p className="muted mb-3 text-sm">Add helpful, truthful questions in both languages. FAQs are optional; any filled question needs its complete translated answer.</p>
   <details className="rounded-xl border border-slate-200 p-3">
    <summary className="cursor-pointer font-semibold">Add up to eight bilingual FAQ pairs</summary>
    <div className="mt-4 grid gap-3">{Array.from({length:8},(_,i)=><FAQ key={i} index={i+1}/>)}</div>
   </details>
   <div className="mt-4">
    <Field name="verification_notes" label="Private supplier verification and claim evidence (not public)" multiline maxLength={3000}
      placeholder="Supplier reference, physical verification date, product variety source and any evidence behind specific claims."/>
   </div>
  </section>
  <section hidden={step!==4} aria-label="Photo alt and supplementary media">
   <h3 className="mb-3 text-lg font-bold">5. Product image alt text, gallery and marketing</h3>
   <div className="grid gap-4 md:grid-cols-2">
    <Field name="alt_en" label="Master photo alt text — EN" maxLength={200}/>
    <Field name="alt_bn" label="Master photo alt text — বাংলা" maxLength={200}/>
   </div>
   <p className="muted my-4 text-sm">All extra images and posters are optional. Choose files directly from your PC, or paste an approved HTTPS URL as an alternative. Leave every field blank to skip. Gallery is for real product photos; promotional artwork belongs under Marketing.</p>
   {(['gallery','marketing'] as const).map(kind=><details key={kind} className="mb-3 rounded-xl border border-slate-200 p-3">
     <summary className="cursor-pointer font-semibold">{kind==='gallery'?'Product gallery (up to 6)':'Marketing posters (up to 6)'}</summary>
     <div className="mt-3 grid gap-4">{Array.from({length:6},(_,i)=>i+1).map(i=>
      <div key={i} className="rounded-lg border border-slate-200 p-3">
       <h4 className="mb-2 font-semibold">{kind} {i}</h4>
       <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><ProductImageInput inputName={kind+'_file_'+i} label="Choose image from PC (optional)" supplementary/></div>
        <div className="md:col-span-2"><Field name={kind+'_url_'+i} label="Or approved HTTPS URL (optional)" hint="Use only one source per item: uploaded file OR approved image URL."/></div>
        <Field name={kind+'_alt_en_'+i} label="Alt text EN" maxLength={200}/>
        <Field name={kind+'_alt_bn_'+i} label="Alt text BAN" maxLength={200}/>
       </div>
      </div>)}</div>
    </details>)}
  </section>
  <section hidden={step!==5} aria-label="Final validation and creation">
   <h3 className="mb-3 text-lg font-bold">6. Final review and create draft</h3>
   <p className="mb-3 text-sm">Confirm identity, genuine image, bilingual product titles and unique SKU are correct. Additional SEO descriptions and FAQs may be completed in the draft before submitting for independent publication review.</p>
   <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
    <strong>One save creates the product and its SEO draft together.</strong>
    <p className="mt-2">No stock, purchase, offer, financial transaction or public SEO page will be published by this action. A different Super Admin must approve publication after verification.</p>
   </div>
   <button type="submit" disabled={pending} className="btn-primary mt-4 w-full sm:w-auto">{pending?"Saving product…":"Create product & save SEO draft"}</button>
  </section>
  <div className="product-wizard-footer mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
    <button type="button" className="btn-secondary" disabled={step===0} onClick={()=>goToStep(step-1)}>← Back</button>
    <span className="muted text-sm">Entries remain on validation errors and are saved within this tab.</span>
    {step<5&&<button type="button" className="btn-primary" onClick={()=>goToStep(step+1)}>Next step →</button>}
  </div>
 </form>
}
