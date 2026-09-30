import { AppShell } from '@/components/app-shell'
import { PushNotificationManager } from '@/components/push-notification-manager'
import { markAllNotificationsRead, openNotification } from '@/app/actions/notifications'
import { requireOnboardedUser } from '@/lib/auth'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value))
}

export default async function NotificationsPage() {
  const { supabase, user, roles } = await requireOnboardedUser()
  const [{ data: notifications }, { data: publicKey }, { data: hasPush }] = await Promise.all([
    supabase.from('notifications').select('id,kind,title,body,href,priority,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    supabase.rpc('get_push_public_key'),
    supabase.rpc('has_push_subscription'),
  ])
  const unread = (notifications ?? []).filter((note) => !note.read_at).length

  return (
    <AppShell roles={roles}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Customer journey</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-slate-600">Pool publish, deadlines, final price, confirmation, pickup, savings and review reminders appear here automatically.</p>
          </div>
          {unread > 0 && <form action={markAllNotificationsRead}><button className="btn-secondary">Mark all read ({unread})</button></form>}
        </div>

        <PushNotificationManager publicKey={typeof publicKey === 'string' ? publicKey : null} serverHasSubscription={Boolean(hasPush)} />

        <section className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black">Your activity timeline</h2></div>
          {(notifications ?? []).length === 0 ? (
            <div className="p-8 text-center"><div className="text-3xl">🔔</div><h3 className="mt-3 font-black">No notifications yet</h3><p className="mt-1 text-sm text-slate-600">When a pool for your community is published or your order changes, it will appear here.</p></div>
          ) : (
            <div className="divide-y divide-slate-200">
              {(notifications ?? []).map((note) => (
                <form action={openNotification} key={note.id} className={note.read_at ? 'bg-transparent' : 'bg-amber-50/30'}>
                  <input type="hidden" name="notification_id" value={note.id} />
                  <button className="block w-full appearance-none rounded-none border-0 bg-transparent px-4 py-4 text-left shadow-none outline-none transition-colors hover:bg-slate-50/60 focus-visible:bg-slate-50/60 sm:px-5">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${note.read_at ? 'bg-slate-200' : note.priority === 'high' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="font-black text-slate-950">{note.title}</h3>
                          <time className="shrink-0 text-xs text-slate-500">{formatDate(note.created_at)}</time>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{note.body}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span>{String(note.kind).replaceAll('_', ' ')}</span>{!note.read_at && <span>• New</span>}</div>
                      </div>
                    </div>
                  </button>
                </form>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
