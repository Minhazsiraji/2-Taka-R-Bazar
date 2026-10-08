import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import { taka } from '@/lib/format'

export const dynamic='force-dynamic'

export default async function AdminDashboard(){
  const {supabase:db}=await requireAdmin()
  const week=new Date(Date.now()-7*864e5).toISOString()

  const [
    {count:households},
    {count:pools},
    {count:commitments},
    {count:orders},
    {data:savings},
    {count:issues},
    {data:recentCommitments},
    {data:recentOrders},
    {data:qrRows,error:qrError},
  ]=await Promise.all([
    db.from('profiles').select('id',{count:'exact',head:true}).not('onboarding_completed_at','is',null),
    db.from('pools').select('id',{count:'exact',head:true}).in('status',['open','pricing','final_price','confirmation','ordered','ready_for_pickup']),
    db.from('commitments').select('id',{count:'exact',head:true}).in('status',['active','confirmed']),
    db.from('orders').select('id',{count:'exact',head:true}).neq('status','cancelled'),
    db.from('savings_ledger').select('amount'),
    db.from('operational_issues').select('id',{count:'exact',head:true}).neq('status','resolved'),
    db.from('commitments').select('customer_id').gte('updated_at',week),
    db.from('orders').select('customer_id,status,total_amount').gte('created_at',week),
    db.rpc('get_admin_community_qr_stats'),
  ])

  const verified=(savings??[]).reduce((sum:number,row:any)=>sum+Number(row.amount),0)
  const weeklyActive=new Set([...(recentCommitments??[]).map((r:any)=>r.customer_id),...(recentOrders??[]).map((r:any)=>r.customer_id)]).size
  const confirmed=(recentOrders??[]).filter((r:any)=>r.status!=='cancelled').length
  const completed=(recentOrders??[]).filter((r:any)=>r.status==='completed').length
  const fulfilment=confirmed?Math.round(completed/confirmed*100):0

  return <AdminShell><div className="grid gap-5">
    <section><h1 className="text-3xl font-black">Operations dashboard</h1><p className="muted">Pilot controls and real database-derived KPIs.</p></section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Registered households',households??0],
        ['Weekly active households',weeklyActive],
        ['Active pools',pools??0],
        ['Active commitments',commitments??0],
        ['Confirmed orders',orders??0],
        ['Fulfilment · 7d',`${fulfilment}%`],
        ['Verified savings',taka(verified)],
        ['Open issues',issues??0],
      ].map(([label,value])=><div className="card" key={String(label)}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div></div>)}
    </div>

    <section className="card grid gap-4">
      <div>
        <div className="card-title">Community QR acquisition</div>
        <h2 className="mt-1 text-2xl font-black">Poster → signup → community → completed buyer</h2>
        <p className="muted mt-1">A scan is tracked separately. It does not count as a member, commitment or order.</p>
      </div>

      {qrError
        ? <div className="error">QR campaign statistics are temporarily unavailable.</div>
        : !(qrRows??[]).length
          ? <p className="muted text-sm">No community QR campaigns are configured yet.</p>
          : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Code</th><th className="px-3 py-2">Community</th><th className="px-3 py-2">Campaign / placement</th><th className="px-3 py-2 text-right">Scans</th><th className="px-3 py-2 text-right">Joined</th><th className="px-3 py-2 text-right">Completed buyers</th></tr></thead>
              <tbody>{(qrRows??[]).map((row:any)=><tr key={row.code} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-mono font-black">{row.code}</td><td className="px-3 py-3 font-bold">{row.community_name}</td><td className="px-3 py-3"><div>{row.campaign_name}</div><div className="muted text-xs">{row.placement??'—'}</div></td><td className="px-3 py-3 text-right font-black">{row.scan_count}</td><td className="px-3 py-3 text-right font-black">{row.joined_count}</td><td className="px-3 py-3 text-right font-black">{row.buyers_with_completed_order}</td></tr>)}</tbody>
            </table></div>}
    </section>

    <div className="notice">Pilot dashboards must use real operational data. Demo products may be seeded, but production metrics and supplier pricing are never fabricated.</div>
  </div></AdminShell>
}
