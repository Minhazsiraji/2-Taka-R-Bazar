import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { ProductImage } from '@/components/product-image'
import { ProductImageInput } from '@/components/product-image-input'
import { SubmitButton } from '@/components/submit-button'
import { AdminProductSeoEditor } from '@/components/admin-product-seo-editor'
import { AdminQuickProductForm } from '@/components/admin-quick-product-form'
import { AdminProductLifecycle } from '@/components/admin-product-lifecycle'
import { updateProductWithImage as updateProduct } from '@/app/actions/product-images'
import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'

export const dynamic='force-dynamic'

function ProductFields({row}:{row?:any}){
  return <>
    <label><span className="label">Name</span><input className="input" name="name" defaultValue={row?.name??''} required/></label>
    <label><span className="label">Brand</span><input className="input" name="brand" defaultValue={row?.brand??''}/></label>
    <label><span className="label">Category</span><input className="input" name="category" defaultValue={row?.category??''} required/></label>
    <label><span className="label">Package size</span><input className="input" name="package_size" defaultValue={row?.package_size??''} placeholder="1 kg" required/></label>
    <label><span className="label">Unit</span><input className="input" name="unit" defaultValue={row?.unit??''} placeholder="pack" required/></label>
    <label><span className="label">SKU</span><input className="input" name="sku" defaultValue={row?.sku??''} required/></label>
    <ProductImageInput/>
  </>
}

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string;view?:string}>}){
  const {supabase,user,roles}=await requireAdmin();const sp=await searchParams
  const archived=sp.view==='archived'
  const [productRes,seoRes,faqRes,mediaRes]=await Promise.all([
    supabase.from('products').select('*').eq('active',!archived).order('created_at',{ascending:false}),
    supabase.from('product_seo_content').select('*'),
    supabase.from('product_seo_faqs').select('*'),
    supabase.from('product_seo_media').select('*'),
  ])
  const {data:ownerFlag,error:ownerCheckError}=await supabase.rpc('is_current_platform_owner')
  const isOwner=!ownerCheckError&&ownerFlag===true
  const rows=productRes.data??[]
  const canDelete=roles.has('super_admin')
  const eligibilityResults=canDelete?await Promise.all(rows.map((r:any)=>
    supabase.rpc('admin_product_delete_check',{p_product_id:r.id}))) : []
  const eligibilityByProduct=new Map<string,any>()
  if(canDelete)rows.forEach((r:any,i:number)=>{
    const result=eligibilityResults[i]
    eligibilityByProduct.set(r.id,!result?.error&&result?.data?result.data:{eligible:false,blockers:['Unable to confirm unused status']})
  })
  const seoByProduct=new Map((seoRes.data??[]).map((r:any)=>[r.product_id,r]))
  const faqByProduct=new Map<string,any[]>(),mediaByProduct=new Map<string,any[]>()
  for(const r of faqRes.data??[])faqByProduct.set(r.product_id,[...(faqByProduct.get(r.product_id)??[]),r])
  for(const r of mediaRes.data??[])mediaByProduct.set(r.product_id,[...(mediaByProduct.get(r.product_id)??[]),r])
  return <AdminShell variant="product"><div className="grid min-w-0 gap-5">
    <section><div className="card-title">Catalog</div><h1 className="text-2xl font-black sm:text-3xl">Products</h1><p className="muted mt-1">Each product has one master image. The same image follows the product into Pool, order and savings views.</p><p className="mt-2 text-sm"><a className="font-semibold text-teal-700 underline underline-offset-2" href="/docs/product-upload-guide.html" target="_blank" rel="noopener noreferrer" aria-label="Open Product Upload SEO AEO GEO guide and printable PDF instructions">Product Upload Guide (SEO / AEO / GEO) — View, Print or Save as PDF ↗</a></p></section>
    <div className="card flex flex-wrap items-center justify-between gap-3"><div><b>Already added your product?</b><p className="muted text-sm">Next, choose Direct, Group Deal or Pool, select products and area, and enter prices.</p></div><a className="btn-primary" href="/admin/offers">Create offer →</a><Link className="btn-secondary" href="/admin/inventory">Update inventory →</Link></div>
    <Flash {...sp}/>

    {!archived&&<AdminQuickProductForm key={user.id} userId={user.id}/>}

    <nav aria-label="Catalog status" className="flex flex-wrap items-center gap-2">
      <Link href="/admin/products" aria-current={!archived?'page':undefined} className={!archived?'btn-primary':'btn-secondary'}>Active catalog</Link>
      <Link href="/admin/products?view=archived" aria-current={archived?'page':undefined} className={archived?'btn-primary':'btn-secondary'}>Archived products</Link>
      <span className="muted text-sm">Archived products are retained for historical orders, but are not sellable.</span>
    </nav>

    <section className="grid gap-3">
      {(rows??[]).map((r:any)=><details id={'product-'+r.id} className="card min-w-0 scroll-mt-24 p-0" key={r.id}>
        <summary className="cursor-pointer list-none p-3 sm:p-4">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
            <ProductImage src={r.image_url} name={r.name} variant="thumb"/>
            <div className="min-w-0"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><b className="block truncate sm:text-lg">{r.name}</b><p className="muted truncate text-sm">{r.brand?`${r.brand} · `:''}{r.package_size} · {r.sku}</p></div><span className="chip w-fit shrink-0">{r.active?'Active':'Inactive'}</span></div></div>
          </div>
        </summary>
        <div className="border-t border-slate-200 p-4 sm:p-5">
          {archived?<p className="muted text-sm">Archived historical reference · read-only. Existing orders, SKU and finance history are preserved. Create a new SKU from the Active catalog instead of reactivating this record.</p>:<>
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)]">
            <div><ProductImage src={r.image_url} name={r.name}/><p className="muted mt-2 text-xs">Current master image. Replacing it updates every view that references this product.</p></div>
            <form action={updateProduct} className="grid min-w-0 gap-4 md:grid-cols-2">
              <input type="hidden" name="id" value={r.id}/>
              <ProductFields row={r}/>
              {r.image_url&&<label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm md:col-span-2"><input className="mt-1" type="checkbox" name="remove_image"/><span><b>Remove current image</b><span className="muted block">Use only when the image is wrong. Uploading a replacement automatically supersedes the old managed image.</span></span></label>}
              <label className="flex items-center gap-2"><input type="checkbox" name="is_demo" defaultChecked={r.is_demo}/><span>Demo/test</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={r.active}/><span>Active</span></label>
              <SubmitButton className="md:w-fit">Save product</SubmitButton>
            </form>
          </div>
          <AdminProductSeoEditor product={r} seo={seoByProduct.get(r.id)} faqs={faqByProduct.get(r.id)??[]} media={mediaByProduct.get(r.id)??[]} canReview={roles.has('super_admin')} isOwner={isOwner} currentUser={user.id}/>
          {canDelete&&<AdminProductLifecycle product={r} eligibility={eligibilityByProduct.get(r.id)}/>}
          </>}
        </div>
      </details>)}
      {!(rows??[]).length&&<div className="card muted">{archived?'No archived products.':'No active products yet. Upload your first fresh product above.'}</div>}
    </section>
    <p className="muted">Only never-used products can be deleted by a Super Admin. Products with sales, Pools, procurements, inventory, supplier links or publication history can only be archived.</p>
  </div></AdminShell>
}
