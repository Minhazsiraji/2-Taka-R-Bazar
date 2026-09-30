import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import { NotificationComposer } from '@/components/notification-composer'

export const dynamic = 'force-dynamic'

export default async function AdminNotificationsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: communities }, { count: customerCount }, { data: pools }] = await Promise.all([
    supabase.from('communities').select('id,name').eq('active', true).order('name'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('pools').select('id,title').order('created_at',{ascending:false}).limit(50),
  ])

  return <AdminShell>
    <div className="grid gap-5">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Communication</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Notification center</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Compose an announcement, choose its audience and delivery channels, then review it before broadcast. This Preview intentionally keeps the final Send action disabled until the database broadcast RPC and push sender are qualified.</p>
      </section>

      <NotificationComposer communities={(communities ?? []) as any} pools={(pools ?? []) as any} customerCount={customerCount ?? 0} />

      <section className="card">
        <div className="card-title">Delivery history</div><h2 className="section-title">Sent announcements</h2><div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No admin broadcasts have been sent from this feature yet. After UAT approval, this area will show sender, audience, channel, recipient count, delivery status and timestamp.</div>
      </section>
    </div>
  </AdminShell>
}
