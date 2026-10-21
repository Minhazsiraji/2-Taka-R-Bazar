import Link from 'next/link'
import {requireAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {saveVendorOfferDraft} from '@/app/actions/vendor-offers'

export const dynamic='force-dynamic'
type S={notice?:string;error?:string}
type Draft={product_id:string;supplier_id:string;vendor_unit_cost:number;proposed_sale_price:number;supplier_handover_days:number;status:string}
type PriceLine={sku:string;vendor_unit_cost:number;proposed_sale_price:number;audit_id:number}
const taka=(v:number)=>'৳'+v.toLocaleString('en-BD',{maximumFractionDigits:2})
export default async function VendorQuickOffers({searchParams}:{searchParams:Promise<S>}){
 const sp=await searchParams
 const {supabase:db}=await requireAdmin()
 const [productsResult,suppliersResult,linksResult,plansResult,pricingResult]=await Promise.all([
  db.from('products').select('id,name,sku,package_size,source_type').eq('active',true).eq('is_demo',false).order('created_at'),
  db.from('suppliers').select('id,business_name,active,reliability_status').eq('active',true),
  db.from('supplier_products').select('product_id,supplier_id').eq('active',true),
  db.from('vendor_offer_drafts').select('product_id,supplier_id,vendor_unit_cost,proposed_sale_price,supplier_handover_days,status'),
  db.rpc('vendor_offer_admin_price_snapshot'),
 ])
 const products=productsResult.data??[],suppliers=suppliersResult.data??[],links=linksResult.data??[]
 const plans=(plansResult.data??[]) as Draft[]
 const sourceLines=(pricingResult.data??[]) as PriceLine[]
 const currentAuditId=sourceLines[0]?.audit_id??null
 const bySku=new Map(sourceLines.map(line=>[line.sku,line]))
 const planFor=(productId:string,supplierId:string)=>plans.find(p=>p.product_id===productId&&p.supplier_id===supplierId)
 const rows=products.filter(p=>p.source_type==='SUPPLIER_POOL').map(p=>{
  const supplierIds=links.filter(l=>l.product_id===p.id).map(l=>l.supplier_id)
  const vendor=suppliers.find(s=>supplierIds.includes(s.id)&&s.reliability_status!=='blocked')
  const plan=vendor?planFor(p.id,vendor.id):undefined
  const sourceLine=bySku.get(p.sku)
  return {product:p,vendor,plan,sourceLine}
 })
 const missingMigration=Boolean(plansResult.error||pricingResult.error)
 return <AdminShell><div className="grid gap-4">
  <section className="card">
   <p className="card-title">2TBR · Vendor-held / on demand</p>
   <h1 className="mt-2 text-2xl font-black">Quick Offer Setup</h1>
   <p className="muted mt-2">Price proposals, not customer-orderable offers. Confirm real supply for each booking. No fabricated stock, payment, inventory reservation or automatic checkout. SEO/AEO/GEO is optional.</p>
   <div className="mt-3 flex flex-wrap gap-2"><Link className="btn-secondary" href="/admin/easy-business">← Easy Business</Link><Link className="btn-secondary" href="/admin/pilot-bookings">Manual booking approvals</Link><Link className="btn-secondary" href="/admin/payment-recipients">Payment receiving accounts</Link></div>
   {currentAuditId&&<p className="muted mt-3 text-xs">Current unpublished owner proposal: audit #{currentAuditId}. Earlier revisions remain preserved.</p>}
  </section>
  {sp.notice&&<p role="status" className="success">{sp.notice}</p>}
  {sp.error&&<p role="alert" className="error">{sp.error}</p>}
  {missingMigration&&<p role="status" className="notice">This Preview is read-only until the secure Quick Offer migration is qualified and deployed. You can review proposed prices now; saving is disabled.</p>}
  {(productsResult.error||suppliersResult.error||linksResult.error||pricingResult.error)&&
   <p role="alert" className="error">Some catalog information is unavailable. Refresh before editing.</p>}
  <section className="grid gap-3">
  {rows.map(({product,vendor,plan,sourceLine})=>{
   const cost=Number(plan?.vendor_unit_cost??sourceLine?.vendor_unit_cost??0)
   const sale=Number(plan?.proposed_sale_price??sourceLine?.proposed_sale_price??0)
   const ready=Boolean(vendor&&cost>0&&sale>cost)
   return <article className="card" key={product.id}>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><h2 className="text-lg font-black">{product.name} · {product.package_size}</h2><p className="muted mt-1 text-xs">{product.sku} · {vendor?.business_name??'Vendor not linked'}</p></div>
     <span className="chip">{plan?'Draft saved':ready?'Ready to save draft':'Needs price/vendor'}</span>
    </div>
    <form action={saveVendorOfferDraft} className="mt-4 grid gap-3 sm:grid-cols-2">
     <input type="hidden" name="product_id" value={product.id}/>
     <input type="hidden" name="supplier_id" value={vendor?.id??''}/>
     <label className="grid gap-1 text-sm font-bold">Vendor purchase cost (৳)
      <input className="input" name="cost" type="number" step="0.01" min="0.01" defaultValue={cost||''} required/>
     </label>
     <label className="grid gap-1 text-sm font-bold">Proposed customer selling price (৳)
      <input className="input" name="sell" type="number" step="0.01" min="0.01" defaultValue={sale||''} required/>
     </label>
     <label className="grid gap-1 text-sm font-bold">Vendor handover after accepted order
      <select name="handover_days" className="input" defaultValue={String(plan?.supplier_handover_days??1)}>
       <option value="1">Next day (1 day)</option><option value="2">2 days</option><option value="3">3 days</option>
      </select>
     </label>
     <p className="rounded-xl border p-3 text-sm">Supply: <b>Vendor-held, on demand</b><span className="block text-xs">Confirm availability per accepted booking. Not a guaranteed customer delivery time.</span></p>
     <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-semibold">Gross spread: {ready?taka(sale-cost):'—'} / selling package (before additional costs)</span>
      <button type="submit" className="btn-primary" disabled={missingMigration||!ready}>Save draft · no publication</button>
     </div>
    </form>
   </article>
  })}
  {!rows.length&&<p className="card">No active real vendor products are available for Quick Offer Setup.</p>}
  </section>
  <section className="notice">
   <b>Next manual checkout:</b> Customers can submit a <Link className="underline" href="/pilot-book">pilot booking request</Link>. Staff confirm the correct price, vendor availability, pickup/delivery time and fees in the <Link className="underline" href="/admin/pilot-bookings">booking inbox</Link>. Only then does the customer see owner-activated payment options and submit a transaction reference for independent staff review. Posting Finance/Treasury requires its existing separate controls.
  </section>
 </div></AdminShell>
}
