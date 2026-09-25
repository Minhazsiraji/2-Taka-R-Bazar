import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { SubmitButton } from '@/components/submit-button'
import { commitToPool } from '@/app/actions/customer'
import { requireOnboardedUser } from '@/lib/auth'
import { taka, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'
const activeStatuses=['open','pricing','final_price','confirmation','ordered','ready_for_pickup']

export default async function PoolPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}) {
  const {user,profile,roles,supabase}=await requireOnboardedUser()
  const {error,notice}=await searchParams
  const {data:pools}=await supabase.from('pools').select('*').eq('community_id',profile.community_id).in('status',activeStatuses).order('created_at',{ascending:false})
  const poolIds=(pools??[]).map((p:any)=>p.id)
  let items:any[]=[]
  const commitments=new Map<string,any>()
  const demand=new Map<string,number>()

  if(poolIds.length){
    const [itemResult,commitmentResult,...demandResults]=await Promise.all([
      supabase.from('pool_items').select('*,products(id,name,brand,category,package_size,unit,image_url)').in('pool_id',poolIds).eq('active',true).order('created_at'),
      supabase.from('commitments').select('*').eq('customer_id',user.id),
      ...poolIds.map(poolId=>supabase.rpc('get_pool_demand',{p_pool_id:poolId})),
    ])
    items=(itemResult as any).data??[]
    ;(((commitmentResult as any).data)??[]).forEach((c:any)=>commitments.set(c.pool_item_id,c))
    demandResults.forEach((r:any)=>(r.data??[]).forEach((row:any)=>demand.set(row.pool_item_id,Number(row.total_quantity))))
  }

  return <AppShell roles={roles}><div className="grid min-w-0 gap-4 sm:gap-5">
    <section><h1 className="text-2xl font-black sm:text-3xl">Available pools</h1><p className="muted mt-1">Weekly and monthly buying pools selected for {profile.household_name}&apos;s community.</p></section>
    {error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}
    {!pools?.length?<div className="card"><p>No active pool right now.</p></div>:(pools??[]).map((pool:any)=>{const poolItems=items.filter((item:any)=>item.pool_id===pool.id);return <section key={pool.id} className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><span className="chip capitalize">{pool.cadence??'weekly'}</span><StatusPill status={pool.status}/></div><h2 className="mt-2 text-xl font-black sm:text-2xl">{pool.title}</h2><p className="muted mt-1">Pickup target: {shortDate(pool.pickup_at)}</p></div></div>
      <div className="grid gap-3 lg:grid-cols-2">{poolItems.map((item:any)=>{const product=item.products;const own=commitments.get(item.id);const final=Number(item.final_customer_price||0);const bench=Number(item.benchmark_price_snapshot);const perUnit=final?Math.max(0,bench-final):null;return <article className="card min-w-0" key={item.id}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase text-slate-500">{product?.category}</p><h3 className="text-lg font-black sm:text-xl">{product?.name}</h3><p className="muted">{product?.brand} · {product?.package_size}</p></div><span className="chip w-fit">Demand {demand.get(item.id)??0}</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><div className="card-title">Market benchmark</div><b className="text-lg">{taka(bench)}</b></div><div className="rounded-xl bg-emerald-50 p-3"><div className="card-title">Final pool price</div><b className="text-lg text-emerald-800">{final?taka(final):'Pending'}</b>{perUnit!==null&&<p className="text-sm font-bold text-emerald-800">Save {taka(perUnit)}/unit</p>}</div></div>
        {own&&<p className="mt-3 text-sm font-semibold">Your commitment: {own.quantity} · <StatusPill status={own.status}/></p>}
        {pool.status==='open'?<form action={commitToPool} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"><input type="hidden" name="pool_item_id" value={item.id}/><label><span className="label">Quantity</span><input className="input" type="number" name="quantity" min={item.min_quantity} max={item.max_quantity} defaultValue={own?.quantity??1} required/></label><SubmitButton className="w-full sm:w-auto">{own?'Update commitment':'I want this'}</SubmitButton></form>:<p className="muted mt-4">Commitments are closed while this pool is in {String(pool.status).replaceAll('_',' ')}.</p>}
      </article>})}{poolItems.length===0&&<div className="muted">No items have been added to this pool yet.</div>}</div>
    </section>})}
    <div className="notice"><b>Transparent benchmark:</b> savings use the admin-approved local market benchmark stored for each pool item. Savings become verified only after collection.</div>
  </div></AppShell>
}
