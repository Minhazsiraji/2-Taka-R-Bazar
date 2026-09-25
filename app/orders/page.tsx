import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { SubmitButton } from '@/components/submit-button'
import { confirmCommitment, reportCustomerIssue } from '@/app/actions/customer'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, dateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{error?:string;notice?:string}> }) {
  const { user, roles, supabase } = await requireOnboardedUser()
  const {error,notice}=await searchParams
  const [{data:commitments},{data:orders}] = await Promise.all([
    supabase.from('commitments').select('*,pool_items(*,products(name,package_size),pools(id,title,status))').eq('customer_id',user.id).order('committed_at',{ascending:false}),
    supabase.from('orders').select('*,pickup_points(name,address,google_maps_url),order_items(*,products(name,package_size))').eq('customer_id',user.id).order('created_at',{ascending:false}),
  ])
  const confirmable=(commitments??[]).filter((c:any)=>c.status==='active' && c.pool_items?.pools?.status==='confirmation')
  return <AppShell roles={roles}><div className="grid gap-5"><section><h1 className="text-3xl font-black">My commitments & orders</h1><p className="muted">A commitment stays separate from a confirmed purchase.</p></section>{error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}
    {confirmable.length>0&&<section className="grid gap-3"><h2 className="section-title">Final price needs your confirmation</h2>{confirmable.map((c:any)=>{const i=c.pool_items; const saving=Math.max(0,Number(i.benchmark_price_snapshot)-Number(i.final_customer_price))*Number(c.quantity); return <div className="card" key={c.id}><div className="flex flex-wrap justify-between gap-3"><div><b className="text-lg">{i.products?.name} · {i.products?.package_size}</b><p className="muted">{i.pools?.title} · Quantity {c.quantity}</p><p className="mt-2">Final price: <b>{taka(i.final_customer_price)}</b> × {c.quantity} · Potential saving <b className="text-emerald-700">{taka(saving)}</b></p></div><form action={confirmCommitment}><input type="hidden" name="commitment_id" value={c.id}/><SubmitButton>Confirm purchase</SubmitButton></form></div></div>})}</section>}
    <section className="grid gap-3"><h2 className="section-title">Confirmed orders</h2>{(orders??[]).length===0?<div className="card muted">No confirmed orders yet.</div>:(orders??[]).map((o:any)=><article className="card" key={o.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{o.order_code}</h3><p className="muted">Confirmed {dateTime(o.confirmed_at)}</p></div><StatusPill status={o.status}/></div><div className="mt-3 grid gap-2">{(o.order_items??[]).map((i:any)=><div className="flex justify-between gap-3 border-t border-slate-100 pt-2" key={i.id}><span>{i.products?.name} × {i.quantity}</span><b>{taka(Number(i.unit_price)*Number(i.quantity))}</b></div>)}</div><p className="mt-3 font-black">Total {taka(o.total_amount)}</p>{o.pickup_points&&<p className="muted mt-2">Pickup: {o.pickup_points.name} · {o.pickup_points.address}</p>}
      {o.status!=='completed'&&o.status!=='cancelled'&&<details className="mt-4"><summary className="cursor-pointer font-bold">Report an issue</summary><form action={reportCustomerIssue} className="mt-3 grid gap-2"><input type="hidden" name="order_id" value={o.id}/><select className="input" name="issue_type" required><option value="">Issue type</option><option value="missing">Missing item</option><option value="damaged">Damaged item</option><option value="wrong_item">Wrong item</option><option value="other">Other</option></select><textarea className="input min-h-24" name="description" required/><SubmitButton className="btn-secondary">Send issue</SubmitButton></form></details>}</article>)}</section>
  </div></AppShell>
}
