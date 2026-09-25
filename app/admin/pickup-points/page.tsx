import { AdminShell } from '@/components/admin-shell'
import { Flash } from '@/components/flash'
import { SubmitButton } from '@/components/submit-button'
import { createPickupPoint, assignPickupOperator, updatePickupPoint, removePickupOperatorAssignment } from '@/app/actions/admin'
import { requireAdmin } from '@/lib/auth'

export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const {supabase:db}=await requireAdmin();const sp=await searchParams
  const [{data:communities},{data:points},{data:roles},{data:assignments}]=await Promise.all([
    db.from('communities').select('id,name,active').order('sort_order'),
    db.from('pickup_points').select('*,communities(name)').order('created_at',{ascending:false}),
    db.from('user_roles').select('user_id').eq('role','pickup_operator'),
    db.from('pickup_operator_assignments').select('*,pickup_points(name)')
  ])
  const opIds=(roles??[]).map((r:any)=>r.user_id)
  const {data:operators}=opIds.length?await db.from('profiles').select('id,full_name,email').in('id',opIds):{data:[] as any[]}
  const operatorMap=new Map((operators??[]).map((o:any)=>[o.id,o]))
  return <AdminShell><h1 className="text-3xl font-black mb-4">Pickup points</h1><Flash {...sp}/>
    <div className="grid gap-4 xl:grid-cols-2"><form action={createPickupPoint} className="card grid gap-3"><h2 className="section-title">Create pickup point</h2><select className="input" name="community_id" required><option value="">Community</option>{communities?.filter((c:any)=>c.active).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input" name="name" placeholder="Pickup point name" required/><input className="input" name="address" placeholder="Address" required/><div className="form-grid"><input className="input" name="contact_name" placeholder="Contact person"/><input className="input" name="contact_phone" placeholder="Contact phone"/></div><input className="input" type="url" name="google_maps_url" placeholder="Google Maps share URL"/><input className="input" name="opening_hours" placeholder="Opening hours"/><SubmitButton>Create pickup point</SubmitButton></form>
      <form action={assignPickupOperator} className="card grid gap-3"><h2 className="section-title">Assign operator</h2><select className="input" name="user_id" required><option value="">Pickup operator</option>{operators?.map((o:any)=><option key={o.id} value={o.id}>{o.full_name||o.email}</option>)}</select><select className="input" name="pickup_point_id" required><option value="">Pickup point</option>{points?.filter((p:any)=>p.active).map((p:any)=><option key={p.id} value={p.id}>{p.communities?.name} · {p.name}</option>)}</select><SubmitButton>Assign</SubmitButton><p className="muted">Create the user account first, then grant the pickup_operator role using the documented bootstrap SQL.</p></form></div>
    <h2 className="section-title mt-6 mb-3">Pickup locations</h2><div className="grid gap-3">{points?.map((p:any)=><details className="card" key={p.id}><summary className="cursor-pointer flex justify-between gap-3"><span><b>{p.name}</b> <span className="muted">· {p.communities?.name} · {p.address}</span></span><span className="chip">{p.active?'Active':'Inactive'}</span></summary><form action={updatePickupPoint} className="form-grid mt-4"><input type="hidden" name="id" value={p.id}/><select className="input" name="community_id" defaultValue={p.community_id} required>{communities?.map((c:any)=><option key={c.id} value={c.id}>{c.name}{c.active?'':' · inactive'}</option>)}</select><input className="input" name="name" defaultValue={p.name} required/><input className="input md:col-span-2" name="address" defaultValue={p.address} required/><input className="input" name="contact_name" defaultValue={p.contact_name??''}/><input className="input" name="contact_phone" defaultValue={p.contact_phone??''}/><input className="input" type="url" name="google_maps_url" defaultValue={p.google_maps_url??''}/><input className="input" name="opening_hours" defaultValue={p.opening_hours??''}/><label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={p.active}/><span>Active</span></label><SubmitButton>Save pickup point</SubmitButton></form></details>)}</div>
    <h2 className="section-title mt-6 mb-3">Assignments</h2><div className="table-wrap"><table><thead><tr><th>Operator</th><th>Pickup point</th><th></th></tr></thead><tbody>{assignments?.map((a:any)=>{const operator=operatorMap.get(a.user_id) as any;return <tr key={`${a.user_id}-${a.pickup_point_id}`}><td>{operator?.full_name||operator?.email||a.user_id}</td><td>{a.pickup_points?.name}</td><td><form action={removePickupOperatorAssignment}><input type="hidden" name="user_id" value={a.user_id}/><input type="hidden" name="pickup_point_id" value={a.pickup_point_id}/><SubmitButton className="btn-danger">Remove</SubmitButton></form></td></tr>})}</tbody></table></div>
    <p className="muted mt-4">Pickup locations are soft-deactivated rather than hard-deleted once referenced by orders.</p>
  </AdminShell>
}
