import {archiveProduct,deleteUnusedProduct} from '@/app/actions/product-wizard'
import {SubmitButton} from '@/components/submit-button'
type Product={id:string;sku:string;name:string;active:boolean}
type Eligibility={eligible:boolean;blockers?:string[]}
export function AdminProductLifecycle({product,eligibility}:{product:Product;eligibility?:Eligibility|null}){
 const eligible=eligibility?.eligible===true
 return <section className="mt-5 rounded-xl border border-slate-200 p-4" aria-label="Product archive or deletion controls">
  <h3 className="text-lg font-bold">Product lifecycle · Super Admin</h3>
  <p className="muted mt-1 text-sm">Deletion is permanent and limited to never-used products. An item linked to a single order, Pool, supplier, inventory, procurement or Finance record must be archived instead.</p>
  {eligible?<form action={deleteUnusedProduct} className="mt-4 grid gap-3 md:grid-cols-2">
    <input type="hidden" name="product_id" value={product.id}/>
    <input type="hidden" name="sku" value={product.sku}/>
    <label><span className="label">Type this exact SKU to confirm permanent deletion</span>
      <input className="input" name="confirm_sku" placeholder={product.sku} autoComplete="off" required/></label>
    <label><span className="label">Deletion reason (at least 10 characters)</span>
      <input className="input" name="reason" required minLength={10} placeholder="Created in error; never used"/></label>
    <div className="md:col-span-2"><SubmitButton className="rounded-full border border-rose-500 px-4 py-2 font-bold text-rose-700" confirmMessage={'Permanently delete '+product.sku+'? This cannot be undone.'}>Delete unused product permanently</SubmitButton></div>
  </form>:<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <b>Permanent deletion unavailable.</b>
    <p className="mt-1">The product has business associations, retained SEO/publication history or cannot yet be verified as unused.</p>
    {!!eligibility?.blockers?.length&&<ul className="mt-2 list-inside list-disc">{eligibility.blockers.map(x=><li key={x}>{x}</li>)}</ul>}
  </div>}
  {product.active&&<form action={archiveProduct} className="mt-4 flex flex-wrap items-end gap-3">
    <input type="hidden" name="product_id" value={product.id}/>
    <label className="min-w-[180px] flex-1"><span className="label">Archive reason (at least 10 characters)</span>
      <input className="input" name="reason" required minLength={10} placeholder="Discontinued, replaced or listed in error"/></label>
    <SubmitButton className="btn-secondary" confirmMessage={'Archive '+product.sku+'? It will be removed from active listings.'}>Archive / deactivate</SubmitButton>
  </form>}
 </section>
}
