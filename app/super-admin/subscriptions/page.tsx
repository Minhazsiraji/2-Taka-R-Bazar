import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { dateTime, taka } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function Page(){
  const {supabase}=await requireSuperAdmin()
  const [{data:invoices},{data:memberships},{data:settings}]=await Promise.all([
    supabase.from('subscription_invoices').select('id,invoice_no,customer_id,amount,status,created_at,paid_at').order('created_at',{ascending:false}).limit(100),
    supabase.from('subscription_memberships').select('id,user_id,source,valid_until,created_at').order('created_at',{ascending:false}).limit(100),
    supabase.from('subscription_settings').select('enforcement_enabled,monthly_price,updated_at').eq('singleton',true).maybeSingle(),
  ])
  const customerIds=[...new Set((invoices??[]).map((i:any)=>i.customer_id))]
  const {data:profiles}=customerIds.length?await supabase.from('profiles').select('id,full_name,phone').in('id',customerIds):{data:[] as any[]}
  const profileById=new Map((profiles??[]).map((p:any)=>[p.id,p]))
  const openExposure=(invoices??[]).filter((i:any)=>['unpaid','payment_pending'].includes(i.status)).reduce((sum:number,i:any)=>sum+Number(i.amount),0)
  return <SuperAdminShell><div className="grid gap-5">
    <section><div className="card-title">Historical archive</div><h1 className="mt-1 text-3xl font-black">Membership billing — retired</h1><p className="muted mt-2 max-w-3xl">Subscription is no longer part of the 2-TAKA-R-BAZAR customer-access or revenue model. Historical records are preserved read-only for audit and reconciliation.</p></section>
    <div className="success"><b>Current rule:</b> community Pool access has no subscription fee. Procurement margin is the primary commercial model.</div>
    <section className="grid gap-3 sm:grid-cols-3"><div className="card"><div className="card-title">Enforcement</div><div className="metric text-2xl">{settings?.enforcement_enabled?'Legacy flag on':'OFF'}</div><p className="muted mt-1">The new commerce layer does not use this flag.</p></div><div className="card"><div className="card-title">Historical memberships</div><div className="metric text-2xl">{memberships?.length??0}</div></div><div className="card"><div className="card-title">Legacy open invoice exposure</div><div className="metric text-2xl">{taka(openExposure)}</div><p className="muted mt-1">Audit only; no new customer billing is generated.</p></div></section>
    <section><div className="mb-3"><div className="card-title">Legacy records</div><h2 className="section-title">Recent subscription invoices</h2></div><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th><th>Created</th><th>Paid</th></tr></thead><tbody>{(invoices??[]).length?(invoices??[]).map((i:any)=>{const p=profileById.get(i.customer_id) as any;return <tr key={i.id}><td><b>{i.invoice_no}</b></td><td>{p?.full_name??'—'}<br/><span className="muted">{p?.phone??''}</span></td><td>{taka(i.amount)}</td><td className="capitalize">{String(i.status).replaceAll('_',' ')}</td><td>{dateTime(i.created_at)}</td><td>{i.paid_at?dateTime(i.paid_at):'—'}</td></tr>}):<tr><td colSpan={6} className="muted">No historical invoices.</td></tr>}</tbody></table></div></section>
  </div></SuperAdminShell>
}
