import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { dateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

function compactMetadata(value: unknown) {
  if (!value) return '—'
  const text = JSON.stringify(value)
  return text.length > 180 ? `${text.slice(0,177)}...` : text
}

export default async function SuperAdminAuditPage() {
  const { supabase } = await requireSuperAdmin()
  const [{ data: events }, { data: profiles }] = await Promise.all([
    supabase.from('audit_events').select('id,actor_user_id,event_type,entity_type,entity_id,metadata,created_at').order('created_at',{ascending:false}).limit(300),
    supabase.from('profiles').select('id,full_name,phone'),
  ])
  const actorMap = new Map(((profiles ?? []) as any[]).map(p=>[p.id,p]))
  const rows = (events ?? []) as any[]
  const types = new Set(rows.map(row=>row.event_type)).size
  const actors = new Set(rows.map(row=>row.actor_user_id).filter(Boolean)).size
  const last24h = rows.filter(row=>Date.now()-new Date(row.created_at).getTime()<=864e5).length

  return <SuperAdminShell><div className="grid gap-5">
    <section><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Governance & traceability</p><h1 className="mt-1 text-3xl font-black">Audit trail</h1><p className="muted mt-1">Most recent 300 recorded business events.</p></section>
    <section className="grid gap-3 sm:grid-cols-3">{[['Visible events',rows.length],['Event types',types],['Events · last 24h',last24h]].map(([label,value])=><div className="card" key={String(label)}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div></div>)}</section>
    <div className="table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Actor</th><th>Entity</th><th>Entity ID</th><th>Metadata</th></tr></thead><tbody>{rows.length?rows.map(row=>{const actor=actorMap.get(row.actor_user_id);return <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><b>{row.event_type}</b></td><td>{actor?.full_name ?? 'System'}<div className="muted">{actor?.phone ?? ''}</div></td><td>{row.entity_type}</td><td><span className="font-mono text-xs">{row.entity_id ?? '—'}</span></td><td><span className="font-mono text-xs text-slate-600">{compactMetadata(row.metadata)}</span></td></tr>}):<tr><td colSpan={6} className="text-slate-500">No audit events recorded yet.</td></tr>}</tbody></table></div>
    <div className="notice">This is the business audit log, not infrastructure/server logs. Sensitive provider secrets are intentionally not displayed here.</div>
  </div></SuperAdminShell>
}
