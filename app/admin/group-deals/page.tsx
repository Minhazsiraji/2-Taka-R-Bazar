import { AdminShell } from '@/components/admin-shell'
import { SubmitButton } from '@/components/submit-button'
import { Flash } from '@/components/flash'
import { requireAdmin } from '@/lib/auth'
import { createGroupDeal, linkSupplierAccount, linkSupplierProduct, setGroupDealStatus, updateCommunityGeo } from '@/app/actions/group-deal-admin'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function GroupDealAdminPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin()
  const sp=await searchParams
  const [{data:products},{data:communities},{data:suppliers},{data:profiles},{data:deals}]=await Promise.all([
    supabase.from('products').select('id,name,brand,package_size,sku').eq('active',true).order('name'),
    supabase.from('communities').select('*').order('sort_order'),
    supabase.from('suppliers').select('id,business_name,reliability_status').eq('active',true).order('business_name'),
    supabase.from('profiles').select('id,full_name,phone').order('created_at',{ascending:false}).limit(300),
    supabase.from('group_deals').select('*,products(name,brand,package_size,sku),group_deal_tiers(buyer_threshold,customer_unit_price),group_deal_communities(community_id)').order('created_at',{ascending:false}),
  ])

  return <AdminShell><div className="grid gap-5">
    <section><div className="card-title">Growth engine</div><h1 className="text-2xl font-black sm:text-3xl">Group Deals + Supplier Network</h1><p className="muted mt-1">Separate from the standard Pool. Minimum 5 qualified buyers, auto nearby circles, GPS/community verification, locked pricing tiers and supplier-only aggregate demand.</p></section>
    <Flash {...sp}/>

    <section className="card p-4 sm:p-5">
      <div className="card-title">Create Group Deal</div><h2 className="mt-1 text-xl font-black">5+ buyer price ladder</h2>
      <form action={createGroupDeal} className="mt-4 grid gap-4 md:grid-cols-2">
        <label><span className="label">Product</span><select className="input" name="product_id" required><option value="">Choose product</option>{products?.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {p.package_size} · {p.sku}</option>)}</select></label>
        <label><span className="label">Deal title</span><input className="input" name="title" placeholder="Neighbour group deal" required/></label>
        <label><span className="label">Market reference price</span><input className="input" name="market_price" type="number" min="0.01" step="0.01" required/></label>
        <label><span className="label">Price tiers</span><textarea className="input min-h-24" name="tiers" placeholder={"5: 950\n10: 930\n25: 910"} required/></label>
        <label><span className="label">Open time</span><input className="input" name="opens_at" type="datetime-local" required/></label>
        <label><span className="label">Close time</span><input className="input" name="closes_at" type="datetime-local" required/></label>
        <label><span className="label">Target fulfilment</span><input className="input" name="pickup_at" type="datetime-local" required/></label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label><span className="label">Minimum</span><input className="input" name="min_group_size" type="number" min="5" defaultValue="5" required/></label>
          <label><span className="label">Circle size</span><select className="input" name="circle_capacity" defaultValue="10"><option value="5">5</option><option value="10">10</option></select></label>
          <label><span className="label">Nearby radius (m)</span><input className="input" name="circle_radius_m" type="number" min="100" max="3000" defaultValue="750" required/></label>
          <label><span className="label">Max qty</span><input className="input" name="max_quantity" type="number" min="1" max="100" defaultValue="20" required/></label>
        </div>
        <fieldset className="rounded-xl border border-slate-200 p-3 md:col-span-2"><legend className="px-2 text-sm font-black">Communities</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{communities?.filter((c:any)=>c.active).map((c:any)=><label className="flex items-center gap-2" key={c.id}><input type="checkbox" name="community_id" value={c.id}/><span>{c.name}</span></label>)}</div></fieldset>
        <SubmitButton className="md:w-fit">Create draft deal</SubmitButton>
      </form>
    </section>

    <section className="card p-4 sm:p-5">
      <div className="card-title">Sharp location gate</div><h2 className="mt-1 text-xl font-black">Community GPS matching</h2><p className="muted mt-1 text-sm">Use a verified community center/radius now; polygon zones can be loaded directly into the database later for building/block-level boundaries.</p>
      <div className="mt-4 grid gap-3">{communities?.map((c:any)=><form action={updateCommunityGeo} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_140px_140px_130px_auto]" key={c.id}>
        <input type="hidden" name="community_id" value={c.id}/><div><b>{c.name}</b><p className="muted text-xs">{c.location_matching_enabled?'Matching active':'Matching off'}</p></div>
        <input className="input" name="center_latitude" type="number" step="0.0000001" defaultValue={c.center_latitude??''} placeholder="Latitude"/>
        <input className="input" name="center_longitude" type="number" step="0.0000001" defaultValue={c.center_longitude??''} placeholder="Longitude"/>
        <input className="input" name="match_radius_m" type="number" min="100" max="10000" defaultValue={c.match_radius_m??1500}/>
        <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="location_matching_enabled" defaultChecked={c.location_matching_enabled}/>Active</label><SubmitButton>Save</SubmitButton></div>
      </form>)}</div>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <form action={linkSupplierProduct} className="card grid gap-3 p-4"><div><div className="card-title">Supplier catalog</div><h2 className="text-xl font-black">Link supplier → product</h2></div><select className="input" name="supplier_id" required><option value="">Supplier</option>{suppliers?.map((s:any)=><option key={s.id} value={s.id}>{s.business_name}</option>)}</select><select className="input" name="product_id" required><option value="">Product</option>{products?.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><select className="input" name="relationship_type" defaultValue="supplier"><option value="manufacturer">Manufacturer</option><option value="distributor">Distributor</option><option value="supplier">Supplier</option><option value="vendor">Vendor</option></select><input className="input" name="supplier_sku" placeholder="Supplier SKU (optional)"/><SubmitButton>Link product</SubmitButton></form>

      <form action={linkSupplierAccount} className="card grid gap-3 p-4"><div><div className="card-title">Supplier login</div><h2 className="text-xl font-black">Link signed-in account → supplier</h2></div><select className="input" name="supplier_id" required><option value="">Supplier</option>{suppliers?.map((s:any)=><option key={s.id} value={s.id}>{s.business_name}</option>)}</select><select className="input" name="user_id" required><option value="">Customer/account</option>{profiles?.map((p:any)=><option key={p.id} value={p.id}>{p.full_name||'Unnamed'} · {p.phone||p.id}</option>)}</select><select className="input" name="role" defaultValue="analyst"><option value="owner">Owner</option><option value="manager">Manager</option><option value="analyst">Analyst</option></select><SubmitButton>Grant supplier access</SubmitButton></form>
    </section>

    <section>
      <div className="mb-3"><div className="card-title">Deal control</div><h2 className="text-xl font-black">Current Group Deals</h2></div>
      <div className="grid gap-3">{deals?.map((d:any)=><details className="card" key={d.id}><summary className="cursor-pointer"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{d.title}</b><p className="muted text-sm">{d.products?.name} · market {taka(Number(d.market_price_snapshot))}</p></div><span className="chip capitalize">{String(d.status).replaceAll('_',' ')}</span></div></summary><div className="mt-4 grid gap-3"><div className="flex flex-wrap gap-2">{(d.group_deal_tiers??[]).sort((a:any,b:any)=>a.buyer_threshold-b.buyer_threshold).map((t:any)=><span className="chip" key={t.buyer_threshold}>{t.buyer_threshold} buyers → {taka(Number(t.customer_unit_price))}</span>)}</div>{d.locked_unit_price&&<p className="text-sm font-bold">Locked: {d.locked_buyer_count} buyers · {d.locked_unit_quantity} units · {taka(Number(d.locked_unit_price))}</p>}<form action={setGroupDealStatus} className="flex flex-wrap items-end gap-2"><input type="hidden" name="group_deal_id" value={d.id}/><label><span className="label">Next status</span><select className="input" name="status" required><option value="">Choose</option>{d.status==='draft'&&<><option value="open">Open</option><option value="cancelled">Cancel</option></>}{d.status==='open'&&<><option value="locked">Lock demand</option><option value="cancelled">Cancel</option></>}{d.status==='locked'&&<><option value="procurement">Procurement</option><option value="cancelled">Cancel</option></>}{d.status==='procurement'&&<><option value="fulfilling">Fulfilling</option><option value="cancelled">Cancel</option></>}{d.status==='fulfilling'&&<><option value="completed">Complete</option><option value="cancelled">Cancel</option></>}</select></label><label className="min-w-[240px] flex-1"><span className="label">Reason / note</span><input className="input" name="reason" placeholder="Required for cancellation"/></label><SubmitButton>Apply</SubmitButton></form></div></details>)}</div>
    </section>
  </div></AdminShell>
}
