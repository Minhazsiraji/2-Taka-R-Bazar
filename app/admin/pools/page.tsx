import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { addPoolItem, setPoolStatus, enterSupplierQuote, finalizePoolItem } from '@/app/actions/admin'
import { createPoolV2, setPoolPickupOptions } from '@/app/actions/pools'
import { requireAdmin } from '@/lib/auth'
import { StatusPill } from '@/components/status-pill'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'
const nextStatus:Record<string,string>={draft:'open',open:'pricing',pricing:'final_price',final_price:'confirmation',confirmation:'ordered',ordered:'ready_for_pickup',ready_for_pickup:'completed'}

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase:db}=await requireAdmin(); const sp=await searchParams
  const [{data:communities},{data:products},{data:suppliers},{data:pickups},{data:pools},{data:poolPickupRows}]=await Promise.all([
    db.from('communities').select('id,name').eq('active',true).order('sort_order'),
    db.from('products').select('id,name,package_size').eq('active',true).order('name'),
    db.from('suppliers').select('id,business_name').eq('active',true).order('business_name'),
    db.from('pickup_points').select('id,community_id,name,address').eq('active',true).order('name'),
    db.from('pools').select('*,communities(name),pool_items(*,products(name,package_size),supplier_quotes(*,suppliers(business_name)),commitments(id,quantity,status))').order('created_at',{ascending:false}).limit(30),
    db.from('pool_pickup_points').select('pool_id,pickup_point_id'),
  ])
  const selectedPickups=new Map<string,Set<string>>()
  ;(poolPickupRows??[]).forEach((row:any)=>{if(!selectedPickups.has(row.pool_id))selectedPickups.set(row.pool_id,new Set());selectedPickups.get(row.pool_id)!.add(row.pickup_point_id)})

  return <AdminShell><div className="grid min-w-0 gap-5">
    <section><h1 className="text-2xl font-black sm:text-3xl">Pools</h1><p className="muted mt-1">Create weekly or monthly community pools. Each pool can contain multiple items and only the pickup points you enable.</p></section>
    <Flash {...sp}/>
    <form action={createPoolV2} className="card form-grid">
      <h2 className="section-title md:col-span-2">Create draft pool</h2>
      <label><span className="label">Pool cycle</span><select className="input" name="cadence" defaultValue="weekly"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label><span className="label">Visible to community</span><select className="input" name="community_id" required><option value="">Choose community</option>{communities?.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className="label">Pool title</span><input className="input" name="title" placeholder="Amin Model Town Weekly Grocery Pool" required/></label>
      <label><span className="label">Opens at</span><input className="input" type="datetime-local" name="opens_at"/></label>
      <label><span className="label">Commitment closes</span><input className="input" type="datetime-local" name="commitment_closes_at"/></label>
      <label><span className="label">Confirmation closes</span><input className="input" type="datetime-local" name="confirmation_closes_at"/></label>
      <label><span className="label">Pickup target</span><input className="input" type="datetime-local" name="pickup_at"/></label>
      <textarea className="input min-h-20 md:col-span-2" name="notes" placeholder="Operational notes"/>
      <SubmitButton>Create draft</SubmitButton>
    </form>

    <div className="grid gap-5">{pools?.map((p:any)=>{const chosen=selectedPickups.get(p.id)??new Set<string>();const communityPickups=(pickups??[]).filter((x:any)=>x.community_id===p.community_id);return <section className="card min-w-0" key={p.id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="chip capitalize">{p.cadence??'weekly'}</span><span className="text-xs font-bold uppercase text-slate-500">{p.communities?.name}</span></div><h2 className="mt-2 text-xl font-black sm:text-2xl">{p.title}</h2></div><StatusPill status={p.status}/></div>

      {!['completed','cancelled'].includes(p.status)&&<form action={setPoolPickupOptions} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><input type="hidden" name="pool_id" value={p.id}/><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><b>Available pickup choices</b><p className="muted">Customers can choose only from these locations when confirming this pool.</p></div><SubmitButton className="btn-secondary">Save pickup options</SubmitButton></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{communityPickups.length?communityPickups.map((point:any)=><label key={point.id} className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"><input type="checkbox" name="pickup_point_ids" value={point.id} defaultChecked={chosen.has(point.id)}/><span><b>{point.name}</b><br/><span className="text-slate-500">{point.address}</span></span></label>):<p className="muted sm:col-span-2">No active pickup point exists in this community yet.</p>}</div></form>}

      {p.status==='draft'&&<form action={addPoolItem} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-5"><input type="hidden" name="pool_id" value={p.id}/><select className="input md:col-span-2" name="product_id" required><option value="">Add another product</option>{products?.map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.package_size}</option>)}</select><input className="input" type="number" step="0.01" min="0" name="expected_pool_price" placeholder="Expected pool price"/><input className="input" type="number" min="1" name="max_quantity" defaultValue="20"/><SubmitButton>Add item</SubmitButton></form>}

      <div className="mt-4 grid gap-3"><h3 className="font-black">Items in this pool ({(p.pool_items??[]).length})</h3>{(p.pool_items??[]).map((i:any)=>{const demand=(i.commitments??[]).filter((c:any)=>['active','confirmed'].includes(c.status)).reduce((s:number,c:any)=>s+Number(c.quantity),0);return <div className="min-w-0 rounded-xl border border-slate-200 p-3" key={i.id}><div><b>{i.products?.name} · {i.products?.package_size}</b><p className="muted">Benchmark {taka(i.benchmark_price_snapshot)} · Demand {demand} · Final {i.final_customer_price?taka(i.final_customer_price):'pending'}</p></div>{['pricing','final_price'].includes(p.status)&&<form action={enterSupplierQuote} className="mt-3 grid gap-2 bg-slate-50 p-3 md:grid-cols-4"><input type="hidden" name="pool_item_id" value={i.id}/><select className="input" name="supplier_id" required><option value="">Supplier</option>{suppliers?.map((s:any)=><option key={s.id} value={s.id}>{s.business_name}</option>)}</select><input className="input" type="number" min="1" name="quantity" defaultValue={Math.max(demand,1)} required/><input className="input" type="number" min="0.01" step="0.01" name="quoted_unit_price" placeholder="Quoted/unit" required/><input className="input" type="number" min="0" step="0.01" name="delivery_cost" placeholder="Delivery cost"/><input className="input" type="number" min="0.01" step="0.01" name="landed_unit_price" placeholder="Landed/unit" required/><input className="input" type="number" min="0" name="available_quantity" placeholder="Available qty"/><input className="input" type="date" name="delivery_date"/><input className="input" name="payment_terms" placeholder="Payment terms"/><SubmitButton className="btn-secondary">Add quote</SubmitButton></form>}{(i.supplier_quotes??[]).length>0&&<div className="table-wrap mt-3"><table><thead><tr><th>Supplier</th><th>Quoted</th><th>Landed</th><th>Available</th><th>Selected</th></tr></thead><tbody>{i.supplier_quotes.map((q:any)=><tr key={q.id}><td>{q.suppliers?.business_name}</td><td>{taka(q.quoted_unit_price)}</td><td>{taka(q.landed_unit_price)}</td><td>{q.available_quantity??'—'}</td><td>{q.selected?'Yes':'No'}</td></tr>)}</tbody></table></div>}{['pricing','final_price'].includes(p.status)&&(i.supplier_quotes??[]).length>0&&<form action={finalizePoolItem} className="mt-3 grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 md:grid-cols-4"><input type="hidden" name="pool_item_id" value={i.id}/><select className="input" name="quote_id" required><option value="">Winning quote</option>{i.supplier_quotes.map((q:any)=><option key={q.id} value={q.id}>{q.suppliers?.business_name} · landed {taka(q.landed_unit_price)}</option>)}</select><input className="input" type="number" min="0.01" step="0.01" name="final_customer_price" placeholder="Final customer price" defaultValue={i.final_customer_price??''} required/><input className="input" name="reason" placeholder="Why selected" required/><SubmitButton>Finalize item</SubmitButton></form>}</div>})}</div>

      {nextStatus[p.status]&&<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"><form action={setPoolStatus}><input type="hidden" name="pool_id" value={p.id}/><input type="hidden" name="status" value={nextStatus[p.status]}/><SubmitButton className="w-full sm:w-auto">Move to {nextStatus[p.status].replaceAll('_',' ')}</SubmitButton></form>{p.status!=='ready_for_pickup'&&<form action={setPoolStatus}><input type="hidden" name="pool_id" value={p.id}/><input type="hidden" name="status" value="cancelled"/><SubmitButton className="btn-danger w-full sm:w-auto">Cancel pool</SubmitButton></form>}</div>}
    </section>})}</div>
  </div></AdminShell>
}
