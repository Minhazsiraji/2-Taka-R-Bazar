import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { StatusPill } from '@/components/status-pill'
import { updateActivePoolDetails } from '@/app/actions/pool-ops-edit'
import { requireAdmin } from '@/lib/auth'

export const dynamic='force-dynamic'
const dt=(value:string|null)=>value?new Date(value).toISOString().slice(0,16):''

type Search={pool?:string;error?:string;notice?:string}

export default async function Page({searchParams}:{searchParams:Promise<Search>}){
  const {supabase}=await requireAdmin(); const sp=await searchParams
  const [{data:pools},{data:pickups}]=await Promise.all([
    supabase.from('pools').select('id,community_id,title,status,commitment_closes_at,confirmation_closes_at,supplier_delivery_at,pickup_at,receiving_pickup_point_id,notes').in('status',['open','pricing','final_price','confirmation']).order('created_at',{ascending:false}),
    supabase.from('pickup_points').select('id,community_id,name,address').eq('active',true).order('name'),
  ])
  const selected=(pools??[]).find((p:any)=>p.id===sp.pool)

  return <AdminShell><div className="grid gap-5">
    <div className="flex flex-wrap items-center gap-2 text-sm"><Link className="font-bold text-cyan-800 underline" href="/admin/pools">← Pools</Link>{selected&&<><span className="text-slate-400">/</span><Link className="font-bold text-cyan-800 underline" href={`/admin/pools/${selected.id}`}>{selected.title}</Link></>}</div>
    <section><div className="card-title">Pool operations</div><h1 className="text-2xl font-bold sm:text-3xl">Edit active pool details</h1><p className="muted mt-1">Use this page only for operational corrections. It does not change products, benchmarks, demand history or pricing tiers.</p></section>
    <Flash {...sp}/>

    {!sp.pool ? <div className="grid gap-3">
      <div className="notice"><b>Choose one active pool.</b> This keeps editing focused and avoids changing the wrong pool.</div>
      {(pools??[]).map((pool:any)=><Link key={pool.id} href={`/admin/pools/edit?pool=${pool.id}`} className="card flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5"><div><h2 className="font-bold">{pool.title}</h2><p className="muted mt-1">Safe operational fields only</p></div><div className="flex items-center gap-2"><StatusPill status={pool.status}/><span className="btn-secondary px-4 py-2">Edit →</span></div></Link>)}
      {!(pools??[]).length&&<div className="card p-5"><b>No editable active pools.</b></div>}
    </div> : !selected ? <div className="card p-5"><b>Pool not found or it is no longer editable.</b><div className="mt-3"><Link className="btn-secondary" href="/admin/pools">Back to pools</Link></div></div> : (()=>{
      const communityPickups=(pickups??[]).filter((p:any)=>p.community_id===selected.community_id)
      return <form action={updateActivePoolDetails} className="card grid gap-3 p-5 md:grid-cols-2">
        <input type="hidden" name="pool_id" value={selected.id}/>
        <div className="md:col-span-2 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.title}</h2><p className="muted mt-1">Safe operational edit only. Commercial setup stays locked.</p></div><StatusPill status={selected.status}/></div>
        <label className="md:col-span-2"><span className="label">Pool title</span><input className="input" name="title" defaultValue={selected.title} required/></label>
        <label><span className="label">Commitment closes</span><input className="input" type="datetime-local" name="commitment_closes_at" defaultValue={dt(selected.commitment_closes_at)}/></label>
        <label><span className="label">Confirmation closes</span><input className="input" type="datetime-local" name="confirmation_closes_at" defaultValue={dt(selected.confirmation_closes_at)}/></label>
        <label><span className="label">Supplier delivery target</span><input className="input" type="datetime-local" name="supplier_delivery_at" defaultValue={dt(selected.supplier_delivery_at)}/></label>
        <label><span className="label">Customer pickup starts</span><input className="input" type="datetime-local" name="pickup_at" defaultValue={dt(selected.pickup_at)}/></label>
        <label className="md:col-span-2"><span className="label">Designated receiving point</span><select className="input" name="receiving_pickup_point_id" defaultValue={selected.receiving_pickup_point_id??''}><option value="">Choose point</option>{communityPickups.map((point:any)=><option key={point.id} value={point.id}>{point.name} · {point.address}</option>)}</select></label>
        <label className="md:col-span-2"><span className="label">Operational notes</span><textarea className="input min-h-24" name="notes" defaultValue={selected.notes??''}/></label>
        <div className="notice md:col-span-2"><b>Locked while active:</b> community, cycle, products, market benchmark, planning tiers, supplier commercial history and existing commitments.</div>
        <div className="md:col-span-2 flex flex-wrap gap-2"><SubmitButton className="btn-primary min-w-48">Save pool details</SubmitButton><Link className="btn-secondary" href={`/admin/pools/${selected.id}`}>Cancel</Link></div>
      </form>
    })()}
  </div></AdminShell>
}
