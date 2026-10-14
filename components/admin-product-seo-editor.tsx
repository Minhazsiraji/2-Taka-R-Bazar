import {saveProductSeo,submitProductSeo,reviewProductSeo,unlistProductSeo} from '@/app/actions/product-seo'
import {SubmitButton} from '@/components/submit-button'
import {SITE_URL} from '@/lib/site'

type SeoRow={product_id:string;slug:string;title_en:string;title_bn:string;short_en:string;short_bn:string;
 description_en:string;description_bn:string;meta_title_en:string;meta_title_bn:string;
 meta_description_en:string;meta_description_bn:string;alt_en:string;alt_bn:string;
 verification_notes:string;specs:Record<string,string>;status:string;edited_by:string|null;version:number}
type FAQ={position:number;question_en:string;answer_en:string;question_bn:string;answer_bn:string}
type Media={position:number;kind:'gallery'|'marketing';url:string;alt_en:string;alt_bn:string}
const field=(name:string,title:string,value:string|undefined,opts?:{multiline?:boolean;required?:boolean;hint?:string})=>
 <label key={name} className={opts?.multiline?'md:col-span-2':''}><span className="label">{title}</span>
 {opts?.multiline?<textarea className="input min-h-24" name={name} defaultValue={value??''} required={opts?.required}/>:
 <input className="input" name={name} defaultValue={value??''} required={opts?.required}/>}
 {opts?.hint&&<span className="muted mt-1 block text-xs">{opts.hint}</span>}</label>
export function AdminProductSeoEditor({product,seo,faqs,media,canReview,currentUser}:{product:any;seo?:SeoRow;faqs:FAQ[];media:Media[];canReview:boolean;currentUser:string}){
 const getFaq=(i:number)=>faqs.find(f=>f.position===i)
 const getMedia=(kind:string,i:number)=>media.filter(m=>m.kind===kind).sort((a,b)=>a.position-b.position)[i-1]
 const spec=seo?.specs??{}
 const slug=seo?.slug??product.sku.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
 return <section className="mt-5 border-t border-slate-200 pt-5">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><h3 className="text-xl font-bold">SEO / AEO / GEO product content</h3>
    <p className="muted text-sm">Bilingual facts for search discovery. Edit as draft, then submit for independent publication review.</p></div>
   <span className="chip">{seo?.status??'Not started'}</span>
  </div>
  {seo?.status==='published'&&<a className="mt-2 inline-block underline" href={SITE_URL+'/p/'+seo.slug} target="_blank" rel="noreferrer">View published SEO page ↗</a>}
  <form action={saveProductSeo} className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
   <input type="hidden" name="product_id" value={product.id}/>
   <div className="md:col-span-2 font-bold">1 · Identity & brand classification</div>
   <label><span className="label">Brand type</span>
    <select className="input" name="brand_type" defaultValue={product.brand_type??(product.brand?'SUPPLIER_BRAND':'UNBRANDED_LOOSE')}>
     <option value="UNBRANDED_LOOSE">Unbranded / Loose</option>
     <option value="SUPPLIER_BRAND">Third-party / Supplier Brand</option>
     <option value="2TBR_PRIVATE_LABEL">2TBR Own Brand (only after verified packaging)</option>
    </select>
   </label>
   {field('slug','SEO URL slug',slug,{required:true,hint:'Example: brown-rice-loose-1kg. Old slugs are redirected after publication.'})}
   {field('title_en','English product title',seo?.title_en??product.name,{required:true})}
   {field('title_bn','Bangla product title',seo?.title_bn,{required:true})}
   {field('short_en','English short summary',seo?.short_en,{multiline:true})}
   {field('short_bn','Bangla short summary',seo?.short_bn,{multiline:true})}
   <div className="md:col-span-2 font-bold">2 · Verified specifications</div>
   {(['variety','origin','processing','ingredients','storage','package_kind','net_quantity'] as const).map(k=>
    field('spec_'+k,k.replaceAll('_',' ').replace(/^./,x=>x.toUpperCase()),spec[k],{hint:k==='package_kind'?'Loose or actual manufacturer-packed; do not confuse selling unit with package.':undefined}))}
   <div className="md:col-span-2 font-bold">3 · Search content (SEO)</div>
   {field('description_en','Full description - English',seo?.description_en,{multiline:true})}
   {field('description_bn','Full description - Bangla',seo?.description_bn,{multiline:true})}
   {field('meta_title_en','SEO page title - English',seo?.meta_title_en)}
   {field('meta_title_bn','SEO page title - Bangla',seo?.meta_title_bn)}
   {field('meta_description_en','Search description - English',seo?.meta_description_en,{multiline:true})}
   {field('meta_description_bn','Search description - Bangla',seo?.meta_description_bn,{multiline:true})}
   {field('alt_en','Actual product photo alt text - English',seo?.alt_en)}
   {field('alt_bn','Actual product photo alt text - Bangla',seo?.alt_bn)}
   <div className="md:col-span-2"><div className="rounded-xl border border-slate-200 p-3 text-sm">
    <b>Search preview:</b> {seo?.meta_title_en||product.name} | 2-TAKA-R-BAZAR
    <div className="muted mt-1 break-all">{SITE_URL}/p/{slug}</div>
    <p className="mt-1">{seo?.meta_description_en||'Add an accurate, helpful summary of the actual item.'}</p>
   </div></div>
   <details className="md:col-span-2 rounded-xl border border-slate-200 p-3">
    <summary className="cursor-pointer font-bold">4 · Bilingual customer questions (AEO) - up to 8 FAQs</summary>
    <div className="mt-3 grid gap-4">
     {Array.from({length:8},(_,x)=>x+1).map(i=>{const faq=getFaq(i);return <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
      <div className="md:col-span-2 font-semibold">FAQ {i}</div>
      {field('q_en_'+i,'Question in English',faq?.question_en)}
      {field('q_bn_'+i,'Question in Bangla',faq?.question_bn)}
      {field('a_en_'+i,'Answer in English',faq?.answer_en,{multiline:true})}
      {field('a_bn_'+i,'Answer in Bangla',faq?.answer_bn,{multiline:true})}
     </div>})}
    </div>
   </details>
   <details className="md:col-span-2 rounded-xl border border-slate-200 p-3">
    <summary className="cursor-pointer font-bold">5 · Additional media - separate product photos and campaign posters</summary>
    <p className="muted mt-2 text-sm">The existing master image stays unchanged. Paste trusted HTTPS photo URLs from approved product image storage or Cloudinary; attach bilingual alt text. Gallery is actual product; marketing is separate campaign art.</p>
    <div className="mt-3 grid gap-3">
     {(['gallery','marketing'] as const).flatMap(kind=>Array.from({length:6},(_,x)=>x+1).map(i=>{
      const m=getMedia(kind,i);return <div key={kind+i} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
       <div className="md:col-span-2 font-semibold">{kind==='gallery'?'Product photo':'Marketing artwork'} {i}</div>
       <label className="md:col-span-2"><span className="label">HTTPS image URL</span><input className="input" type="url" name={kind+'_url_'+i} defaultValue={m?.url??''}/></label>
       {field(kind+'_alt_en_'+i,'Alt text (EN)',m?.alt_en)}
       {field(kind+'_alt_bn_'+i,'Alt text (BN)',m?.alt_bn)}
      </div>
     }))}
    </div>
   </details>
   <div className="md:col-span-2 font-bold">6 · GEO verification and publication</div>
   {field('verification_notes','Internal supplier facts / claim evidence (never public)',seo?.verification_notes,{multiline:true,hint:'Record exactly how variety, origin, processing, packaging and any nutrition assertions were checked. No medical/organic/chemical-free claims without proof.'})}
   <p className="muted text-sm md:col-span-2">Save always returns the content to Draft, including edits to previously published pages. Prices, stock, orders and existing SKU are not edited here.</p>
   <SubmitButton className="md:col-span-2 md:w-fit">Save SEO draft</SubmitButton>
  </form>
  {seo&&<div className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-start">
   {seo.status==='draft'&&<form action={submitProductSeo} className="flex-1"><input type="hidden" name="product_id" value={product.id}/><SubmitButton>Submit for independent review</SubmitButton></form>}
   {seo.status==='review'&&canReview&&seo.edited_by!==currentUser&&<form action={reviewProductSeo} className="flex flex-1 flex-wrap items-end gap-2">
    <input type="hidden" name="product_id" value={product.id}/>
    <label className="flex-1"><span className="label">Independent reviewer note (10+ characters)</span><input className="input" name="note" required minLength={10}/></label>
    <button className="btn-primary" type="submit" name="decision" value="approve">Approve & publish</button>
    <button className="btn-secondary" type="submit" name="decision" value="reject">Reject</button>
   </form>}
   {seo.status==='review'&&(!canReview||seo.edited_by===currentUser)&&<p className="muted text-sm">Waiting for an independent Super Admin reviewer.</p>}
   {(seo.status==='published'||seo.status==='review')&&<form action={unlistProductSeo} className="flex flex-1 flex-wrap items-end gap-2">
    <input type="hidden" name="product_id" value={product.id}/>
    <label className="flex-1"><span className="label">Reason to unlist (10+ characters)</span><input className="input" name="reason" required minLength={10}/></label>
    <SubmitButton className="btn-secondary">Unlist</SubmitButton>
   </form>}
  </div>}
 </section>
}
