import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { addPoolItem, setPoolStatus, enterSupplierQuote, finalizePoolItem } from '@/app/actions/admin'
import { createPoolV2, setPoolPickupOptions, updateDraftPool, resetPoolToDraft } from '@/app/actions/pools'
import { requireAdmin } from '@/lib/auth'
import { StatusPill } from '@/components/status-pill'
import { taka, shortDate } from '@/lib/format'

export const dynamic='force-dynamic'
const nextStatus:Record<string,string>={draft:'open',open:'pricing',pricing:'final_price',final_price:'confirmation',confirmation:'ordered',ordered:'ready_for_pickup',ready_for_pickup:'completed'}
const dt=(value:string|null)=>value?new Date(value).toISOString().slice(0,16):''

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase:db}=await requireAdmin(); const sp=await searchParams
  const [communitiesR,productsR,suppliersR,pickupsR,poolsR,poolItemsR,quotesR,commitmentsR,poolPickupR,benchmarksR,ordersR]=await Promise.all([
    db.from('communities').select('id,name').eq('active',true).order('sort_order'),
    db.from('products').select('id,name,package_size').eq('active',true).order('name'),
    db.from('suppliers').select('id,business_name').eq('active',true).order('business_name'),
    db.from('pickup_points').select('id,community_id,name,address').eq('active',true).order('name'),
    db.from('pools').select('id,community_id,title,status,cadence,opens_at,commitment_closes_at,confirmation_closes_at,pickup_at,created_at,notes').order('created_at',{ascending:false}).limit(30),
    db.from('pool_items').select('id,pool_id,product_id,benchmark_price_snapshot,expected_pool_price,final_customer_price,min_quantity,max_quantity,active'),
    db.from('supplier_quotes').select('id,pool_item_id,supplier_id,quantity,quoted_unit_price,landed_unit_price,available_quantity,selected'),
    db.from('commitments').select('id,pool_item_id,quantity,status'),
    db.from('pool_pickup_points').select('pool_id,pickup_point_id'),
    db.from('market_price_benchmarks').select('product_id,community_id,benchmark_price').eq('approved',true).is('superseded_at',null),
    db.from('orders').select('id,pool_id,status'),
  ])

  const communities=communitiesR.data??[]; const products=productsR.data??[]; const suppliers=suppliersR.data??[]; const pickups=pickupsR.data??[]; const pools=poolsR.data??[]
  const poolItems=poolItemsR.data??[]; const quotes=quotesR.data??[]; const commitments=commitmentsR.data??[]; const poolPickupRows=poolPickupR.data??[]; const benchmarks=benchmarksR.data??[]; const orders=ordersR.data??[]
  const communityById=new Map(communities.map((x:any)=>[x.id,x])); const productById=new Map(products.map((x:any)=>[x.id,x])); const supplierById=new Map(suppliers.map((x:any)=>[x.id,x]))
  const selectedPickups=new Map<string,Set<string>>(); poolPickupRows.forEach((r:any)=>{if(!selectedPickups.has(r.pool_id))selectedPickups.set(r.pool_id,new Set());selectedPickups.get(r.pool_id)!.add(r.pickup_point_id)})
  const itemsByPool=new Map<string,any[]>(); poolItems.forEach((i:any)=>{if(!itemsByPool.has(i.pool_id))itemsByPool.set(i.pool_id,[]);itemsByPool.get(i.pool_id)!.push(i)})
  const quotesByItem=new Map<string,any[]>(); quotes.forEach((q:any)=>{if(!quotesByItem.has(q.pool_item_id))quotesByItem.set(q.pool_item_id,[]);quotesByItem.get(q.pool_item_id)!.push(q)})
  const commitmentsByItem=new Map<string,any[]>(); commitments.forEach((c:any)=>{if(!commitmentsByItem.has(c.pool_item_id))commitmentsByItem.set(c.pool_item_id,[]);commitmentsByItem.get(c.pool_item_id)!.push(c)})
  const benchmarkByKey=new Map(benchmarks.map((b:any)=>[`${b.community_id}:${b.product_id}`,Number(b.benchmark_price)]))

  return <AdminShell><div className="grid min-w-0 gap-5">
    <section><h1 className="text-2xl font-black sm:text-3xl">Pools</h1><p className="muted mt-1">Create the pool once, then manage that same pool below. Draft → add products → pickup choices → Open → collect demand → Pricing → final price → customer confirmation.</p></section>
    <Flash {...sp}/>

    <form action={createPoolV2} className="card form-grid">
      <h2 className="section-title md:col-span-2">Create a new draft pool</h2>
      <label><span className="label">Pool cycle</span><select className="input" name="cadence" defaultValue="weekly"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label><span className="label">Visible to community</span><select className="input" name="community_id" required><option value="">Choose community</option>{communities.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className="label">Pool title</span><input className="input" name="title" placeholder="Amin Model Town Weekly Grocery Pool" required/></label>
      <label><span className="label">Opens at</span><input className="input" type="datetime-local" name="opens_at"/></label>
      <label><span className="label">Commitment closes</span><input className="input" type="datetime-local" name="commitment_closes_at"/></label>
      <label><span className="label">Confirmation closes</span><input className="input" type="datetime-local" name="confirmation_closes_at"/></label>
      <label><span className="label">Pickup target</span><input className="input" type="datetime-local" name="pickup_at"/></label>
      <textarea className="input min-h-20 md:col-span-2" name="notes" placeholder="Operational notes"/>
      <SubmitButton>Create draft</SubmitButton>
    </form>

    <section className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><div className="card-title">Existing pools</div><h2 className="text-2xl font-black">Manage your created pools</h2><p className="muted mt-1">Draft pools are private. Customers see a pool only after you move it to Open.</p></div><span className="chip">{pools.length} pool{pools.length===1?'':'s'}</span></section>

    {pools.length===0?<div className="card"><b>No pools found.</b><p className="muted mt-2">Create a draft using the form above.</p></div>:<div className="grid gap-5">{pools.map((p:any)=>{
      const chosen=selectedPickups.get(p.id)??new Set<string>(); const communityPickups=pickups.filter((x:any)=>x.community_id===p.community_id); const items=itemsByPool.get(p.id)??[]
      const eligibleProducts=products.filter((x:any)=>benchmarkByKey.has(`${p.community_id}:${x.id}`)); const community=communityById.get(p.community_id) as any
      const poolCommitments=items.flatMap((i:any)=>commitmentsByItem.get(i.id)??[]); const poolQuotes=items.flatMap((i:any)=>quotesByItem.get(i.id)??[]); const poolOrders=orders.filter((o:any)=>o.pool_id===p.id)
      const canReturnToDraft=['open','pricing'].includes(p.status)&&poolCommitments.length===0&&poolQuotes.length===0&&poolOrders.length===0
      return <section className="card border-slate-300" key={p.id}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="chip capitalize">{p.cadence??'weekly'}</span><span className="text-xs font-bold uppercase text-slate-500">{community?.name??'Unknown community'}</span></div><h2 className="mt-2 text-xl font-black sm:text-2xl">{p.title}</h2><p className="muted mt-1">Created {shortDate(p.created_at)} · {items.length} item{items.length===1?'':'s'} · {chosen.size} pickup option{chosen.size===1?'':'s'}</p></div><StatusPill status={p.status}/></div>

        {canReturnToDraft&&<div className="notice mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><b>This pool has no customer activity yet.</b><p className="mt-1">If it was advanced by mistake, return it to Draft so you can edit details and add products.</p></div><form action={resetPoolToDraft}><input type="hidden" name="pool_id" value={p.id}/><SubmitButton className="btn-secondary whitespace-nowrap">Return to Draft</SubmitButton></form></div>}

        {p.status==='draft'&&<>
          <div className="notice mt-4"><b>Draft = not visible to customers.</b> Complete Steps 1–3 below. The system will block Open until the pool has at least one product, one pickup option, and a valid timeline.</div>
          <form action={updateDraftPool} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2">
            <input type="hidden" name="pool_id" value={p.id}/><div className="md:col-span-2"><b>1. Pool setup</b><p className="muted">Community is locked to {community?.name}. You can safely correct title, cycle and dates while Draft.</p></div>
            <label><span className="label">Pool title</span><input className="input" name="title" defaultValue={p.title} required/></label>
            <label><span className="label">Cycle</span><select className="input" name="cadence" defaultValue={p.cadence??'weekly'}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            <label><span className="label">Opens at</span><input className="input" type="datetime-local" name="opens_at" defaultValue={dt(p.opens_at)}/></label>
            <label><span className="label">Commitment closes</span><input className="input" type="datetime-local" name="commitment_closes_at" defaultValue={dt(p.commitment_closes_at)}/></label>
            <label><span className="label">Confirmation closes</span><input className="input" type="datetime-local" name="confirmation_closes_at" defaultValue={dt(p.confirmation_closes_at)}/></label>
            <label><span className="label">Pickup target</span><input className="input" type="datetime-local" name="pickup_at" defaultValue={dt(p.pickup_at)}/></label>
            <label className="md:col-span-2"><span className="label">Notes</span><textarea className="input min-h-20" name="notes" defaultValue={p.notes??''}/></label>
            <SubmitButton className="md:w-fit">Save draft setup</SubmitButton>
          </form>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-3"><b>2. Add products and planning price</b><p className="muted">Market benchmark = normal local price used to prove saving. Expected pool price = your optional planning estimate. The final customer price comes later after supplier quotations.</p></div><div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><span className="chip">{eligibleProducts.length} of {products.length} products ready</span><Link href="/admin/market-prices" className="font-black underline">Set / review market benchmarks →</Link></div>{eligibleProducts.length?<form action={addPoolItem} className="grid gap-2 md:grid-cols-5"><input type="hidden" name="pool_id" value={p.id}/><label className="md:col-span-2"><span className="label">Product</span><select className="input" name="product_id" required><option value="">Choose product</option>{eligibleProducts.map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.package_size} · benchmark {taka(benchmarkByKey.get(`${p.community_id}:${x.id}`)??0)}</option>)}</select></label><label><span className="label">Expected pool price</span><input className="input" type="number" step="0.01" min="0" name="expected_pool_price" placeholder="Optional"/></label><label><span className="label">Max / household</span><input className="input" type="number" min="1" name="max_quantity" defaultValue="20"/></label><div className="self-end"><SubmitButton className="w-full">Add product</SubmitButton></div></form>:<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>The product selector is intentionally locked because no product has an approved {community?.name} market benchmark yet.</b><p className="mt-1">Go to <Link href="/admin/market-prices" className="font-black underline">Market prices</Link>, approve the current local price for the product, then return here. The product will immediately appear in this selector.</p></div>}</div>
        </>}

        {!['completed','cancelled'].includes(p.status)&&<form action={setPoolPickupOptions} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><input type="hidden" name="pool_id" value={p.id}/><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><b>{p.status==='draft'?'3':'2'}. Available pickup choices</b><p className="muted">Customers can choose only from these locations when confirming this pool.</p></div><SubmitButton className="btn-secondary">Save pickup options</SubmitButton></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{communityPickups.length?communityPickups.map((point:any)=><label key={point.id} className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"><input type="checkbox" name="pickup_point_ids" value={point.id} defaultChecked={chosen.has(point.id)}/><span><b>{point.name}</b><br/><span className="text-slate-500">{point.address}</span></span></label>):<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">No active pickup point exists for {community?.name}. <Link href="/admin/pickup-points" className="font-black underline">Create pickup point →</Link></div>}</div></form>}

        <div className="mt-4 grid gap-3"><h3 className="font-black">{p.status==='draft'?'4':'3'}. Items in this pool ({items.length})</h3>{items.length===0?<div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No product has been added yet.</div>:items.map((i:any)=>{const product=productById.get(i.product_id) as any; const itemQuotes=quotesByItem.get(i.id)??[]; const itemCommitments=commitmentsByItem.get(i.id)??[]; const demand=itemCommitments.filter((c:any)=>['active','confirmed'].includes(c.status)).reduce((s:number,c:any)=>s+Number(c.quantity),0);return <div className="min-w-0 rounded-xl border border-slate-200 p-3" key={i.id}><div><b>{product?.name} · {product?.package_size}</b><p className="muted">Market benchmark {taka(i.benchmark_price_snapshot)} · Expected pool {i.expected_pool_price?taka(i.expected_pool_price):'not set'} · Demand {demand} · Final {i.final_customer_price?taka(i.final_customer_price):'pending'}</p></div>{['pricing','final_price'].includes(p.status)&&<form action={enterSupplierQuote} className="mt-3 grid gap-2 bg-slate-50 p-3 md:grid-cols-4"><input type="hidden" name="pool_item_id" value={i.id}/><select className="input" name="supplier_id" required><option value="">Supplier</option>{suppliers.map((s:any)=><option key={s.id} value={s.id}>{s.business_name}</option>)}</select><input className="input" type="number" min="1" name="quantity" defaultValue={Math.max(demand,1)} required/><input className="input" type="number" min="0.01" step="0.01" name="quoted_unit_price" placeholder="Quoted/unit" required/><input className="input" type="number" min="0" step="0.01" name="delivery_cost" placeholder="Delivery cost"/><input className="input" type="number" min="0.01" step="0.01" name="landed_unit_price" placeholder="Landed/unit" required/><input className="input" type="number" min="0" name="available_quantity" placeholder="Available qty"/><input className="input" type="date" name="delivery_date"/><input className="input" name="payment_terms" placeholder="Payment terms"/><SubmitButton className="btn-secondary">Add quote</SubmitButton></form>}{itemQuotes.length>0&&<div className="table-wrap mt-3"><table><thead><tr><th>Supplier</th><th>Quoted</th><th>Landed</th><th>Available</th><th>Selected</th></tr></thead><tbody>{itemQuotes.map((q:any)=><tr key={q.id}><td>{(supplierById.get(q.supplier_id) as any)?.business_name}</td><td>{taka(q.quoted_unit_price)}</td><td>{taka(q.landed_unit_price)}</td><td>{q.available_quantity??'—'}</td><td>{q.selected?'Yes':'No'}</td></tr>)}</tbody></table></div>}{['pricing','final_price'].includes(p.status)&&itemQuotes.length>0&&<form action={finalizePoolItem} className="mt-3 grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 md:grid-cols-4"><input type="hidden" name="pool_item_id" value={i.id}/><select className="input" name="quote_id" required><option value="">Winning quote</option>{itemQuotes.map((q:any)=><option key={q.id} value={q.id}>{(supplierById.get(q.supplier_id) as any)?.business_name} · landed {taka(q.landed_unit_price)}</option>)}</select><input className="input" type="number" min="0.01" step="0.01" name="final_customer_price" placeholder="Final customer price" defaultValue={i.final_customer_price??''} required/><input className="input" name="reason" placeholder="Why selected" required/><SubmitButton>Finalize item</SubmitButton></form>}</div>})}</div>

        {nextStatus[p.status]&&<div className="mt-4 rounded-xl border border-slate-200 bg-white p-3"><b>{p.status==='draft'?'5':'4'}. Publish / advance this pool</b><p className="muted mt-1">{p.status==='draft'?'Open makes this pool visible to customers in '+(community?.name??'this community')+'. You cannot open an empty pool.':'Advance only after the current stage is complete. The backend now blocks unsafe stage changes.'}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"><form action={setPoolStatus}><input type="hidden" name="pool_id" value={p.id}/><input type="hidden" name="status" value={nextStatus[p.status]}/><SubmitButton className="w-full sm:w-auto">Move to {nextStatus[p.status].replaceAll('_',' ')}</SubmitButton></form>{p.status!=='ready_for_pickup'&&<form action={setPoolStatus}><input type="hidden" name="pool_id" value={p.id}/><input type="hidden" name="status" value="cancelled"/><SubmitButton className="btn-danger w-full sm:w-auto">Cancel pool</SubmitButton></form>}</div></div>}
      </section>})}</div>}
  </div></AdminShell>
}
