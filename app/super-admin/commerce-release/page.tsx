import Link from 'next/link'
import {requireSuperAdmin} from '@/lib/auth'
import {SuperAdminShell} from '@/components/super-admin-shell'
import {PILOT_RETAIL_PROPOSALS,evaluatePilotProduct,type PilotProductRecord,type PilotSku,type PilotInventory,type PilotOfferRecord} from '@/lib/commerce/pilot-release-readiness'

export const dynamic='force-dynamic'

type RowProduct=PilotProductRecord&{id:string}
type RowOffer=PilotOfferRecord&{id:string}
export default async function CommerceRelease(){
 const {supabase:db}=await requireSuperAdmin()
 const ids=PILOT_RETAIL_PROPOSALS.map(p=>p.sku)
 const [prod,skus,stock,offers,areas]=await Promise.all([
  db.from('products').select('id,sku,name,active,is_demo,package_size,unit').in('sku',ids),
  db.from('commerce_skus').select('id,product_id,sku,active'),
  db.from('own_product_inventory').select('product_id,stock_on_hand,reserved_quantity'),
  db.from('commerce_offers').select('id,sku_id,community_id,mode,status,is_synthetic,unit_price,valid_until'),
  db.from('communities').select('id,name,active').eq('active',true)
 ])
 const loadError=prod.error||skus.error||stock.error||offers.error||areas.error
 const community=(areas.data??[]).find(a=>a.name?.toLowerCase().includes('amin model town'))
 const data=loadError?[]:PILOT_RETAIL_PROPOSALS.map(expected=>{
  const product=(prod.data??[]).find(p=>p.sku===expected.sku) as RowProduct|undefined
  const sku=(skus.data??[]).find(s=>s.product_id===product?.id) as PilotSku|undefined
  const inv=(stock.data??[]).find(s=>s.product_id===product?.id) as PilotInventory|undefined
  const state=evaluatePilotProduct({expected,product:product??null,sku:sku??null,inventory:inv??null,
    offers:(offers.data??[]) as RowOffer[],communityId:community?.id??null,now:Date.now(),
    physicalStockVerified:false,fulfillmentVerified:false})
  return {expected,product,state}
 })
 const checkTotal=data.reduce((n,r)=>n+r.state.checks.filter(c=>c.ok).length,0)
 const expectedTotal=data.length*6
 return <SuperAdminShell><div className="grid gap-4">
  <section className="card">
   <div className="card-title">2TBR · ORDER RELEASE CONTROL</div>
   <h1 className="mt-1 text-2xl font-black">Customer order launch readiness</h1>
   <p className="muted mt-2">A read-only view of the proposed Amin Model Town Buy Alone pilot. It never publishes offers, turns on checkout, changes inventory, records COD or posts financial entries.</p>
   <div className="mt-3 flex flex-wrap gap-2">
    <span className="chip">Amin Model Town · pilot only</span>
    <span className="chip">Commerce Production checkout: Disabled</span>
    <span className="chip">No live ordering authorized</span>
   </div>
  </section>
  {loadError?<section className="card error" role="alert"><h2 className="font-black">Live records could not be fully verified</h2><p>Do not publish an offer or permit customer orders based on incomplete data. Refresh or ask an authorized operator to examine the database permissions and records.</p></section>:<>
   <section className="card" aria-label="Pilot qualification summary">
    <h2 className="text-xl font-black">Pilot checks</h2>
    <p className="muted mt-2">{checkTotal} of {expectedTotal} product prerequisites currently satisfied. Physical verification remains incomplete until independently evidenced, not just entered as a quantity.</p>
    <p className="mt-2 text-sm">Even when all product prerequisites pass, Production checkout also requires a separately approved database, Finance, and end-to-end release. This page does not unlock them.</p>
   </section>
   {data.map(row=><section key={row.expected.sku} className="card" aria-label={'Launch readiness for '+row.expected.label}>
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div><div className="card-title">{row.expected.sku}</div><h2 className="mt-1 text-xl font-black">{row.expected.label}</h2></div>
     <div className="text-right"><div className="card-title">Owner-proposed price · not a published offer</div><strong className="text-xl">৳{row.expected.price.toLocaleString('en-BD')}</strong></div>
    </div>
    <p className="muted mt-2 text-sm">Recorded stock: {row.state.availableUnits.toLocaleString('en-BD')} available units (unverified physical inventory). Original quantity and packaging evidence must be checked before sales.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
     {row.state.checks.map(check=><div key={check.id} className="rounded-xl border border-slate-200 bg-white/60 p-3">
      <b className="block">{check.ok?'✓ Ready':'○ Not ready'} · {check.label}</b>
      {!check.ok&&<p className="muted mt-1 text-xs">{check.help}</p>}
     </div>)}
    </div>
    {row.expected.requiresColdChain&&<p className="mt-3 rounded-xl border border-amber-300 p-3 text-sm">Duck Meat is priced by the kilogram. Its existing product metadata says pieces/mixed units. Do not release this product until quantity units, landed cost per kg, food safety and delivery evidence are reconciled.</p>}
   </section>)}
  </>}
  <section className="card">
   <h2 className="text-xl font-black">Actions required for a controlled launch</h2>
   <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl border border-slate-200 p-3">
     <b>1. Verify stock and product units</b>
     <p className="muted mt-1 text-sm">Confirm physical quantities and seller custody, inspect original receipts, correct Duck per-kg unit and validate handling policies. Keep synthetic figures separate.</p>
     <Link href="/admin/own-products" className="btn-secondary mt-3 inline-flex">Review product records →</Link>
    </div>
    <div className="rounded-xl border border-slate-200 p-3">
     <b>2. Independent offer and financial review</b>
     <p className="muted mt-1 text-sm">Approve real community-specific individual prices and stock evidence with a different reviewer. Test COD, cancellations, refunds, and reconciliation.</p>
     <Link href="/super-admin/finance" className="btn-secondary mt-3 inline-flex">Open controlled Finance →</Link>
    </div>
    <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
     <b>3. Production Commerce cutover — separately gated</b>
     <p className="muted mt-1 text-sm">Existing cart, checkout and fulfillment operate only in qualified synthetic Preview. Production requires an explicitly authorized, tested database and application release with rollback and no duplicate payments or orders. The customer storefront design must remain unchanged.</p>
     <a href="https://github.com/Minhazsiraji/2-Taka-R-Bazar/issues/64" className="btn-secondary mt-3 inline-flex" target="_blank" rel="noreferrer">Commerce release Issue #64 ↗</a>
    </div>
   </div>
  </section>
 </div></SuperAdminShell>
}
