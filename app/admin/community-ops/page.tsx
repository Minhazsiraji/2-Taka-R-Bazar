import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { requireAdmin } from '@/lib/auth'
import { taka } from '@/lib/format'
import { assignCommunityOperator,removeCommunityOperator,adminAcceptCommunityCash } from '@/app/actions/community-ops'

export const dynamic='force-dynamic'

export default async function AdminCommunityOpsPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin();const sp=await searchParams
  const [
    {data:communities},
    {data:roles},
    {data:assignments},
    {data:days},
  ]=await Promise.all([
    supabase.from('communities').select('id,name,active').eq('active',true).order('sort_order'),
    supabase.from('user_roles').select('user_id').eq('role','pickup_operator'),
    supabase.rpc('admin_get_community_ops_assignments'),
    supabase.rpc('admin_get_community_ops_days',{p_limit:200}),
  ])
  const operatorIds=(roles??[]).map((r:any)=>r.user_id)
  const {data:operators}=operatorIds.length?await supabase.from('profiles').select('id,full_name,phone,email').in('id',operatorIds):{data:[] as any[]}

  return <AdminShell><div className="grid gap-5">
    <section><div className="card-title">Community Operations</div><h1 className="text-3xl font-black">Live community reconciliation</h1><p className="muted mt-1">Monitor goods, customer handover, Product COD, Home Delivery fees, officer reports, exceptions and office cash handover community by community.</p></section>
    <Flash error={sp.error} notice={sp.notice}/>

    <section className="grid gap-4 xl:grid-cols-2">
      <form action={assignCommunityOperator} className="card grid gap-3">
        <h2 className="section-title">Assign Community Operations Officer</h2>
        <p className="muted text-sm">The user must already have the pickup_operator role. Assignment limits their operational scope to the selected community.</p>
        <select className="input" name="user_id" required><option value="">Officer</option>{(operators??[]).map((o:any)=><option key={o.id} value={o.id}>{o.full_name||o.phone||o.email||o.id}</option>)}</select>
        <select className="input" name="community_id" required><option value="">Community</option>{(communities??[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <SubmitButton>Assign community</SubmitButton>
      </form>
      <div className="card">
        <h2 className="section-title">Current assignments</h2>
        <div className="mt-3 grid gap-2">{!(assignments??[]).length?<p className="muted text-sm">No community officer assignments yet.</p>:(assignments??[]).map((a:any)=><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3" key={a.user_id+'-'+a.community_id}><div><b>{a.operator_name||a.operator_phone||a.user_id}</b><div className="muted text-sm">{a.community_name} · {a.active?'Active':'Inactive'}</div></div>{a.active&&<form action={removeCommunityOperator}><input type="hidden" name="user_id" value={a.user_id}/><input type="hidden" name="community_id" value={a.community_id}/><SubmitButton className="btn-danger">Remove</SubmitButton></form>}</div>)}</div>
      </div>
    </section>

    <section>
      <div className="mb-3"><div className="card-title">Daily transaction result</div><h2 className="section-title">Community reconciliation ledger</h2><p className="muted text-sm">Cash remains split between Product COD and Home Delivery fees all the way through officer submission and Admin/Accounts receipt.</p></div>
      <div className="grid gap-3">{!(days??[]).length?<div className="card muted">No community operations days yet.</div>:(days??[]).map((d:any)=><article className="card" key={d.day_id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">{d.community_name}</h3><p className="muted">{String(d.business_date)} · {d.operator_name||'Officer'}</p></div><span className="chip capitalize">{String(d.status).replaceAll('_',' ')}</span></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Orders</div><b>{d.completed_orders}/{d.total_orders}</b><div className="muted text-xs">{d.exception_orders} exception</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Product COD collected</div><b>{taka(Number(d.product_cod_collected??0))}</b><div className="muted text-xs">Submitted {d.product_cod_submitted==null?'—':taka(Number(d.product_cod_submitted))}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Delivery fees collected</div><b>{taka(Number(d.delivery_fees_collected??0))}</b><div className="muted text-xs">Submitted {d.delivery_fees_submitted==null?'—':taka(Number(d.delivery_fees_submitted))}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Office cash received</div><b>{d.product_cod_received==null&&d.delivery_fees_received==null?'Pending':taka(Number(d.product_cod_received??0)+Number(d.delivery_fees_received??0))}</b><div className="muted text-xs">{d.accepted_with_exception?'Accepted with exception':'Standard reconciliation'}</div></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><Link className="btn-secondary" href={'/community-ops?day='+encodeURIComponent(d.day_id)}>Open full community ledger</Link></div>

        {['cash_handover_pending','exception'].includes(d.status)&&<form action={adminAcceptCommunityCash} className="mt-4 grid gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3 md:grid-cols-4">
          <input type="hidden" name="day_id" value={d.day_id}/>
          <label><span className="label">Product COD physically received</span><input className="input" type="number" min="0" step="0.01" name="product_cod_received" defaultValue={Number(d.product_cod_submitted??0)} required/></label>
          <label><span className="label">Delivery fees physically received</span><input className="input" type="number" min="0" step="0.01" name="delivery_fees_received" defaultValue={Number(d.delivery_fees_submitted??0)} required/></label>
          <label className="md:col-span-2"><span className="label">Admin / Accounts note</span><input className="input" name="note" placeholder="Required when accepting any variance or exception"/></label>
          <label className="flex items-center gap-2 md:col-span-3"><input type="checkbox" name="accept_exceptions"/><span className="text-sm font-bold">Explicitly accept documented order/cash exception(s) and close the day</span></label>
          <SubmitButton>Accept cash & close day</SubmitButton>
        </form>}
      </article>)}</div>
    </section>
  </div></AdminShell>
}
