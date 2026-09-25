import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { dateTime, taka } from '@/lib/format'

export const dynamic = 'force-dynamic'
const n = (value: unknown) => Number(value ?? 0) || 0

export default async function SuperAdminPaymentsPage() {
  const { supabase } = await requireSuperAdmin()
  const [{ data: orders }, { data: records }, { data: profiles }] = await Promise.all([
    supabase.from('orders').select('id,order_code,customer_id,status,payment_status,payment_method,payment_reference,total_amount,created_at,completed_at').order('created_at',{ascending:false}),
    supabase.from('payment_records').select('id,order_id,status,method,reference_number,amount,notes,created_at').order('created_at',{ascending:false}),
    supabase.from('profiles').select('id,full_name,phone'),
  ])
  const allOrders = (orders ?? []) as any[]
  const allRecords = (records ?? []) as any[]
  const customerById = new Map(((profiles ?? []) as any[]).map(p=>[p.id,p]))
  const exposureStatuses = new Set(['unpaid','payment_pending','cash_on_pickup'])
  const openOrders = allOrders.filter(o=>o.status!=='cancelled')
  const exposure = openOrders.filter(o=>exposureStatuses.has(o.payment_status)).reduce((sum,o)=>sum+n(o.total_amount),0)
  const paid = allOrders.filter(o=>o.payment_status==='paid_manually').reduce((sum,o)=>sum+n(o.total_amount),0)
  const refunded = allOrders.filter(o=>o.payment_status==='refunded').reduce((sum,o)=>sum+n(o.total_amount),0)
  const cashPickup = allOrders.filter(o=>o.payment_status==='cash_on_pickup').reduce((sum,o)=>sum+n(o.total_amount),0)

  return <SuperAdminShell><div className="grid gap-5">
    <section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Finance control</p><h1 className="mt-1 text-3xl font-black">Payments & cash exposure</h1><p className="muted mt-1">Read-only owner view of order payment status and recorded transactions.</p></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Outstanding exposure',taka(exposure)],['Paid manually',taka(paid)],['Cash on pickup',taka(cashPickup)],['Refunded',taka(refunded)]].map(([label,value])=><div className="card" key={label}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div></div>)}</section>
    <section><div className="mb-3"><div className="card-title">Orders</div><h2 className="section-title">Payment status by order</h2></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Order status</th><th>Payment</th><th>Method</th><th>Amount</th><th>Created</th></tr></thead><tbody>{allOrders.length?allOrders.map(o=>{const p=customerById.get(o.customer_id);return <tr key={o.id}><td><b>{o.order_code}</b><div className="muted">{o.id.slice(0,8)}</div></td><td>{p?.full_name ?? '—'}<div className="muted">{p?.phone ?? ''}</div></td><td>{o.status}</td><td><b>{o.payment_status}</b></td><td>{o.payment_method ?? '—'}</td><td>{taka(o.total_amount)}</td><td>{dateTime(o.created_at)}</td></tr>}):<tr><td colSpan={7} className="text-slate-500">No orders yet.</td></tr>}</tbody></table></div></section>
    <section><div className="mb-3"><div className="card-title">Ledger</div><h2 className="section-title">Recorded payment events</h2></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Order</th><th>Status</th><th>Method</th><th>Reference</th><th>Amount</th><th>Notes</th></tr></thead><tbody>{allRecords.length?allRecords.map(r=><tr key={r.id}><td>{dateTime(r.created_at)}</td><td>{r.order_id.slice(0,8)}</td><td>{r.status}</td><td>{r.method ?? '—'}</td><td>{r.reference_number ?? '—'}</td><td>{taka(r.amount)}</td><td>{r.notes ?? '—'}</td></tr>):<tr><td colSpan={7} className="text-slate-500">No payment records yet.</td></tr>}</tbody></table></div></section>
    <div className="notice">Platform revenue, gross margin and operating expenses are not yet modeled in the database, so this page intentionally shows cash/order exposure rather than inventing profit.</div>
  </div></SuperAdminShell>
}
