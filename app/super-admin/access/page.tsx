import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { dateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function SuperAdminAccessPage() {
  const { supabase } = await requireSuperAdmin()
  const [{ data: profiles }, { data: roles }, { data: communities }] = await Promise.all([
    supabase.from('profiles').select('id,full_name,phone,email,community_id,onboarding_completed_at,created_at').order('created_at',{ascending:false}),
    supabase.from('user_roles').select('user_id,role'),
    supabase.from('communities').select('id,name'),
  ])
  const roleMap = new Map<string,string[]>()
  for (const row of (roles ?? []) as any[]) roleMap.set(row.user_id,[...(roleMap.get(row.user_id)??[]),row.role])
  const communityMap = new Map(((communities ?? []) as any[]).map(c=>[c.id,c.name]))
  const rows = (profiles ?? []) as any[]
  const admins = rows.filter(p=>(roleMap.get(p.id)??[]).some(role=>role==='admin'||role==='super_admin')).length
  const pickupOps = rows.filter(p=>(roleMap.get(p.id)??[]).includes('pickup_operator')).length
  const onboarded = rows.filter(p=>p.onboarding_completed_at).length

  return <SuperAdminShell><div className="grid gap-5">
    <section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Identity & access</p><h1 className="mt-1 text-3xl font-black">Users & access roster</h1><p className="muted mt-1">Read-only visibility of members and assigned application roles.</p></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Total identities',rows.length],['Onboarded',onboarded],['Admin / Super Admin',admins],['Pickup operators',pickupOps]].map(([label,value])=><div className="card" key={String(label)}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div></div>)}</section>
    <div className="table-wrap"><table><thead><tr><th>User</th><th>Mobile / email</th><th>Community</th><th>Roles</th><th>Onboarding</th><th>Created</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.full_name ?? 'Not completed'}</b><div className="muted">{row.id.slice(0,8)}</div></td><td>{row.phone ?? '—'}<div className="muted">{row.email ?? ''}</div></td><td>{communityMap.get(row.community_id) ?? '—'}</td><td><div className="flex flex-wrap gap-1">{(roleMap.get(row.id)??[]).map(role=><span key={role} className={`rounded-full px-2 py-1 text-xs font-bold ${role==='super_admin'?'bg-black text-white':'bg-slate-100 text-slate-700'}`}>{role}</span>)}</div></td><td>{row.onboarding_completed_at?'Complete':'Pending'}</td><td>{dateTime(row.created_at)}</td></tr>)}</tbody></table></div>
    <div className="notice">Role changes are intentionally not exposed from this first Super Admin screen. Access changes should be separately audited before we add in-panel role management.</div>
  </div></SuperAdminShell>
}
