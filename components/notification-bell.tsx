import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth'

export async function NotificationBell() {
  const { supabase, user } = await requireOnboardedUser()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  const unread = Number(count ?? 0)
  return (
    <Link href="/notifications" className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50" aria-label={unread ? `${unread} unread notifications` : 'Notifications'}>
      <span aria-hidden="true" className="text-base">🔔</span>
      {unread > 0 && <span className="absolute right-0 top-0 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-center text-[9px] font-black leading-4 text-white shadow-sm">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  )
}
