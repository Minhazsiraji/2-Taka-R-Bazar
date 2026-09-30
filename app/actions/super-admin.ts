'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth'

export async function setUserRole(fd: FormData) {
  const { supabase } = await requireSuperAdmin()
  const userId = String(fd.get('user_id') ?? '')
  const role = String(fd.get('role') ?? '')
  const enabled = String(fd.get('enabled') ?? '') === 'true'
  if (!userId || !['admin','pickup_operator','super_admin'].includes(role)) redirect('/super-admin/access?error=Invalid+role+change')
  const { error } = await supabase.rpc('super_admin_set_role', { p_user_id: userId, p_role: role, p_enabled: enabled })
  if (error) redirect(`/super-admin/access?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/super-admin/access')
  redirect('/super-admin/access?notice=Access+updated')
}
