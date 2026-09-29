import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { StatusPill } from '@/components/status-pill'
import { updateActivePoolDetails } from '@/app/actions/pool-ops-edit'
import { requireAdmin } from '@/lib/auth'

export const dynamic='force-dynamic'
const dt=(value:string|null)=>value?new Date(value).toISOString().slice(0,16):''

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase}=await requireAdmin(); const sp=await searchParams
  const [{data:pools},{data:pickups}]=await Promise.all([
    supabase.from('pools').select('id,community_id,title,status,commitment_closes_at,confirmation_closes_at,supplier_delivery_at,pickup_at,receiving_pickup_point_id,notes').in('status',['open','pricing','final_price','confirmation']).order('created_at',{ascending:false}),
    supabase.from('pickup_points').select('id,community_id,name,address').eq('active',true).order('name'),
  ])
  return <AdminShell><div className="grid gap-5">
    <section><div className="card-title">Pool operations</div><h1 className="text-2xl font-bold sm:text-3xl">Edit active pool details</h1><p className="muted mt-1">Update operational timing and pickup information without changing products, benchmarks, demand history or pricing tiers.</p></section>
    <Flash {...sp}/>
    {!pools?.length?<div className="card p-5"><b>No editable active pools.</b></div>:<div className="grid gap-5">{pools.map((pool:any)=>{
      const communityPickups=(pickups??[]).filter((p:any)=>p.community_id===pool.community_id)
      return <form key={pool.id} action={updateActivePoolDetails} className="card grid gap-3 p-4 md:grid-cols-2">
        <input type="hidden" name="pool_id" value={pool.id}/>
        <div className="md:col-span-2 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{pool.title}</h2><p className="muted mt-1">Safe operational edit only. Commercial setup stays locked.</p></div><StatusPill status={pool.status}/></div>
        <label className="md:col-span-2"><span className="label">Pool title</span><input className="input" name="title" defaultValue={pool.title} required/></label>
        <label><span className="label">Commitment closes</span><input className="input" type="datetime-local" name="commitment_closes_at" defaultValue={dt(pool.commitment_closes_at)}/></label>
        <label><span className="label">Confirmation closes</span><input className="input" type="datetime-local" name="confirmation_closes_at" defaultValue={dt(pool.confirmation_closes_at)}/></label>
        <label><span className="label">Supplier delivery target</span><input className="input" type="datetime-local" name="supplier_delivery_at" defaultValue={dt(pool.supplier_delivery_at)}/></label>
        <label><span className="label">Customer pickup starts</span><input className="input" type="datetime-local" name="pickup_at" defaultValue={dt(pool.pickup_at)}/></label>
        <label className="md:col-span-2"><span className="label">Designated receiving point</span><select className="input" name="receiving_pickup_point_id" defaultValue={pool.receiving_pickup_point_id??''}><option value="">Choose point</option>{communityPickups.map((point:any)=><option key={point.id} value={point.id}>{point.name} · {point.address}</option>)}</select></label>
        <label className="md:col-span-2"><span className="label">Operational notes</span><textarea className="input min-h-24" name="notes" defaultValue={pool.notes??''}/></label>
        <div className="notice md:col-span-2"><b>Locked while active:</b> community, cycle, products, market benchmark, planning tiers, supplier commercial history and existing commitments.</div>
        <SubmitButton className="md:w-fit">Save pool details</SubmitButton>
      </form>
    })}</div>}
  </div></AdminShell>
}
