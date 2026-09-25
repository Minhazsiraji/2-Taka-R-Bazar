import Link from 'next/link'
import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { dateTime, taka } from '@/lib/format'

export const dynamic = 'force-dynamic'

const activePoolStatuses = new Set(['open','pricing','final_price','confirmation','ordered','ready_for_pickup'])
const liveOrderStatuses = new Set(['confirmed','ordered','ready_for_pickup','completed'])
const unpaidStatuses = new Set(['unpaid','payment_pending','cash_on_pickup'])

const n = (value: unknown) => Number(value ?? 0) || 0
const pct = (part: number, total: number) => total > 0 ? Math.round(part / total * 100) : 0
const within = (value: string | null | undefined, since: Date) => Boolean(value && new Date(value) >= since)

export default async function SuperAdminDashboard() {
  const { supabase, profile } = await requireSuperAdmin()
  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 864e5)
  const since7 = new Date(now.getTime() - 7 * 864e5)

  const [profilesR, communitiesR, pickupsR, productsR, benchmarksR, suppliersR, poolsR, poolItemsR, commitmentsR, quotesR, ordersR, orderItemsR, savingsR, paymentsR, feedbackR, issuesR, auditR] = await Promise.all([
    supabase.from('profiles').select('id,full_name,community_id,onboarding_completed_at,created_at'),
    supabase.from('communities').select('id,name,active,sort_order').order('sort_order'),
    supabase.from('pickup_points').select('id,community_id,name,active'),
    supabase.from('products').select('id,name,brand,category,active,is_demo'),
    supabase.from('market_price_benchmarks').select('id,product_id,community_id,benchmark_price,approved,superseded_at,effective_from'),
    supabase.from('suppliers').select('id,business_name,reliability_status,active'),
    supabase.from('pools').select('id,community_id,title,status,opens_at,commitment_closes_at,confirmation_closes_at,pickup_at,created_at'),
    supabase.from('pool_items').select('id,pool_id,product_id,benchmark_price_snapshot,final_customer_price,expected_pool_price,active'),
    supabase.from('commitments').select('id,pool_item_id,customer_id,quantity,status,committed_at,confirmed_at,updated_at'),
    supabase.from('supplier_quotes').select('id,pool_item_id,supplier_id,quantity,landed_unit_price,selected,created_at'),
    supabase.from('orders').select('id,customer_id,pool_id,pickup_point_id,status,payment_status,total_amount,confirmed_at,completed_at,created_at'),
    supabase.from('order_items').select('id,order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price,expected_saving'),
    supabase.from('savings_ledger').select('id,customer_id,community_id,order_id,amount,benchmark_price,pool_unit_price,fulfilled_quantity,verified_at'),
    supabase.from('payment_records').select('id,order_id,status,method,amount,created_at'),
    supabase.from('feedback').select('id,order_id,customer_id,rating,testimonial_permission,review_status,created_at'),
    supabase.from('operational_issues').select('id,order_id,pool_id,issue_type,status,created_at,resolved_at'),
    supabase.from('audit_events').select('id,actor_user_id,event_type,entity_type,entity_id,metadata,created_at').order('created_at',{ascending:false}).limit(20),
  ])

  const profiles = (profilesR.data ?? []) as any[]
  const communities = (communitiesR.data ?? []) as any[]
  const pickups = (pickupsR.data ?? []) as any[]
  const products = (productsR.data ?? []) as any[]
  const benchmarks = (benchmarksR.data ?? []) as any[]
  const suppliers = (suppliersR.data ?? []) as any[]
  const pools = (poolsR.data ?? []) as any[]
  const poolItems = (poolItemsR.data ?? []) as any[]
  const commitments = (commitmentsR.data ?? []) as any[]
  const quotes = (quotesR.data ?? []) as any[]
  const orders = (ordersR.data ?? []) as any[]
  const orderItems = (orderItemsR.data ?? []) as any[]
  const savings = (savingsR.data ?? []) as any[]
  const payments = (paymentsR.data ?? []) as any[]
  const feedback = (feedbackR.data ?? []) as any[]
  const issues = (issuesR.data ?? []) as any[]
  const audit = (auditR.data ?? []) as any[]

  const communityById = new Map(communities.map(row => [row.id, row]))
  const poolById = new Map(pools.map(row => [row.id, row]))
  const poolItemById = new Map(poolItems.map(row => [row.id, row]))
  const orderById = new Map(orders.map(row => [row.id, row]))
  const productById = new Map(products.map(row => [row.id, row]))

  const onboarded = profiles.filter(row => row.onboarding_completed_at)
  const newHouseholds30 = onboarded.filter(row => within(row.onboarding_completed_at, since30)).length
  const activeHouseholds30 = new Set([
    ...commitments.filter(row => within(row.updated_at, since30)).map(row => row.customer_id),
    ...orders.filter(row => within(row.created_at, since30)).map(row => row.customer_id),
  ]).size
  const activePools = pools.filter(row => activePoolStatuses.has(row.status))
  const liveOrders = orders.filter(row => liveOrderStatuses.has(row.status))
  const completedOrders = orders.filter(row => row.status === 'completed')
  const gmv = liveOrders.reduce((sum,row)=>sum+n(row.total_amount),0)
  const gmv30 = liveOrders.filter(row => within(row.created_at, since30)).reduce((sum,row)=>sum+n(row.total_amount),0)
  const verifiedSavings = savings.reduce((sum,row)=>sum+n(row.amount),0)
  const savings30 = savings.filter(row => within(row.verified_at, since30)).reduce((sum,row)=>sum+n(row.amount),0)
  const marketValue = savings.reduce((sum,row)=>sum+n(row.benchmark_price)*n(row.fulfilled_quantity),0)
  const savingsRate = pct(verifiedSavings, marketValue)
  const unresolvedCommitments = commitments.filter(row => ['confirmed','withdrawn','cancelled'].includes(row.status))
  const confirmedCommitments = commitments.filter(row => row.status === 'confirmed').length
  const commitmentConversion = pct(confirmedCommitments, unresolvedCommitments.length)
  const fulfilmentRate = pct(completedOrders.length, liveOrders.length)
  const unpaidOrders = liveOrders.filter(row => unpaidStatuses.has(row.payment_status))
  const unpaidExposure = unpaidOrders.reduce((sum,row)=>sum+n(row.total_amount),0)
  const paidRecorded = payments.filter(row => row.status === 'paid_manually').reduce((sum,row)=>sum+n(row.amount),0)
  const openIssues = issues.filter(row => !['resolved','closed'].includes(row.status))
  const avgRating = feedback.length ? feedback.reduce((sum,row)=>sum+n(row.rating),0)/feedback.length : 0
  const approvedTestimonials = feedback.filter(row => row.testimonial_permission && row.review_status === 'approved').length
  const activePickups = pickups.filter(row => row.active)
  const activeSuppliers = suppliers.filter(row => row.active)
  const activeProducts = products.filter(row => row.active)
  const currentBenchmarkProducts = new Set(benchmarks.filter(row => row.approved && !row.superseded_at).map(row => row.product_id))
  const productsMissingBenchmark = activeProducts.filter(row => !currentBenchmarkProducts.has(row.id))

  const overduePools = activePools.filter(row => {
    if (row.status === 'open' && row.commitment_closes_at) return new Date(row.commitment_closes_at) < now
    if (['final_price','confirmation'].includes(row.status) && row.confirmation_closes_at) return new Date(row.confirmation_closes_at) < now
    return false
  })

  const decisionFlags = [
    activePools.length === 0 ? { level:'High', text:'No active pool is running. Create the next community pool to start demand collection.', href:'/admin/pools' } : null,
    activePickups.length === 0 ? { level:'High', text:'No active pickup point exists. Add at least one before final purchase confirmation.', href:'/admin/pickup-points' } : null,
    productsMissingBenchmark.length > 0 ? { level:'Medium', text:`${productsMissingBenchmark.length} active product(s) have no current approved market benchmark.`, href:'/admin/market-prices' } : null,
    overduePools.length > 0 ? { level:'High', text:`${overduePools.length} active pool(s) are past a configured deadline.`, href:'/admin/pools' } : null,
    openIssues.length > 0 ? { level:'High', text:`${openIssues.length} operational issue(s) need attention.`, href:'/admin/issues' } : null,
    unpaidExposure > 0 ? { level:'Medium', text:`${taka(unpaidExposure)} is currently exposed in unpaid/pending/cash-on-pickup orders.`, href:'/super-admin/payments' } : null,
    activeSuppliers.length === 0 ? { level:'Medium', text:'No active supplier is registered for quotation and sourcing.', href:'/admin/suppliers' } : null,
  ].filter(Boolean) as {level:string;text:string;href:string}[]

  const communityRows = communities.map(c => {
    const cPools = pools.filter(p => p.community_id === c.id)
    const poolIds = new Set(cPools.map(p => p.id))
    const cOrders = liveOrders.filter(o => poolIds.has(o.pool_id))
    const cIssues = openIssues.filter(i => (i.pool_id && poolIds.has(i.pool_id)) || (i.order_id && poolIds.has(orderById.get(i.order_id)?.pool_id)))
    return {
      id:c.id, name:c.name, active:c.active,
      households:onboarded.filter(p=>p.community_id===c.id).length,
      pools:cPools.filter(p=>activePoolStatuses.has(p.status)).length,
      orders:cOrders.length,
      gmv:cOrders.reduce((sum,o)=>sum+n(o.total_amount),0),
      savings:savings.filter(s=>s.community_id===c.id).reduce((sum,s)=>sum+n(s.amount),0),
      issues:cIssues.length,
    }
  })

  const productRows = products.map(product => {
    const itemIds = new Set(poolItems.filter(item=>item.product_id===product.id).map(item=>item.id))
    const cRows = commitments.filter(row=>itemIds.has(row.pool_item_id))
    const oRows = orderItems.filter(row=>row.product_id===product.id)
    return {
      id:product.id, name:product.name, category:product.category,
      committedQty:cRows.reduce((sum,row)=>sum+n(row.quantity),0),
      confirmedQty:cRows.filter(row=>row.status==='confirmed').reduce((sum,row)=>sum+n(row.quantity),0),
      orderedQty:oRows.reduce((sum,row)=>sum+n(row.quantity),0),
      value:oRows.reduce((sum,row)=>sum+n(row.unit_price)*n(row.quantity),0),
      expectedSaving:oRows.reduce((sum,row)=>sum+n(row.expected_saving),0),
    }
  }).sort((a,b)=>b.committedQty-a.committedQty).slice(0,8)
  const maxDemand = Math.max(1,...productRows.map(row=>row.committedQty))

  const supplierRows = suppliers.map(supplier => {
    const sQuotes = quotes.filter(q=>q.supplier_id===supplier.id)
    const selected = sQuotes.filter(q=>q.selected)
    return { id:supplier.id, name:supplier.business_name, reliability:supplier.reliability_status, active:supplier.active, quotes:sQuotes.length, selected:selected.length, winRate:pct(selected.length,sQuotes.length), avgLanded:sQuotes.length?sQuotes.reduce((sum,q)=>sum+n(q.landed_unit_price),0)/sQuotes.length:0 }
  }).sort((a,b)=>b.selected-a.selected || b.quotes-a.quotes).slice(0,8)

  const pickupRows = pickups.map(pickup => {
    const pOrders = liveOrders.filter(order=>order.pickup_point_id===pickup.id)
    return { id:pickup.id, name:pickup.name, community:communityById.get(pickup.community_id)?.name ?? '—', active:pickup.active, orders:pOrders.length, ready:pOrders.filter(o=>o.status==='ready_for_pickup').length, completed:pOrders.filter(o=>o.status==='completed').length, gmv:pOrders.reduce((sum,o)=>sum+n(o.total_amount),0) }
  }).sort((a,b)=>b.orders-a.orders).slice(0,8)

  const recentPools = [...pools].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,8).map(pool => {
    const itemIds = new Set(poolItems.filter(item=>item.pool_id===pool.id).map(item=>item.id))
    const pCommitments = commitments.filter(c=>itemIds.has(c.pool_item_id))
    const pOrders = liveOrders.filter(o=>o.pool_id===pool.id)
    return { ...pool, community:communityById.get(pool.community_id)?.name ?? '—', households:new Set(pCommitments.map(c=>c.customer_id)).size, committedQty:pCommitments.reduce((sum,c)=>sum+n(c.quantity),0), orders:pOrders.length, gmv:pOrders.reduce((sum,o)=>sum+n(o.total_amount),0) }
  })

  const snapshot = [
    ['Households', profiles.length], ['Communities', communities.length], ['Pickup points', pickups.length], ['Products', products.length], ['Benchmarks', benchmarks.length], ['Suppliers', suppliers.length], ['Pools', pools.length], ['Pool items', poolItems.length], ['Commitments', commitments.length], ['Supplier quotes', quotes.length], ['Orders', orders.length], ['Order items', orderItems.length], ['Savings entries', savings.length], ['Payments', payments.length], ['Feedback', feedback.length], ['Issues', issues.length],
  ]

  return <SuperAdminShell><div className="grid gap-5">
    <section className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Owner command center</p><h1 className="mt-1 text-3xl font-black">Business intelligence</h1><p className="mt-1 text-sm text-slate-500">Live database view for {profile?.full_name ?? 'Super Admin'} · refreshed {dateTime(now.toISOString())}</p></div><div className="flex gap-2"><Link href="/admin/pools" className="btn-primary">Create / manage pool</Link><Link href="/admin" className="btn-secondary">Operations</Link></div></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Onboarded households',onboarded.length,`+${newHouseholds30} in 30d`],
        ['Active households · 30d',activeHouseholds30,`${pct(activeHouseholds30,onboarded.length)}% of onboarded`],
        ['GMV · 30d',taka(gmv30),`${taka(gmv)} live/completed total`],
        ['Verified savings · 30d',taka(savings30),`${taka(verifiedSavings)} lifetime`],
        ['Active pools',activePools.length,`${pools.length} total pools`],
        ['Resolved commitment conversion',`${commitmentConversion}%`,`${confirmedCommitments} confirmed`],
        ['Order fulfilment',`${fulfilmentRate}%`,`${completedOrders.length}/${liveOrders.length} completed`],
        ['Open issues',openIssues.length,openIssues.length?'Needs attention':'Clear'],
      ].map(([label,value,sub])=><div className="card" key={String(label)}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div><p className="muted mt-2">{sub}</p></div>)}
    </section>

    <section className="grid gap-3 lg:grid-cols-3">
      <div className="card"><div className="card-title">Savings quality</div><div className="metric text-2xl">{savingsRate}%</div><p className="muted mt-2">Verified savings vs benchmark market value on collected quantities.</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-600" style={{width:`${Math.min(100,savingsRate)}%`}} /></div></div>
      <div className="card"><div className="card-title">Payment exposure</div><div className="metric text-2xl">{taka(unpaidExposure)}</div><p className="muted mt-2">{unpaidOrders.length} unpaid / pending / cash-on-pickup order(s). Recorded manual payments: {taka(paidRecorded)}.</p><Link href="/super-admin/payments" className="mt-3 inline-flex font-bold text-slate-900 underline">Open payment control →</Link></div>
      <div className="card"><div className="card-title">Customer voice</div><div className="metric text-2xl">{avgRating?avgRating.toFixed(1):'—'} / 5</div><p className="muted mt-2">{feedback.length} review(s) · {approvedTestimonials} approved testimonial(s).</p><Link href="/admin/feedback" className="mt-3 inline-flex font-bold text-slate-900 underline">Review feedback →</Link></div>
    </section>

    <section className="card border-slate-300"><div className="flex items-center justify-between gap-3"><div><div className="card-title">Decision center</div><h2 className="mt-1 text-xl font-black">What needs your attention now</h2></div><span className="chip">{decisionFlags.length} flag(s)</span></div>{decisionFlags.length ? <div className="mt-4 grid gap-2">{decisionFlags.map((flag,index)=><Link href={flag.href} key={`${flag.text}-${index}`} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-white"><div><span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-black ${flag.level==='High'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800'}`}>{flag.level}</span><span className="text-sm font-semibold">{flag.text}</span></div><span aria-hidden>→</span></Link>)}</div> : <div className="success mt-4">No immediate operating exception detected from the current data.</div>}<p className="mt-3 text-xs text-slate-500">Profit and platform revenue are not shown because the current data model does not yet record platform fees, overhead, or operating cost. This dashboard does not fabricate them.</p></section>

    <section><div className="mb-3"><div className="card-title">Community performance</div><h2 className="section-title">Where the business is moving</h2></div><div className="table-wrap"><table><thead><tr><th>Community</th><th>Households</th><th>Active pools</th><th>Orders</th><th>GMV</th><th>Verified savings</th><th>Open issues</th></tr></thead><tbody>{communityRows.map(row=><tr key={row.id}><td><b>{row.name}</b><div className="muted">{row.active?'Active':'Inactive'}</div></td><td>{row.households}</td><td>{row.pools}</td><td>{row.orders}</td><td>{taka(row.gmv)}</td><td>{taka(row.savings)}</td><td>{row.issues}</td></tr>)}</tbody></table></div></section>

    <section className="grid gap-4 2xl:grid-cols-2">
      <div><div className="mb-3"><div className="card-title">Demand intelligence</div><h2 className="section-title">Top products by committed quantity</h2></div><div className="card grid gap-3">{productRows.length?productRows.map(row=><div key={row.id}><div className="flex items-center justify-between gap-3 text-sm"><div><b>{row.name}</b><span className="ml-2 text-slate-400">{row.category}</span></div><span className="font-black">{row.committedQty}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-900" style={{width:`${Math.max(3,Math.round(row.committedQty/maxDemand*100))}%`}} /></div><p className="mt-1 text-xs text-slate-500">Confirmed {row.confirmedQty} · ordered {row.orderedQty} · order value {taka(row.value)} · expected saving {taka(row.expectedSaving)}</p></div>):<p className="muted">No product demand yet.</p>}</div></div>
      <div><div className="mb-3"><div className="card-title">Sourcing intelligence</div><h2 className="section-title">Supplier quote performance</h2></div><div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Status</th><th>Quotes</th><th>Selected</th><th>Win rate</th><th>Avg landed</th></tr></thead><tbody>{supplierRows.length?supplierRows.map(row=><tr key={row.id}><td><b>{row.name}</b></td><td>{row.active?row.reliability:'inactive'}</td><td>{row.quotes}</td><td>{row.selected}</td><td>{row.winRate}%</td><td>{row.avgLanded?taka(row.avgLanded):'—'}</td></tr>):<tr><td colSpan={6} className="text-slate-500">No supplier quote data yet.</td></tr>}</tbody></table></div></div>
    </section>

    <section><div className="mb-3"><div className="card-title">Pool performance</div><h2 className="section-title">Recent pool execution</h2></div><div className="table-wrap"><table><thead><tr><th>Pool</th><th>Community</th><th>Status</th><th>Demand households</th><th>Committed qty</th><th>Orders</th><th>GMV</th><th>Pickup target</th></tr></thead><tbody>{recentPools.length?recentPools.map(row=><tr key={row.id}><td><b>{row.title}</b></td><td>{row.community}</td><td>{row.status}</td><td>{row.households}</td><td>{row.committedQty}</td><td>{row.orders}</td><td>{taka(row.gmv)}</td><td>{dateTime(row.pickup_at)}</td></tr>):<tr><td colSpan={8} className="text-slate-500">No pools created yet.</td></tr>}</tbody></table></div></section>

    <section className="grid gap-4 2xl:grid-cols-2">
      <div><div className="mb-3"><div className="card-title">Fulfilment intelligence</div><h2 className="section-title">Pickup point performance</h2></div><div className="table-wrap"><table><thead><tr><th>Pickup point</th><th>Community</th><th>Orders</th><th>Ready</th><th>Completed</th><th>GMV</th></tr></thead><tbody>{pickupRows.length?pickupRows.map(row=><tr key={row.id}><td><b>{row.name}</b><div className="muted">{row.active?'Active':'Inactive'}</div></td><td>{row.community}</td><td>{row.orders}</td><td>{row.ready}</td><td>{row.completed}</td><td>{taka(row.gmv)}</td></tr>):<tr><td colSpan={6} className="text-slate-500">No pickup points yet.</td></tr>}</tbody></table></div></div>
      <div><div className="mb-3"><div className="card-title">Governance</div><h2 className="section-title">Recent audit activity</h2></div><div className="card divide-y divide-slate-100 p-0">{audit.length?audit.slice(0,10).map(row=><div key={row.id} className="p-3"><div className="flex items-start justify-between gap-3"><div><b className="text-sm">{row.event_type}</b><p className="muted">{row.entity_type} · {row.entity_id ?? '—'}</p></div><span className="text-xs text-slate-400">{dateTime(row.created_at)}</span></div></div>):<div className="p-4 muted">No audit events yet.</div>}<Link href="/super-admin/audit" className="block p-3 text-sm font-black">Open full audit trail →</Link></div></div>
    </section>

    <section><div className="mb-3"><div className="card-title">Data coverage</div><h2 className="section-title">Live record snapshot</h2></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">{snapshot.map(([label,value])=><div className="rounded-xl border border-slate-200 bg-white p-3" key={String(label)}><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>)}</div></section>

    <section className="rounded-2xl bg-slate-950 p-5 text-white"><div className="card-title text-white/50">Quick decisions</div><div className="mt-3 flex flex-wrap gap-2">{[['New pool','/admin/pools'],['Update market price','/admin/market-prices'],['Review suppliers','/admin/suppliers'],['Check commitments','/admin/commitments'],['Orders','/admin/orders'],['Pickup points','/admin/pickup-points'],['Issues','/admin/issues'],['Payments','/super-admin/payments']].map(([label,href])=><Link key={href} href={href} className="rounded-xl bg-white px-3 py-2 text-sm font-black text-black">{label}</Link>)}</div></section>
  </div></SuperAdminShell>
}
