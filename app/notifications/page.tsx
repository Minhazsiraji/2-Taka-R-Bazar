import Link from 'next/link'
import {safeNotificationHref} from '@/lib/notification-links.mjs'
import {NotificationInboxRefresh} from '@/components/notification-inbox-refresh'
import { AppShell } from '@/components/app-shell'
import { PushNotificationManager } from '@/components/push-notification-manager'
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications'
import { requireOnboardedUser } from '@/lib/auth'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value))
}

export default async function NotificationsPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const query=await searchParams
  const { supabase, user, roles } = await requireOnboardedUser()
  const [{ data: notifications }, { data: publicKey }, { data: hasPush }] = await Promise.all([
    supabase.from('notifications').select('id,kind,title,body,href,priority,read_at,created_at,dedupe_key').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    supabase.rpc('get_push_public_key'),
    supabase.rpc('has_push_subscription'),
  ])
  // The database stores a durable notification at community closure. Derive the
  // latest call to action from this signed-in customer's own immutable quote,
  // so the message never becomes stale after delivery or payment advances.
  const {data:ownQuotes}=await supabase.from('simple_sale_cycle_quotes')
    .select('id,product_total,delivery_fee,status').eq('customer_id',user.id)
    .order('created_at',{ascending:false}).limit(100)
  const quoteById=new Map((ownQuotes??[]).map(q=>[q.id,q]))
  const money=(amount:number)=>'৳'+amount.toLocaleString('en-BD',{maximumFractionDigits:2})
  const nextStep=(quote:NonNullable<typeof ownQuotes>[number])=>{
    const products=money(Number(quote.product_total))
    const total=money(Number(quote.product_total)+Number(quote.delivery_fee??0))
    if(quote.status==='awaiting_delivery')return {
      title:'Deal closed — choose your delivery / ডেলিভারি বাছুন',
      body:'Your locked product amount is '+products+'. Next: choose community pickup or home delivery. Staff will confirm the delivery fee. Do not pay yet.',
      action:'Select delivery now →'
    }
    if(quote.status==='quoted'&&quote.delivery_fee!==null)return {
      title:'Full final quote ready — review and confirm',
      body:'Products '+products+' + delivery '+money(Number(quote.delivery_fee))+' = '+total+'. Review and explicitly accept the total, or cancel. Do not pay before accepting.',
      action:'Accept or cancel final quote →'
    }
    if(quote.status==='accepted'&&quote.delivery_fee!==null)return {
      title:'Price accepted — official payment instructions ready',
      body:'Accepted total: '+total+'. Choose the official bank or bKash account under My Deals & Pools, transfer the exact amount, then submit the real transaction reference.',
      action:'See official payment instructions →'
    }
    if(quote.status==='payment_submitted')return {
      title:'Transfer submitted — awaiting independent verification',
      body:'Your transfer reference is awaiting staff confirmation against the bank or bKash statement. No confirmed order has been created yet.',
      action:'Check verification status →'
    }
    if(quote.status==='verified')return {
      title:'Payment verified — order confirmed',
      body:'Your transfer has been independently verified and an order was created at the locked price.',
      action:'View confirmed order →'
    }
    if(quote.status==='cancelled')return {
      title:'Deal quote cancelled',
      body:'This quote has been cancelled and no order was created.',
      action:'View quote history →'
    }
    return null
  }
  const unread = (notifications ?? []).filter((note) => !note.read_at).length

  return (
    <AppShell roles={roles}><NotificationInboxRefresh unread={unread}/>
      <div className="grid gap-5">{query.error&&<p className="error" role="alert">{query.error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Customer journey</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-slate-600">Pool publish, deadlines, final price, confirmation, pickup, savings and review reminders appear here automatically.</p>
          </div>
          {unread > 0 && <form action={markAllNotificationsRead}><button className="btn-secondary">Mark all read ({unread})</button></form>}
        </div>

        <PushNotificationManager publicKey={typeof publicKey === 'string' ? publicKey : null} serverHasSubscription={Boolean(hasPush)} />

        <section className="card cx-glass-card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black">Your activity timeline</h2></div>
          {(notifications ?? []).length === 0 ? (
            <div className="p-8 text-center"><div className="text-3xl">🔔</div><h3 className="mt-3 font-black">No notifications yet</h3><p className="mt-1 text-sm text-slate-600">When a pool for your community is published or your order changes, it will appear here.</p></div>
          ) : (
            <div className="divide-y divide-slate-200">
              {(notifications ?? []).map((note) => {
                const quoteId=/^(?:community_quote|shared_quote_ready):([0-9a-f-]{36})$/i.exec(note.dedupe_key??'')?.[1]
                const quote=quoteId?quoteById.get(quoteId):undefined
                const stage=quote?nextStep(quote):null
                return (
                <div key={note.id} className={note.read_at ? 'bg-transparent' : 'bg-amber-50/30'}>
                  <Link href={safeNotificationHref(note.href)}
                    className="block w-full px-4 py-4 text-left transition-colors hover:bg-white/10 focus-visible:bg-white/10 sm:px-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${note.read_at ? 'bg-slate-200' : note.priority === 'high' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="font-black text-slate-950">{stage?.title??note.title}</h3>
                          <time className="shrink-0 text-xs text-slate-500">{formatDate(note.created_at)}</time>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{stage?.body??note.body}</p>
                        {stage&&<p className="mt-2 font-bold text-sm text-teal-700">{stage.action}</p>}
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span>{String(note.kind).replaceAll('_', ' ')}</span>{!note.read_at && <span>• New</span>}</div>
                      </div>
                    </div>
                  </Link>
                  {!note.read_at&&<form action={markNotificationRead} className="px-4 pb-3 sm:px-5"><input type="hidden" name="notification_id" value={note.id}/><button type="submit" className="text-xs font-semibold underline underline-offset-2">Mark this notification read</button></form>}
                </div>
              )})}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
