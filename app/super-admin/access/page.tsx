import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { AccessRoster } from '@/components/access-roster'

export const dynamic = 'force-dynamic'
export default async function SuperAdminAccessPage() {
 const { supabase }=await requireSuperAdmin()
 const [{data:profiles},{data:roles},{data:communities}]=await Promise.all([
  supabase.from('profiles').select('id,full_name,phone,email,community_id,onboarding_completed_at,created_at').order('created_at',{ascending:false}),
  supabase.from('user_roles').select('user_id,role'),supabase.from('communities').select('id,name')])
 const roleMap=new Map<string,string[]>()
 for(const row of (roles??[]) as any[]) roleMap.set(row.user_id,[...(roleMap.get(row.user_id)??[]),row.role])
 const rows=(profiles??[]) as any[]
 const admins=rows.filter(p=>(roleMap.get(p.id)??[]).some(r=>r==='admin'||r==='super_admin')).length
 const pickupOps=rows.filter(p=>(roleMap.get(p.id)??[]).includes('pickup_operator')).length
 const onboarded=rows.filter(p=>p.onboarding_completed_at).length
 return <SuperAdminShell><div className="grid gap-5">
  <section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Identity & access</p><h1 className="mt-1 text-3xl font-black">Users & access roster</h1><p className="muted mt-1">Members, communities and assigned application roles.</p></section>
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Total identities',rows.length],['Onboarded',onboarded],['Admin / Super Admin',admins],['Pickup operators',pickupOps]].map(([label,value])=><div className="card" key={String(label)}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div></div>)}</section>
  <AccessRoster rows={rows} roleEntries={[...roleMap.entries()]} communities={((communities??[]) as any[]).map(c=>[c.id,c.name])}/>
  <div className="notice">Only Super Admin can change access. Every grant/revoke is audited, and the last Super Admin cannot be removed.</div>
 </div></SuperAdminShell>
}
