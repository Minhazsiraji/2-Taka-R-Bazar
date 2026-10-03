import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { ProductImage } from '@/components/product-image'
import { SubmitButton } from '@/components/submit-button'
import { createProduct, updateProduct } from '@/app/actions/admin'
import { requireAdmin } from '@/lib/auth'

export const dynamic='force-dynamic'

function ProductFields({row}:{row?:any}){
  return <>
    <label><span className="label">Name</span><input className="input" name="name" defaultValue={row?.name??''} required/></label>
    <label><span className="label">Brand</span><input className="input" name="brand" defaultValue={row?.brand??''}/></label>
    <label><span className="label">Category</span><input className="input" name="category" defaultValue={row?.category??''} required/></label>
    <label><span className="label">Package size</span><input className="input" name="package_size" defaultValue={row?.package_size??''} placeholder="1 kg" required/></label>
    <label><span className="label">Unit</span><input className="input" name="unit" defaultValue={row?.unit??''} placeholder="pack" required/></label>
    <label><span className="label">SKU</span><input className="input" name="sku" defaultValue={row?.sku??''} required/></label>
    <label className="md:col-span-2"><span className="label">Product image</span><input className="input" type="file" name="image_file" accept="image/jpeg,image/png,image/webp"/><span className="muted mt-1 block text-xs">JPEG, PNG or WebP · maximum 5 MB. The image is stored in managed product storage and reused automatically in Pools and customer views.</span></label>
  </>
}

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin();const sp=await searchParams
  const {data:rows}=await supabase.from('products').select('*').order('created_at',{ascending:false})
  return <AdminShell><div className="grid min-w-0 gap-5">
    <section><div className="card-title">Catalog</div><h1 className="text-2xl font-black sm:text-3xl">Products</h1><p className="muted mt-1">Each product has one master image. The same image follows the product into Pool, order and savings views.</p></section>
    <Flash {...sp}/>

    <form action={createProduct} className="card grid min-w-0 gap-4 p-4 sm:p-5 md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="section-title">Create product</h2><p className="muted mt-1 text-sm">Upload the genuine product pack/image once. Do not paste third-party image URLs.</p></div>
      <ProductFields/>
      <label className="flex items-center gap-2"><input type="checkbox" name="is_demo"/><span>Demo/test product</span></label>
      <SubmitButton className="md:w-fit">Create product</SubmitButton>
    </form>

    <section className="grid gap-3">
      {(rows??[]).map((r:any)=><details className="card min-w-0 p-0" key={r.id}>
        <summary className="cursor-pointer list-none p-3 sm:p-4">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
            <ProductImage src={r.image_url} name={r.name} variant="thumb"/>
            <div className="min-w-0"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><b className="block truncate sm:text-lg">{r.name}</b><p className="muted truncate text-sm">{r.brand?`${r.brand} · `:''}{r.package_size} · {r.sku}</p></div><span className="chip w-fit shrink-0">{r.active?'Active':'Inactive'}</span></div></div>
          </div>
        </summary>
        <div className="border-t border-slate-200 p-4 sm:p-5">
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
        </div>
      </details>)}
      {!(rows??[]).length&&<div className="card muted">No products yet.</div>}
    </section>
    <p className="muted">Products with historical orders are deactivated rather than hard-deleted.</p>
  </div></AdminShell>
}
