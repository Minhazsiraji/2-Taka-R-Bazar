import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import { NotificationPreviewButton } from '@/components/notification-preview-button'

export const dynamic = 'force-dynamic'

export default async function AdminNotificationsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: communities }, { count: customerCount }] = await Promise.all([
    supabase.from('communities').select('id,name').eq('active', true).order('name'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  return <AdminShell>
    <div className="grid gap-5">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Communication</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Notification center</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Compose an announcement, choose its audience and delivery channels, then review it before broadcast. This Preview intentionally keeps the final Send action disabled until the database broadcast RPC and push sender are qualified.</p>
      </section>

      <section className="card grid gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="card-title">New announcement</div><h2 className="section-title">Compose notification</h2></div><span className="chip">{customerCount ?? 0} registered profiles</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2"><span className="label">Title</span><input className="input" maxLength={80} placeholder="October grocery pool is open" /></label>
          <label className="md:col-span-2"><span className="label">Message</span><textarea className="input min-h-28" maxLength={500} placeholder="Amin Model Town October pool is now available. Review prices and submit your commitment by 3 October." /></label>
          <label><span className="label">Audience</span><select className="input" defaultValue="all"><option value="all">All users</option><option value="community">One community</option><option value="selected">Selected users</option></select></label>
          <label><span className="label">Community</span><select className="input" defaultValue=""><option value="">Choose when audience is community</option>{(communities ?? []).map((c:any)=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label><span className="label">Priority</span><select className="input" defaultValue="normal"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
          <label><span className="label">Destination link</span><input className="input" placeholder="/pool" defaultValue="/notifications" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><input type="checkbox" defaultChecked/><span><b className="block">In-app notification</b><span className="text-xs text-slate-500">Appears in the customer notification timeline.</span></span></label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><input type="checkbox" defaultChecked/><span><b className="block">Browser / PWA push</b><span className="text-xs text-slate-500">Sent to devices that have enabled push.</span></span></label>
        </div>
        <div className="notice"><b>Preview safety gate:</b> broadcast execution is disabled in this branch. No customer will receive a message while you review the UI.</div>
        <div className="flex flex-wrap justify-end gap-2"><NotificationPreviewButton /><button className="btn-primary opacity-60" type="button" disabled>Review & send</button></div>
      </section>

      <section className="card">
        <div className="card-title">Delivery history</div><h2 className="section-title">Sent announcements</h2><div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No admin broadcasts have been sent from this feature yet. After UAT approval, this area will show sender, audience, channel, recipient count, delivery status and timestamp.</div>
      </section>
    </div>
  </AdminShell>
}
