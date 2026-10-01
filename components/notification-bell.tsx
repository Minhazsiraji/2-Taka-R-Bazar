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
      {unread > 0 && <span className="notification-unread-badge absolute right-[-2px] top-[1px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-cyan-300 px-1 text-center text-[10px] font-black leading-none text-slate-950 shadow-[0_2px_8px_rgba(6,182,212,.45)]">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  )
}
