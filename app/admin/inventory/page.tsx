import Link from 'next/link'
import {AdminShell} from '@/components/admin-shell'
import {requireAdmin} from '@/lib/auth'
import {Flash} from '@/components/flash'
import {ProductImage} from '@/components/product-image'
import {SubmitButton} from '@/components/submit-button'
import {updatePilotInventoryAvailability} from '@/app/actions/pilot-inventory'

export const dynamic='force-dynamic'
type Row={
 product_id:string;name:string;sku:string;package_size:string;image_url:string|null;
 launch_enabled:boolean|null;available_quantity:number|null;
 unit_price:number|null;reference_price:number|null
}
type Search={q?:string;notice?:string;error?:string}
const taka=(n:number|null)=>n===null?'—':'৳'+Number(n).toLocaleString('en-BD')
export default async function PilotInventoryAdmin({searchParams}:{searchParams:Promise<Search>}){
 const {supabase}=await requireAdmin()
 const sp=await searchParams
 const {data,error}=await supabase.rpc('admin_get_pilot_inventory')
 const items=(data??[]) as Row[]
 const needle=(sp.q??'').trim().toLocaleLowerCase().slice(0,80)
 const results=needle?items.filter(p=>[p.name,p.sku,p.package_size].some(x=>x.toLocaleLowerCase().includes(needle))):items
 const enabled=items.filter(p=>p.launch_enabled&&p.available_quantity!==null)
 const missing=items.filter(p=>p.available_quantity===null).length
 const low=enabled.filter(p=>Number(p.available_quantity)<=5).length
 return <AdminShell><div className="grid min-w-0 gap-4">
  <header className="card">
   <p className="card-title">2TBR · Inventory / পণ্য মজুত</p>
   <h1 className="mt-1 text-2xl font-black sm:text-3xl">Pilot inventory & availability</h1>
   <p className="muted mt-2">Update your <b>vendor-approved sellable allocation</b> by SKU. This number is not physical stock in a 2TBR warehouse. The supplier must confirm real availability before fulfillment.</p>
   <nav className="mt-3 flex flex-wrap gap-2" aria-label="Related product workflows">
    <Link href="/admin/products#quick-product-upload" className="btn-secondary">Add product</Link>
    <Link href="/admin/offers" className="btn-secondary">Set selling price / offers</Link>
    <Link href="/admin/order-tracking" className="btn-secondary">Order tracking</Link>
    <Link href="/admin/own-products" className="btn-secondary">Physical own-stock ledger</Link>
   </nav>
  </header>
  <Flash error={sp.error} notice={sp.notice}/>
  {error&&<p className="error" role="alert">The secure inventory list could not load. No changes are possible until this is resolved.</p>}
  <section className="grid gap-3 sm:grid-cols-3" aria-label="Inventory overview">
   <div className="admin-ops-stat"><p className="card-title">Enabled pilot SKUs</p><strong className="metric block">{enabled.length}</strong></div>
   <div className="admin-ops-stat"><p className="card-title">Low allocation · 5 or fewer</p><strong className="metric block">{low}</strong></div>
   <div className="admin-ops-stat"><p className="card-title">Not configured</p><strong className="metric block">{missing}</strong></div>
  </section>
  <form className="card flex flex-wrap items-end gap-3" action="/admin/inventory" method="get" role="search">
   <label className="min-w-0 flex-1"><span className="label">Find product by name, SKU or pack size</span>
    <input className="input" type="search" maxLength={80} name="q" defaultValue={needle} placeholder="e.g. Butter or RICE-1KG"/>
   </label>
   <button type="submit" className="btn-primary">Search products</button>
   {needle&&<Link className="btn-secondary" href="/admin/inventory">Clear</Link>}
  </form>
  <section className="grid gap-3" aria-label="Pilot supplier availability">
   {!error&&results.map(p=><article className="card grid gap-3" key={p.product_id}>
    <div className="flex flex-wrap items-center gap-3">
     <ProductImage src={p.image_url} name={p.name} variant="thumb"/>
     <div className="min-w-0 flex-1">
      <h2 className="text-lg font-bold">{p.name}</h2>
      <p className="muted">{p.package_size} · SKU {p.sku}</p>
      <p className="mt-1 text-sm">Vendor listing: <b>{p.launch_enabled?'Enabled':p.available_quantity===null?'Not configured':'Disabled'}</b>
       <span className="ml-3">Sellable allocation: <b>{p.available_quantity??'—'}</b></span></p>
     </div>
     <div className="text-sm"><p>Approved selling reference: <b>{taka(p.unit_price)}</b></p><p className="muted">Comparison: {taka(p.reference_price)}</p></div>
    </div>
    {p.available_quantity===null
     ?<div className="notice">No approved vendor listing for this product. Configure its supplier price and listing before changing sellable allocation.</div>
     :<form action={updatePilotInventoryAvailability} className="grid gap-3 border-t border-white/70 pt-3 sm:grid-cols-[minmax(120px,.7fr)_minmax(220px,1.5fr)_auto] sm:items-end">
       <input type="hidden" name="product_id" value={p.product_id}/>
       <input type="hidden" name="expected_quantity" value={p.available_quantity}/>
       <label><span className="label">New available quantity</span><input className="input" name="available_quantity" type="number" min="0" max="100000" step="1" defaultValue={p.available_quantity} required/></label>
       <label><span className="label">Reason / পরিবর্তনের কারণ</span><input className="input" name="reason" minLength={8} maxLength={300} required placeholder="Supplier confirms 25 units available"/></label>
       <SubmitButton className="whitespace-nowrap">Save allocation</SubmitButton>
      </form>}
    <p className="muted text-xs">This is an audited update to future sellable allocation, not a stock receipt, price edit, fulfilled order or payment verification. Existing locked Deal/Pool quotes cannot be repriced here.</p>
   </article>)}
   {!error&&!results.length&&<p className="card muted">{needle?'No matching products. Clear search and try again.':'No active catalog products yet. Upload a product first.'}</p>}
  </section>
 </div></AdminShell>
}
