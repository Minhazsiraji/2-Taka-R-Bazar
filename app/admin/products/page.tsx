import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { createProduct, updateProduct } from '@/app/actions/admin'
import { requireAdmin } from '@/lib/auth'

export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin();const sp=await searchParams
  const {data:rows}=await supabase.from('products').select('*').order('created_at',{ascending:false})
  return <AdminShell><h1 className="text-3xl font-black mb-4">Products</h1><Flash {...sp}/>
    <form action={createProduct} className="card form-grid mb-5"><label><span className="label">Name</span><input className="input" name="name" required/></label><label><span className="label">Brand</span><input className="input" name="brand"/></label><label><span className="label">Category</span><input className="input" name="category" required/></label><label><span className="label">Package size</span><input className="input" name="package_size" placeholder="1 kg" required/></label><label><span className="label">Unit</span><input className="input" name="unit" placeholder="pack" required/></label><label><span className="label">SKU</span><input className="input" name="sku" required/></label><label><span className="label">Image URL (optional)</span><input className="input" type="url" name="image_url"/></label><label className="flex items-center gap-2"><input type="checkbox" name="is_demo"/><span>Demo/test product</span></label><SubmitButton>Create product</SubmitButton></form>
    <div className="grid gap-3">{rows?.map((r:any)=><details className="card" key={r.id}><summary className="cursor-pointer flex justify-between gap-3"><span><b>{r.name}</b> <span className="muted">· {r.package_size} · {r.sku}</span></span><span className="chip">{r.active?'Active':'Inactive'}</span></summary><form action={updateProduct} className="form-grid mt-4"><input type="hidden" name="id" value={r.id}/><input className="input" name="name" defaultValue={r.name} required/><input className="input" name="brand" defaultValue={r.brand??''}/><input className="input" name="category" defaultValue={r.category} required/><input className="input" name="package_size" defaultValue={r.package_size} required/><input className="input" name="unit" defaultValue={r.unit} required/><input className="input" name="sku" defaultValue={r.sku} required/><input className="input" type="url" name="image_url" defaultValue={r.image_url??''}/><label className="flex items-center gap-2"><input type="checkbox" name="is_demo" defaultChecked={r.is_demo}/><span>Demo/test</span></label><label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={r.active}/><span>Active</span></label><SubmitButton>Save product</SubmitButton></form></details>)}</div>
    <p className="muted mt-4">Products with historical orders are deactivated rather than hard-deleted.</p>
  </AdminShell>
}
