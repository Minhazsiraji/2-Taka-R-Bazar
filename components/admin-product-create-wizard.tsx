'use client'
import {useState} from 'react'
import {ProductImageInput} from '@/components/product-image-input'
import {SubmitButton} from '@/components/submit-button'
import {createProductWithSeo} from '@/app/actions/product-wizard'
const tabs=[
 ['1','Product & SKU'],['2','Specifications'],['3','SEO EN / BAN'],
 ['4','AEO / GEO'],['5','Photos & Posters'],['6','Review & Save']
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
export function AdminProductCreateWizard(){
 const [step,setStep]=useState(0)
 const [kind,setKind]=useState('UNBRANDED_LOOSE')
 const fields=['variety','origin','processing','ingredients','storage','package_kind','net_quantity']
 return <form action={createProductWithSeo} className="card min-w-0 p-4 sm:p-5" id="guided-create-product">
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="section-title">Create product — one guided form</h2>
    <p className="muted mt-1 text-sm">Complete six sections once, then save a single master product with its bilingual SEO draft.</p></div>
   <span className="chip">Step {step+1} / 6</span>
  </div>
  <nav aria-label="Product creation steps" className="mb-6 grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
    {tabs.map(([n,label],i)=><button key={n} type="button" onClick={()=>setStep(i)}
      aria-current={step===i?'step':undefined} className={'rounded-xl border p-2 text-left text-sm '+(step===i?'border-teal-600 bg-teal-50 font-bold text-teal-900':'border-slate-200')}>
      <span className="block text-xs font-bold">STEP {n}</span>{label}</button>)}
  </nav>
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
   <p className="muted my-4 text-sm">The master image is uploaded in Step 1. Supplementary pictures use approved HTTPS product storage or Cloudinary URLs and must be real product photos. Facebook posters belong under Marketing, not Gallery.</p>
   {(['gallery','marketing'] as const).map(kind=><details key={kind} className="mb-3 rounded-xl border border-slate-200 p-3">
     <summary className="cursor-pointer font-semibold">{kind==='gallery'?'Product gallery (up to 6)':'Marketing posters (up to 6)'}</summary>
     <div className="mt-3 grid gap-4">{Array.from({length:6},(_,i)=>i+1).map(i=>
      <div key={i} className="rounded-lg border border-slate-200 p-3">
       <h4 className="mb-2 font-semibold">{kind} {i}</h4>
       <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><Field name={kind+'_url_'+i} label="Approved HTTPS image URL"/></div>
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
   <SubmitButton className="btn-primary mt-4 w-full sm:w-auto">Create product &amp; save SEO draft</SubmitButton>
  </section>
  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
    <button type="button" className="btn-secondary" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}>← Back</button>
    <span className="muted text-sm">You may revisit each step. Fields stay filled.</span>
    {step<5&&<button type="button" className="btn-primary" onClick={()=>setStep(s=>Math.min(5,s+1))}>Next step →</button>}
  </div>
 </form>
}
