import {requireAdmin} from '@/lib/auth'
import {AdminShell} from '@/components/admin-shell'
import {SubmitButton} from '@/components/submit-button'
import {registerDeliveryBuilding,reviewDeliveryAddress} from '@/app/actions/delivery-location-admin'
import Link from 'next/link'

export const dynamic='force-dynamic'

type Query={error?:string;notice?:string}
type Building={id:string;community_id:string;display_name:string;zone_code:string;building_code:string}
type Review={id:string;community_id:string;community_name:string;building_label:string;unit_label:string;street_line:string;landmark:string|null}

export default async function AdminDeliveryLocations({searchParams}:{searchParams:Promise<Query>}){
 const {supabase}=await requireAdmin()
 const [{data:communities},{data:buildings,error:buildingError},{data:reviews,error:reviewError},query]=await Promise.all([
  supabase.from('communities').select('id,name').eq('active',true).order('name'),
  supabase.rpc('admin_list_delivery_buildings'),
  supabase.rpc('admin_list_delivery_address_reviews'),
  searchParams,
 ])
 const existing=(buildings??[]) as Building[]
 const pending=(reviews??[]) as Review[]
 return <AdminShell><div className="grid gap-5">
  <section><Link href="/admin" className="text-sm font-bold underline">← Operations</Link>
   <h1 className="mt-2 text-2xl font-black">Verified delivery locations</h1>
   <p className="muted mt-1 text-sm">Customers confirm only their address. Operations maps it to a trusted building; no GPS guess is allowed to assign a household to a delivery bundle.</p>
  </section>
  {query.error&&<div className="error">{query.error}</div>}{query.notice&&<div className="success">{query.notice}</div>}
  {(buildingError||reviewError)&&<div className="notice">Location review is not available until the Issue #64 database migrations are installed in the isolated environment.</div>}
  <section className="card grid gap-3 p-4">
   <div><div className="card-title">Verified building catalog</div><h2 className="text-lg font-black">Register a physically checked building</h2><p className="muted text-xs">A new building needs an operator evidence note. Customers cannot create trusted building identifiers.</p></div>
   <form action={registerDeliveryBuilding} className="grid gap-3 sm:grid-cols-2">
    <label><span className="label">Community</span><select className="input" name="community_id" required><option value="">Select community</option>{(communities??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label><span className="label">Delivery zone code</span><input name="zone_code" className="input" required maxLength={60} placeholder="e.g. AMT-NORTH"/></label>
    <label><span className="label">Building ID / code</span><input name="building_code" className="input" required maxLength={60} placeholder="e.g. BLOCK-A-BLDG-4"/></label>
    <label><span className="label">Building name</span><input name="display_name" className="input" required maxLength={180} placeholder="e.g. Building 4, Block A"/></label>
    <label className="sm:col-span-2"><span className="label">Physical verification evidence</span><textarea name="evidence_note" className="input min-h-20" minLength={10} maxLength={500} required placeholder="How and by whom was this building identified?"/></label>
    <div className="sm:col-span-2"><SubmitButton>Register verified building</SubmitButton></div>
   </form>
  </section>
  <section className="card grid gap-4 p-4">
   <div><div className="card-title">Customer addresses awaiting review</div><h2 className="text-lg font-black">{pending.length} pending</h2><p className="muted text-xs">Only staff can confirm a household's building; this does not create an order or collect payment.</p></div>
   {pending.length===0&&<p className="muted text-sm">No pending addresses, or the verification service is awaiting migration.</p>}
   {pending.map(item=>{
    const options=existing.filter(b=>b.community_id===item.community_id)
    return <form action={reviewDeliveryAddress} key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
     <input type="hidden" name="address_id" value={item.id}/>
     <div className="sm:col-span-2"><b>{item.community_name}</b><p className="text-sm">{[item.unit_label,item.building_label,item.street_line,item.landmark].filter(Boolean).join(', ')}</p></div>
     <label><span className="label">Match to verified building</span><select name="building_id" className="input" defaultValue=""><option value="">Choose a checked building</option>{options.map(b=><option key={b.id} value={b.id}>{b.display_name} ({b.zone_code})</option>)}</select></label>
     <label><span className="label">Evidence / review reason</span><textarea className="input min-h-20" name="evidence_note" minLength={10} maxLength={500} required placeholder="Verification source or reason for rejection"/></label>
     <div className="flex flex-wrap gap-2 sm:col-span-2">
      <button type="submit" name="decision" value="approve" className="btn-primary" disabled={options.length===0}>Verify address</button>
      <button type="submit" name="decision" value="reject" className="btn-secondary">Reject and request correction</button>
     </div>
    </form>
   })}
  </section>
  <section className="notice">Only operator-verified addresses tied to the same trusted building, community, supplier group and delivery window can be considered for bundle allocation. Capacity and order-status checks still apply.</section>
 </div></AdminShell>
}
