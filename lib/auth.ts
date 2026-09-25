import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'customer' | 'admin' | 'pickup_operator' | 'super_admin'

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function getViewer() {
  const { supabase, user } = await requireUser()
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ])
  return {
    supabase,
    user,
    profile,
    roles: new Set<AppRole>((roles ?? []).map((r: { role: AppRole }) => r.role)),
  }
}

export async function requireOnboardedUser() {
  const viewer = await getViewer()
  if (!viewer.profile?.full_name || !viewer.profile?.phone || !viewer.profile?.community_id) {
    redirect('/onboarding')
  }
  return viewer
}

export async function requireAdmin() {
  const viewer = await getViewer()
  if (!viewer.roles.has('admin') && !viewer.roles.has('super_admin')) redirect('/home')
  return viewer
}

export async function requireSuperAdmin() {
  const viewer = await getViewer()
  if (!viewer.roles.has('super_admin')) redirect('/home')
  return viewer
}

export async function requirePickupOperator() {
  const viewer = await getViewer()
  if (!viewer.roles.has('pickup_operator') && !viewer.roles.has('admin') && !viewer.roles.has('super_admin')) redirect('/home')
  return viewer
}
