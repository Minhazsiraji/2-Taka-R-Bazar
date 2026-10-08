'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { toBdE164Phone } from '@/lib/bd-phone.mjs'
import {
  COMMUNITY_QR_CODE_COOKIE,
  COMMUNITY_QR_SCAN_COOKIE,
  COMMUNITY_QR_SOURCE_COOKIE,
  normalizeCommunityQrCode,
} from '@/lib/community-qr'

function getText(formData: FormData, key: string) { return String(formData.get(key) ?? '').trim() }

function phoneOtpErrorMessage(error: { message: string; code?: string }, mode: 'signup' | 'login') {
  const message = error.message || ''
  if (error.code === 'otp_disabled' || /signups not allowed for otp|otp disabled/i.test(message)) {
    return mode === 'login'
      ? 'No account was found for this mobile number. Please use Join the community pool first.'
      : 'Mobile OTP is not available yet. Please try again later.'
  }
  // Never expose upstream SMS-provider account IDs, credentials, URLs or raw provider errors to customers.
  if (/twilio|auth account|provider|confirmation otp|20003|authentication error|invalid.*credential/i.test(message)) {
    console.error('Phone OTP provider failure', { code: error.code, message })
    return 'SMS service is temporarily unavailable. The administrator needs to reconnect the OTP provider. Please try again after it is restored.'
  }
  console.error('Phone OTP request failed', { code: error.code, message })
  return 'We could not send the OTP right now. Please try again shortly.'
}

async function requestPhoneOtp(formData: FormData, mode: 'signup' | 'login') {
  const phone = toBdE164Phone(getText(formData, 'phone'))
  const referralCode = mode === 'signup' ? getText(formData, 'referral_code').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) : ''
  const back = mode === 'signup' ? '/signup' : '/login'
  if (!phone) redirect(`${back}?error=Enter+a+valid+Bangladesh+mobile+number`)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: mode === 'signup' } })
  if (error) redirect(`${back}?error=${encodeURIComponent(phoneOtpErrorMessage(error, mode))}`)
  const cookieStore = await cookies()
  cookieStore.set('bp_otp_phone', phone, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' })
  cookieStore.set('bp_otp_mode', mode, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' })
  if (mode === 'signup') {
    if (referralCode) cookieStore.set('bp_ref_code', referralCode, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1800, path: '/' })
    else cookieStore.delete('bp_ref_code')
  }
  redirect('/verify-otp')
}

export async function requestSignupOtp(formData: FormData) { return requestPhoneOtp(formData, 'signup') }
export async function requestLoginOtp(formData: FormData) { return requestPhoneOtp(formData, 'login') }

export async function verifyPhoneOtp(formData: FormData) {
  const token = getText(formData, 'token')
  if (!/^\d{6}$/.test(token)) redirect('/verify-otp?error=Enter+the+6-digit+OTP')
  const cookieStore = await cookies()
  const phone = cookieStore.get('bp_otp_phone')?.value
  const mode = cookieStore.get('bp_otp_mode')?.value === 'signup' ? 'signup' : 'login'
  if (!phone) redirect('/login?error=OTP+session+expired.+Enter+your+mobile+again')
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) {
    console.warn('Phone OTP verification failed', { code: error.code })
    redirect('/verify-otp?error=The+OTP+is+invalid+or+expired.+Request+a+new+code+and+try+again')
  }
  cookieStore.delete('bp_otp_phone'); cookieStore.delete('bp_otp_mode')
  revalidatePath('/', 'layout')
  const qrCode=normalizeCommunityQrCode(cookieStore.get(COMMUNITY_QR_CODE_COOKIE)?.value)
  if (mode === 'signup') {
    const notice=qrCode?'Mobile verified. Complete your household profile to join your scanned community.':'Mobile verified. Complete your household profile.'
    redirect('/onboarding?notice='+encodeURIComponent(notice))
  }
  if(qrCode) redirect('/community-invite/'+encodeURIComponent(qrCode)+'?notice='+encodeURIComponent('Mobile verified. Confirm your community to continue.'))
  redirect('/home')
}

export async function restartSignupWithAnotherPhone() {
  const supabase = await createClient(); await supabase.auth.signOut()
  const cookieStore = await cookies(); cookieStore.delete('bp_otp_phone'); cookieStore.delete('bp_otp_mode'); cookieStore.delete('bp_ref_code')
  revalidatePath('/', 'layout'); redirect('/signup?notice=Enter+the+mobile+number+you+want+to+verify')
}

export async function signOut() { const supabase = await createClient(); await supabase.auth.signOut(); revalidatePath('/', 'layout'); redirect('/login') }

const onboardingSchema = z.object({ full_name: z.string().min(2).max(100), household_name: z.string().min(2).max(120), community_id: z.string().uuid(), address_hint: z.string().max(240).optional(), google_maps_url: z.string().url().optional().or(z.literal('')) })

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser(); const phone = user.phone
  if (!phone) redirect('/onboarding?error=Verified+mobile+number+is+required')

  const cookieStore=await cookies()
  const qrCode=normalizeCommunityQrCode(cookieStore.get(COMMUNITY_QR_CODE_COOKIE)?.value)
  let forcedCommunityId=''
  let qrCommunityName=''
  if(qrCode){
    const {data:qrRows}=await supabase.rpc('get_public_community_qr',{p_code:qrCode})
    const qr=Array.isArray(qrRows)?qrRows[0]:null
    if(qr){ forcedCommunityId=String(qr.community_id); qrCommunityName=String(qr.community_name) }
  }

  const payload = {
    full_name:getText(formData,'full_name'),
    household_name:getText(formData,'household_name'),
    community_id:forcedCommunityId||getText(formData,'community_id'),
    address_hint:getText(formData,'address_hint'),
    google_maps_url:getText(formData,'google_maps_url')
  }
  const parsed = onboardingSchema.safeParse(payload); if (!parsed.success) redirect('/onboarding?error=Please+check+the+required+profile+fields')
  const { error } = await supabase.from('profiles').update({ full_name:parsed.data.full_name, phone, household_name:parsed.data.household_name, community_id:parsed.data.community_id, pickup_point_id:null, address_hint:parsed.data.address_hint||null, google_maps_url:parsed.data.google_maps_url||null, onboarding_completed_at:new Date().toISOString() }).eq('id',user.id)
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`)

  const referralCode=cookieStore.get('bp_ref_code')?.value
  if(referralCode) await supabase.rpc('apply_referral_code',{p_code:referralCode})
  cookieStore.delete('bp_ref_code')

  if(qrCode&&forcedCommunityId){
    const scanRaw=cookieStore.get(COMMUNITY_QR_SCAN_COOKIE)?.value
    const scanToken=scanRaw&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scanRaw)?scanRaw:null
    const {error:qrError}=await supabase.rpc('complete_community_qr_conversion',{p_code:qrCode,p_scan_token:scanToken})
    if(qrError) console.error('Community QR onboarding attribution failed',{code:qrCode,message:qrError.message})
    cookieStore.delete(COMMUNITY_QR_CODE_COOKIE)
    cookieStore.delete(COMMUNITY_QR_SCAN_COOKIE)
    cookieStore.delete(COMMUNITY_QR_SOURCE_COOKIE)
  }

  revalidatePath('/','layout')
  const notice=qrCommunityName?'Welcome to '+qrCommunityName+'. You can now browse active Pools and Group Deals.':'Household setup complete.'
  redirect('/home?notice='+encodeURIComponent(notice))
}

export async function updateProfile(formData: FormData) {
  const { supabase,user }=await requireUser(); const pickupPointId=getText(formData,'pickup_point_id')||null
  const { data:current }=await supabase.from('profiles').select('community_id').eq('id',user.id).single(); if(!current?.community_id) redirect('/onboarding')
  if(pickupPointId){ const {data:pickup}=await supabase.from('pickup_points').select('id').eq('id',pickupPointId).eq('community_id',current.community_id).eq('active',true).maybeSingle(); if(!pickup) redirect('/profile?error=Choose+an+active+pickup+point+inside+your+community') }
  const {error}=await supabase.from('profiles').update({full_name:getText(formData,'full_name'),household_name:getText(formData,'household_name'),address_hint:getText(formData,'address_hint')||null,google_maps_url:getText(formData,'google_maps_url')||null,pickup_point_id:pickupPointId}).eq('id',user.id)
  if(error) redirect(`/profile?error=${encodeURIComponent(error.message)}`); revalidatePath('/profile'); redirect('/profile?notice=Profile+updated')
}
