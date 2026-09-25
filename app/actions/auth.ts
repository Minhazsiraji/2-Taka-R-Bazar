'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { toBdE164Phone } from '@/lib/bd-phone.mjs'

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function phoneOtpErrorMessage(error: { message: string; code?: string }, mode: 'signup' | 'login') {
  if (error.code === 'otp_disabled' || /signups not allowed for otp|otp disabled/i.test(error.message)) {
    if (mode === 'login') {
      return 'No account was found for this mobile number. Please use Join the community pool first.'
    }
    return 'This mobile number is not enabled for development OTP yet. Add it as a Supabase test phone number, or connect a real SMS provider.'
  }
  return error.message
}

async function requestPhoneOtp(formData: FormData, mode: 'signup' | 'login') {
  const phone = toBdE164Phone(getText(formData, 'phone'))
  const back = mode === 'signup' ? '/signup' : '/login'
  if (!phone) redirect(`${back}?error=Enter+a+valid+Bangladesh+mobile+number`)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: mode === 'signup' },
  })
  if (error) redirect(`${back}?error=${encodeURIComponent(phoneOtpErrorMessage(error, mode))}`)

  const cookieStore = await cookies()
  cookieStore.set('bp_otp_phone', phone, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' })
  cookieStore.set('bp_otp_mode', mode, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' })
  redirect('/verify-otp')
}

export async function requestSignupOtp(formData: FormData) {
  return requestPhoneOtp(formData, 'signup')
}

export async function requestLoginOtp(formData: FormData) {
  return requestPhoneOtp(formData, 'login')
}

export async function verifyPhoneOtp(formData: FormData) {
  const token = getText(formData, 'token')
  if (!/^\d{6}$/.test(token)) redirect('/verify-otp?error=Enter+the+6-digit+OTP')

  const cookieStore = await cookies()
  const phone = cookieStore.get('bp_otp_phone')?.value
  const mode = cookieStore.get('bp_otp_mode')?.value === 'signup' ? 'signup' : 'login'
  if (!phone) redirect('/login?error=OTP+session+expired.+Enter+your+mobile+again')

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) redirect(`/verify-otp?error=${encodeURIComponent(error.message)}`)

  cookieStore.delete('bp_otp_phone')
  cookieStore.delete('bp_otp_mode')
  revalidatePath('/', 'layout')
  if (mode === 'signup') redirect('/onboarding?notice=Mobile+verified.+Complete+your+household+profile')
  redirect('/home')
}

export async function restartSignupWithAnotherPhone() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete('bp_otp_phone')
  cookieStore.delete('bp_otp_mode')
  revalidatePath('/', 'layout')
  redirect('/signup?notice=Enter+the+mobile+number+you+want+to+verify')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

const onboardingSchema = z.object({
  full_name: z.string().min(2).max(100),
  household_name: z.string().min(2).max(120),
  community_id: z.string().uuid(),
  address_hint: z.string().max(240).optional(),
  google_maps_url: z.string().url().optional().or(z.literal('')),
})

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser()
  const phone = user.phone
  if (!phone) redirect('/onboarding?error=Verified+mobile+number+is+required')
  const payload = {
    full_name: getText(formData, 'full_name'),
    household_name: getText(formData, 'household_name'),
    community_id: getText(formData, 'community_id'),
    address_hint: getText(formData, 'address_hint'),
    google_maps_url: getText(formData, 'google_maps_url'),
  }
  const parsed = onboardingSchema.safeParse(payload)
  if (!parsed.success) redirect('/onboarding?error=Please+check+the+required+profile+fields')

  const { error } = await supabase.from('profiles').update({
    full_name: parsed.data.full_name,
    phone,
    household_name: parsed.data.household_name,
    community_id: parsed.data.community_id,
    pickup_point_id: null,
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
  const pickupPointId = getText(formData, 'pickup_point_id') || null
  const { data: current } = await supabase.from('profiles').select('community_id').eq('id', user.id).single()
  if (!current?.community_id) redirect('/onboarding')

  if (pickupPointId) {
    const { data: pickup } = await supabase.from('pickup_points').select('id').eq('id', pickupPointId).eq('community_id', current.community_id).eq('active', true).maybeSingle()
    if (!pickup) redirect('/profile?error=Choose+an+active+pickup+point+inside+your+community')
  }

  const { error } = await supabase.from('profiles').update({
    full_name: getText(formData, 'full_name'),
    household_name: getText(formData, 'household_name'),
    address_hint: getText(formData, 'address_hint') || null,
    google_maps_url: getText(formData, 'google_maps_url') || null,
    pickup_point_id: pickupPointId,
  }).eq('id', user.id)
  if (error) redirect(`/profile?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/profile')
  redirect('/profile?notice=Profile+updated')
}
