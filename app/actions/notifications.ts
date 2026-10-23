'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {safeNotificationHref} from '@/lib/notification-links.mjs'
import { requireOnboardedUser } from '@/lib/auth'

export async function openNotification(formData: FormData) {
  const { supabase, user } = await requireOnboardedUser()
  const id = String(formData.get('notification_id') ?? '')
  if (!id) redirect('/notifications')
  const { data } = await supabase.from('notifications').select('id,href').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!data) redirect('/notifications')
  const {error}=await supabase.rpc('mark_notification_read', { p_notification_id: id })
  if(error)redirect('/notifications?error=Could+not+mark+notification+read.+Please+try+again.')
  revalidatePath('/notifications')
  const href = safeNotificationHref(data.href)
  redirect(href)
}

export async function markNotificationRead(formData: FormData) {
 const {supabase,user}=await requireOnboardedUser()
 const id=String(formData.get('notification_id')??'')
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))redirect('/notifications')
 const {data}=await supabase.from('notifications').select('id').eq('user_id',user.id).eq('id',id).maybeSingle()
 if(!data)redirect('/notifications')
 const {error}=await supabase.rpc('mark_notification_read',{p_notification_id:id})
 if(error)redirect('/notifications?error=Could+not+mark+notification+read')
 revalidatePath('/notifications')
 redirect('/notifications')
}

export async function markAllNotificationsRead() {
  const { supabase } = await requireOnboardedUser()
  const {error}=await supabase.rpc('mark_all_notifications_read')
  if(error)redirect('/notifications?error=Could+not+mark+notifications+read.+Please+try+again.')
  revalidatePath('/notifications')
  revalidatePath('/')
  redirect('/notifications')
}

export async function savePushSubscription(input: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null }) {
  const { supabase } = await requireOnboardedUser()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: input.userAgent ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/notifications')
  return { ok: true as const }
}

export async function disablePushSubscription(endpoint: string) {
  const { supabase } = await requireOnboardedUser()
  const { error } = await supabase.rpc('remove_push_subscription', { p_endpoint: endpoint })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/notifications')
  return { ok: true as const }
}
