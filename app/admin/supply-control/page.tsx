import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { requireAdmin } from '@/lib/auth'
import {
  adminCreateSupplyLocation,adminAssignSupplyLocationMember,adminLinkSupplierSupplyAccount,
  adminAuthorizeSupplyDispatch,adminAssignSupplyCarrier,adminResolveSupplyVariance,
} from '@/app/actions/supply'

export const dynamic='force-dynamic'

export default async function SupplyControlAdmin({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin();const sp=await searchParams
  const [
    {data:locations},
    {data:dispatches},
    {data:fraud},
    {data:suppliers},
    {data:profiles},
  ]=await Promise.all([
    supabase.rpc('admin_get_supply_locations'),
    supabase.rpc('admin_get_supply_dispatches',{p_limit:200}),
    supabase.rpc('admin_get_supply_fraud_events',{p_limit:100}),
    supabase.from('suppliers').select('id,business_name,active,reliability_status').eq('active',true).order('business_name'),
    supabase.from('profiles').select('id,full_name,phone,email').not('onboarding_completed_at','is',null).order('full_name').limit(500),
  ])

  return <AdminShell><div className="grid gap-5">
    <section><div className="card-title">Supply Handover & Fraud Control</div><h1 className="text-3xl font-black">Supply control center</h1><p className="muted mt-1">Manage supplier/store identities, chain of custody, one-time receiving verification, mismatches, separation of duties and fraud review.</p></section>
    <Flash error={sp.error} notice={sp.notice}/>

    <section className="grid gap-4 xl:grid-cols-3">
      <form action={adminCreateSupplyLocation} className="card grid gap-3">
        <h2 className="section-title">Create 2TBR store / warehouse</h2>
        <input className="input" name="name" placeholder="Location name" required/>
        <select className="input" name="location_type"><option value="store">Store</option><option value="warehouse">Warehouse</option><option value="hub">Hub</option></select>
        <input className="input" name="address" placeholder="Address"/>
        <SubmitButton>Create location</SubmitButton>
      </form>

      <form action={adminAssignSupplyLocationMember} className="card grid gap-3">
        <h2 className="section-title">Assign store/warehouse staff</h2>
        <select className="input" name="location_id" required><option value="">Location</option>{(locations??[]).filter((l:any)=>l.active).map((l:any)=><option value={l.location_id} key={l.location_id}>{l.name} · {l.location_type}</option>)}</select>
        <select className="input" name="user_id" required><option value="">Staff account</option>{(profiles??[]).map((p:any)=><option value={p.id} key={p.id}>{p.full_name||p.phone||p.email||p.id}</option>)}</select>
        <select className="input" name="role"><option value="manager">Manager</option><option value="storekeeper">Storekeeper</option><option value="viewer">Viewer</option></select>
        <SubmitButton>Assign internal account</SubmitButton>
      </form>

      <form action={adminLinkSupplierSupplyAccount} className="card grid gap-3">
        <h2 className="section-title">Link supplier staff account</h2>
        <select className="input" name="supplier_id" required><option value="">Supplier</option>{(suppliers??[]).map((s:any)=><option value={s.id} key={s.id}>{s.business_name} · {s.reliability_status}</option>)}</select>
        <select className="input" name="user_id" required><option value="">Staff account</option>{(profiles??[]).map((p:any)=><option value={p.id} key={p.id}>{p.full_name||p.phone||p.email||p.id}</option>)}</select>
        <select className="input" name="role"><option value="owner">Owner</option><option value="manager">Manager</option><option value="analyst">Analyst (read only)</option></select>
        <SubmitButton>Link supplier account</SubmitButton>
      </form>
    </section>

    <section className="card">
      <h2 className="section-title">Internal supply locations</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{!(locations??[]).length?<p className="muted">No internal locations yet.</p>:(locations??[]).map((l:any)=><div className="rounded-xl border border-slate-200 p-3" key={l.location_id}><div className="flex justify-between gap-3"><div><b>{l.name}</b><div className="muted text-xs">{l.location_type} · {l.address||'No address'}</div></div><span className="chip">{l.active?'Active':'Inactive'}</span></div><div className="mt-2 grid gap-1 text-xs">{(l.members??[]).map((m:any)=><div key={m.user_id}>{m.name||m.phone||m.user_id} · <b>{m.role}</b>{m.active?'':' · inactive'}</div>)}</div></div>)}</div>
    </section>

    <section>
      <div className="mb-3"><div className="card-title">Live chain of custody</div><h2 className="section-title">Dispatches needing attention first</h2></div>
      <div className="grid gap-3">{!(dispatches??[]).length?<div className="card muted">No supply dispatches yet.</div>:(dispatches??[]).map((d:any)=><article className={'card '+(d.status==='security_hold'?'border-rose-300':d.status==='variance'?'border-amber-300':'')} key={d.dispatch_id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">{d.dispatch_code}</h3><p className="muted">{d.source_name} → {d.destination_name}</p><p className="muted text-xs">Source reference: <b>{d.source_reference}</b></p><p className="muted text-xs">Created by {d.creator_name||d.created_by}{d.carrier_name?' · Carrier '+d.carrier_name:''}{d.receiver_name?' · Received by '+d.receiver_name:''}</p></div><span className="chip capitalize">{String(d.status).replaceAll('_',' ')}</span></div>
          <div className="mt-3 grid gap-2">{(d.items??[]).map((i:any)=><div className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-slate-100 pt-2 text-sm" key={i.product_id}><span>{i.product_name} · {i.package_size}</span><span>Sent <b>{i.dispatched_quantity}</b></span><span>Net received <b>{i.net_accepted_quantity??'—'}</b></span></div>)}</div>
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3 text-sm"><div>Packages: <b>{d.package_count??'—'} → {d.observed_package_count??'—'}</b></div><div>Seal: <b>{d.seal_reference||'—'} → {d.observed_seal_reference||'—'}</b></div><div>Created: <b>{new Date(d.created_at).toLocaleString('en-BD')}</b></div></div>
          {d.variance_reason&&<div className="error mt-3">{d.variance_reason}</div>}
          {d.resolution&&<div className="success mt-3">Resolution: {String(d.resolution).replaceAll('_',' ')} · {d.resolution_reason}</div>}

          {d.source_kind==='supplier'&&d.status==='draft'&&!d.authorized_at&&<form action={adminAuthorizeSupplyDispatch} className="mt-4 grid gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end"><input type="hidden" name="dispatch_id" value={d.dispatch_id}/><label><span className="label">Authorization note</span><input className="input" name="note" placeholder="PO/procurement reference / approval basis"/></label><SubmitButton>Authorize supplier dispatch</SubmitButton></form>}
          {d.source_kind==='supplier'&&d.authorized_at&&<div className="success mt-3">Supplier dispatch independently authorized · {new Date(d.authorized_at).toLocaleString('en-BD')}{d.authorization_note?' · '+d.authorization_note:''}</div>}
          {d.status==='draft'||d.status==='sealed'?<form action={adminAssignSupplyCarrier} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"><input type="hidden" name="dispatch_id" value={d.dispatch_id}/><select className="input" name="user_id" required><option value="">Assign authenticated carrier (optional)</option>{(profiles??[]).filter((p:any)=>p.id!==d.created_by).map((p:any)=><option value={p.id} key={p.id}>{p.full_name||p.phone||p.email||p.id}</option>)}</select><SubmitButton className="btn-secondary">Assign carrier</SubmitButton></form>:null}

          {['sealed','in_transit'].includes(d.status)&&<form action={adminResolveSupplyVariance} className="mt-4 grid gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="dispatch_id" value={d.dispatch_id}/><input type="hidden" name="resolution" value="reset_for_reseal"/><input type="hidden" name="responsibility" value="none"/>
            <label><span className="label">Reset reason</span><input className="input" name="reason" required placeholder="Lost code / handover cancelled / reseal required"/></label>
            <SubmitButton className="btn-secondary">Reset for reseal</SubmitButton>
          </form>}
          {['variance','security_hold'].includes(d.status)&&<form action={adminResolveSupplyVariance} className="mt-4 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 lg:grid-cols-3">
            <input type="hidden" name="dispatch_id" value={d.dispatch_id}/>
            <select className="input" name="resolution" required><option value="">Resolution</option><option value="accept_receiver_count">Accept receiver count into original day stock</option><option value="replacement_pending">Replacement pending</option><option value="return_entire_batch">Return entire batch</option><option value="fraud_hold">Fraud hold</option><option value="reset_for_reseal">Reset unreceived security hold for resealing</option><option value="cancelled">Cancel dispatch</option></select>
            <select className="input" name="responsibility" required><option value="unknown">Responsibility unknown</option><option value="source">Source/sender</option><option value="receiver">Community receiver</option><option value="carrier">Carrier</option><option value="none">No fault / operational</option></select>
            <input className="input" name="reason" required placeholder="Independent Admin reason / evidence"/>
            <p className="muted text-xs lg:col-span-3">If receiver count is accepted, the backend posts it only to the original Community Ops day recorded at physical receiving. Admin cannot redirect stock to another day.</p>
            <div className="lg:col-span-3"><SubmitButton>Save independent resolution</SubmitButton></div>
          </form>}
        </article>)}</div>
    </section>

    <section className="card">
      <div className="card-title">Fraud & risk signals</div><h2 className="mt-1 text-xl font-black">Recent supply security events</h2>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Dispatch</th><th className="py-2 pr-3">Actor</th><th className="py-2 pr-3">Event</th><th className="py-2 pr-3">Severity</th></tr></thead><tbody>{(fraud??[]).map((e:any)=><tr className="border-b border-slate-100" key={e.event_id}><td className="py-3 pr-3">{new Date(e.created_at).toLocaleString('en-BD')}</td><td className="py-3 pr-3">{e.dispatch_code||'—'}</td><td className="py-3 pr-3">{e.actor_name||e.actor_user_id||'System'}</td><td className="py-3 pr-3">{String(e.event_type).replaceAll('_',' ')}</td><td className="py-3 pr-3"><span className="chip capitalize">{e.severity}</span></td></tr>)}</tbody></table>{!(fraud??[]).length&&<p className="muted py-4">No supply fraud events recorded.</p>}</div>
    </section>

    <section className="card text-sm"><b>Control rule:</b> the same person cannot act as sender, carrier and receiver for one dispatch, and a sender/receiver/carrier cannot independently resolve their own variance. Exact matches auto-verify; mismatches stay outside verified stock until Admin resolution.</section>
  </div></AdminShell>
}
