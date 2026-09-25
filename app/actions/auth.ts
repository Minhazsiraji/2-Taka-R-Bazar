'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function signUp(formData: FormData) {
  const parsed = authSchema.safeParse({ email: getText(formData, 'email'), password: getText(formData, 'password') })
  if (!parsed.success) redirect('/signup?error=Use+a+valid+email+and+8%2B+character+password')

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  })
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  redirect('/onboarding?notice=Account+created.+Complete+your+pilot+profile.')
}

export async function signIn(formData: FormData) {
  const parsed = authSchema.safeParse({ email: getText(formData, 'email'), password: getText(formData, 'password') })
  if (!parsed.success) redirect('/login?error=Check+your+email+and+password')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/', 'layout')
  redirect('/home')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

const onboardingSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  household_name: z.string().min(2).max(120),
  community_id: z.string().uuid(),
  pickup_point_id: z.string().uuid(),
  address_hint: z.string().max(240).optional(),
  google_maps_url: z.string().url().optional().or(z.literal('')),
})

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser()
  const payload = {
    full_name: getText(formData, 'full_name'),
    phone: getText(formData, 'phone').replaceAll(' ', ''),
    household_name: getText(formData, 'household_name'),
    community_id: getText(formData, 'community_id'),
    pickup_point_id: getText(formData, 'pickup_point_id'),
    address_hint: getText(formData, 'address_hint'),
    google_maps_url: getText(formData, 'google_maps_url'),
  }
  const parsed = onboardingSchema.safeParse(payload)
  if (!parsed.success) redirect('/onboarding?error=Please+check+the+required+profile+fields')

  const { data: pickup } = await supabase.from('pickup_points').select('id').eq('id', parsed.data.pickup_point_id).eq('community_id', parsed.data.community_id).eq('active', true).maybeSingle()
  if (!pickup) redirect('/onboarding?error=Choose+an+active+pickup+point+inside+your+community')

  const { error } = await supabase.from('profiles').update({
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    household_name: parsed.data.household_name,
    community_id: parsed.data.community_id,
    pickup_point_id: parsed.data.pickup_point_id,
    address_hint: parsed.data.address_hint || null,
    google_maps_url: parsed.data.google_maps_url || null,
    onboarding_completed_at: new Date().toISOString(),
  }).eq('id', user.id)

  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/', 'layout')
  redirect('/home')
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser()
  const pickupPointId = getText(formData, 'pickup_point_id')
  if (!pickupPointId) redirect('/profile?error=Choose+a+pickup+point')
  const { data: current } = await supabase.from('profiles').select('community_id').eq('id', user.id).single()
  if (!current?.community_id) redirect('/onboarding')
  const { data: pickup } = await supabase.from('pickup_points').select('id').eq('id', pickupPointId).eq('community_id', current.community_id).eq('active', true).maybeSingle()
  if (!pickup) redirect('/profile?error=Choose+an+active+pickup+point+inside+your+community')
  const { error } = await supabase.from('profiles').update({
    full_name: getText(formData, 'full_name'),
    phone: getText(formData, 'phone').replaceAll(' ', ''),
    household_name: getText(formData, 'household_name'),
    address_hint: getText(formData, 'address_hint') || null,
    google_maps_url: getText(formData, 'google_maps_url') || null,
    pickup_point_id: pickupPointId,
  }).eq('id', user.id)
  if (error) redirect(`/profile?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/profile')
  redirect('/profile?notice=Profile+updated')
}
