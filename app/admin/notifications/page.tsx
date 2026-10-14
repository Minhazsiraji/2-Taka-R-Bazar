import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import { NotificationComposer } from '@/components/notification-composer'

export const dynamic = 'force-dynamic'

export default async function AdminNotificationsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: communities }, { count: customerCount }, { data: pools }, history, push] = await Promise.all([
    supabase.from('communities').select('id,name').eq('active', true).order('name'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).not('onboarding_completed_at','is',null),
    supabase.from('pools').select('id,title').order('created_at',{ascending:false}).limit(50),
    supabase.rpc('admin_notification_broadcast_history'),
    supabase.rpc('get_push_public_key'),
  ])

  type Broadcast={id:string;created_at:string;title:string;body:string;href:string;community_name:string;recipients:number;read_count:number;push_count:number}
  const broadcasts=(history.data??[]) as Broadcast[]
  return <AdminShell>
    <div className="grid gap-5">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Communication</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Notification center</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Compose an announcement, choose all users or one community, add an optional action, preview the customer message, then review the exact audience before sending.</p>
      </section>

      <NotificationComposer communities={(communities ?? []) as any} pools={(pools ?? []) as any} customerCount={customerCount ?? 0} />

      <section className="card">
        <div className="card-title">Delivery history</div><h2 className="section-title">Sent announcements</h2>
        <p className="muted mt-2">In-app delivery is immediate. Browser push is {push.data?'configured; subscribed devices are processed every two minutes.':'not configured yet; in-app updates still work.'}</p>
        {history.error?<p role="alert" className="error mt-4">Delivery history could not be loaded. Refresh to try again.</p>:broadcasts.length===0?<p className="muted mt-4">No announcements sent yet.</p>:<div className="mt-4 grid gap-3">{broadcasts.map(b=><article key={b.id} data-broadcast-id={b.id} className="rounded-xl border p-4">
          <h3 className="font-bold">{b.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{b.body}</p>
          <p className="muted mt-2">{b.community_name} · {new Intl.DateTimeFormat('en-BD',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'}).format(new Date(b.created_at))}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm"><span>In-app delivered: <b>{b.recipients}</b></span><span>Read: <b>{b.read_count}</b></span><span>Device push sent: <b>{b.push_count}</b></span></div>
          <p className="muted mt-2">Destination: {b.href}</p>
        </article>)}</div>}
      </section>
    </div>
  </AdminShell>
}
