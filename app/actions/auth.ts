'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { toBdE164Phone } from '@/lib/bd-phone.mjs'
import { passwordCredentials } from '@/lib/password-login.mjs'
import {safeAuthReturnPath} from '@/lib/auth-intent'
import {authCallbackUrl} from '@/lib/auth-policy.mjs'
import {getAuthProviders} from '@/lib/auth-providers'
import {passwordSetupError} from '@/lib/password-setup.mjs'
import {
  COMMUNITY_QR_CODE_COOKIE,
  COMMUNITY_QR_SCAN_COOKIE,
  COMMUNITY_QR_SOURCE_COOKIE,
  normalizeCommunityQrCode,
} from '@/lib/community-qr'

function getText(formData: FormData, key: string) { return String(formData.get(key) ?? '').trim() }

const intentCookieOptions = {httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: 1800, path: '/'}

async function saveAuthIntent(formData: FormData, signup = false) {
  const store = await cookies()
  const next = safeAuthReturnPath(getText(formData, 'next'))
  if (next) store.set('bp_post_auth_next', next, intentCookieOptions)
  else store.delete('bp_post_auth_next')
  if (signup) {
    const ref = getText(formData, 'referral_code').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
    if (ref) store.set('bp_ref_code', ref, intentCookieOptions)
    else store.delete('bp_ref_code')
  }
  // Retire cookies from the old SMS journey as users move to password/Google.
  store.delete('bp_otp_phone'); store.delete('bp_otp_mode')
}

export async function signUpPhonePassword(formData: FormData) {
  const next = safeAuthReturnPath(getText(formData, 'next'))
  const ref = getText(formData, 'referral_code').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  const back = '/signup?' + (next ? 'next=' + encodeURIComponent(next) + '&' : '') + (ref ? 'ref=' + ref + '&' : '')
  const credentials = passwordCredentials(formData)
  const validation = passwordSetupError(formData.get('password'), formData.get('confirm_password'))
  if (!credentials || !('phone' in credentials) || validation) redirect(back + 'error=' + encodeURIComponent(validation || 'Enter a valid Bangladesh mobile number.'))
  const providers = await getAuthProviders()
  if (!providers.mobileSignup) redirect(back + 'error=Mobile+registration+is+being+configured.+No+SMS+was+requested.+Please+try+Google+or+return+later.')
  const supabase = await createClient()
  const {data: {user: existing}} = await supabase.auth.getUser()
  if (existing) redirect('/account/security?notice=You+are+already+signed+in.+Use+this+account+or+sign+out+before+registering.')
  const {data, error} = await supabase.auth.signUp(credentials)
  if (error || !data.session || data.user?.phone !== credentials.phone.replace(/^\+/, ''))
    redirect(back + 'error=Registration+could+not+be+completed.+If+you+already+have+an+account,+sign+in+instead.')
  await saveAuthIntent(formData, true)
  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

export async function signInGoogle(formData: FormData) {
  const signup = getText(formData, 'intent') === 'signup'
  const back = signup ? '/signup' : '/login'
  const providers = await getAuthProviders()
  if (!providers.google) redirect(back + '?error=Google+sign-in+is+not+configured+yet.')
  const supabase = await createClient()
  const {data: {user}} = await supabase.auth.getUser()
  if (user) redirect('/account/security?notice=Link+Google+here+to+keep+your+existing+account+and+permissions.')
  await saveAuthIntent(formData, signup)
  const store = await cookies()
  store.delete('bp_oauth_link_user')
  const {data, error} = await supabase.auth.signInWithOAuth({provider: 'google', options: {redirectTo: authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL), skipBrowserRedirect: true}})
  if (error || !data.url) redirect(back + '?error=Google+sign-in+could+not+be+started.+Please+try+again+later.')
  redirect(data.url)
}

export async function linkMyGoogle() {
  const {supabase, user} = await requireUser()
  const providers = await getAuthProviders()
  if (!providers.google) redirect('/account/security?error=Google+sign-in+is+not+configured+yet.')
  const store = await cookies()
  store.set('bp_oauth_link_user', user.id, {...intentCookieOptions, maxAge: 600})
  const {data, error} = await supabase.auth.linkIdentity({provider: 'google', options: {redirectTo: authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL), skipBrowserRedirect: true}})
  if (error || !data.url) {
    store.delete('bp_oauth_link_user')
    redirect('/account/security?error=Google+could+not+be+linked.+The+administrator+must+enable+manual+identity+linking,+and+the+Google+account+must+not+belong+to+another+member.')
  }
  redirect(data.url)
}

export async function signInPhonePassword(formData: FormData) {
  const returnTo=safeAuthReturnPath(getText(formData,'next'))
  const back='/login?'+(returnTo?'next='+encodeURIComponent(returnTo)+'&':'')
  const credentials = passwordCredentials(formData)
  if (!credentials) redirect(back+'error=Enter+a+valid+mobile+number+and+password')
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(credentials)
  // A rejected attempt must not revoke a legitimate session already on this device.
  if (error || !data.user || !data.session)
    redirect(back+'error=Mobile+number+or+password+was+not+accepted')
  revalidatePath('/', 'layout')
  await saveAuthIntent(formData)
  const cookieStore = await cookies()
  cookieStore.delete('bp_oauth_link_user')
  const qrCode = normalizeCommunityQrCode(cookieStore.get(COMMUNITY_QR_CODE_COOKIE)?.value)
  if(returnTo==='/account/security')redirect(returnTo)
  // The public storefront cannot supply the old dashboard's household setup gate.
  const {data:profile,error:profileError}=await supabase.from('profiles').select('full_name,phone,community_id,onboarding_completed_at').eq('id',data.user.id).maybeSingle()
  if(profileError)redirect(back+'error=Your+account+profile+could+not+be+loaded.+Please+try+again.')
  if(!profile?.full_name||!profile.phone||!profile.community_id||!profile.onboarding_completed_at)redirect('/onboarding')
  if (qrCode) redirect('/community-invite/' + encodeURIComponent(qrCode))
  redirect(returnTo??'/')
}

export async function setMyPassword(formData: FormData) {
  const {supabase,user}=await requireUser()
  const password=formData.get('password')
  const validation=passwordSetupError(password,formData.get('confirm_password'))
  if(validation)redirect('/account/security?error='+encodeURIComponent(validation))
  // A signed-in Google member may explicitly add a mobile login identifier.
  // Existing phone identities are never replaced here.
  const phone = user.phone ? null : toBdE164Phone(getText(formData, 'phone'))
  if (!user.phone && !phone) redirect('/account/security?error=Enter+a+valid+mobile+number+for+mobile+password+login.')
  if (phone && !(await getAuthProviders()).mobilePassword) redirect('/account/security?error=Mobile+password+setup+is+being+configured.+No+SMS+was+requested.')
  const current=String(formData.get('current_password')??'')
  const {data:updated,error}=await supabase.auth.updateUser({password:password as string,...(phone?{phone}:{}),...(current?{current_password:current}:{})})
  if(error){
    const message=error.code==='same_password'?'Choose a different password.':
      error.code==='weak_password'?'Use a stronger password with letters, numbers and symbols.':
      error.code==='reauthentication_needed'?'Sign in again with Google or your current password before retrying.':
      error.code==='reauthentication_not_valid'?'Sign in again with Google or your current password.':
      error.code==='invalid_credentials'?'Your current password was not accepted.':
      'The password could not be saved. If a current password is required, enter it; otherwise sign in again with Google or your current password.'
    redirect('/account/security?error='+encodeURIComponent(message))
  }
  if(updated.user?.id!==user.id)throw new Error('Password update identity mismatch')
  if (phone && updated.user.phone !== phone.replace(/^\+/, '')) redirect('/account/security?error=Mobile+login+was+not+activated.+Contact+support.')
  if (phone) {
    const {error:profileError}=await supabase.from('profiles').update({phone:updated.user.phone}).eq('id',user.id)
    if(profileError)redirect('/account/security?error=Your+login+was+saved,+but+the+order+contact+could+not+be+updated.+Contact+support.')
  }
  revalidatePath('/account/security')
  redirect('/account/security?notice=Password+saved.+You+can+now+sign+in+with+your+mobile+number+and+this+password')
}

export async function restartSignup() {
  const supabase = await createClient(); await supabase.auth.signOut()
  const cookieStore = await cookies(); cookieStore.delete('bp_otp_phone'); cookieStore.delete('bp_otp_mode'); cookieStore.delete('bp_ref_code')
  revalidatePath('/', 'layout'); redirect('/signup?notice=Choose+Google+or+mobile+and+password+to+register')
}

export async function signOut() {
  const supabase = await createClient(); await supabase.auth.signOut()
  const store = await cookies()
  for (const name of ['bp_otp_phone', 'bp_otp_mode', 'bp_ref_code', 'bp_post_auth_next', 'bp_oauth_link_user']) store.delete(name)
  revalidatePath('/', 'layout'); redirect('/login')
}

const onboardingSchema = z.object({ full_name: z.string().min(2).max(100), household_name: z.string().min(2).max(120), community_id: z.string().uuid(), address_hint: z.string().max(240).optional(), google_maps_url: z.string().url().optional().or(z.literal('')) })

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser(); const phone = user.phone || toBdE164Phone(getText(formData, 'phone'))?.replace(/^\+/, '')
  if (!phone) redirect('/onboarding?error=A+valid+mobile+contact+number+is+required')
  const {data:existingProfile}=await supabase.from('profiles').select('onboarding_completed_at').eq('id',user.id).maybeSingle()
  if(existingProfile?.onboarding_completed_at)redirect('/?notice=Your+household+is+already+set+up.+Contact+Operations+to+change+community.')

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
  const returnTo=safeAuthReturnPath(cookieStore.get('bp_post_auth_next')?.value)
  cookieStore.delete('bp_post_auth_next')
  const notice=qrCommunityName?'Welcome to '+qrCommunityName+'. You can now browse active Pools and Group Deals.':'Household setup complete.'
  const destination=returnTo??'/'
  redirect(destination+(destination.includes('?')?'&':'?')+'notice='+encodeURIComponent(notice))
}

export async function updateProfile(formData: FormData) {
  const { supabase,user }=await requireUser(); const pickupPointId=getText(formData,'pickup_point_id')||null
  const { data:current }=await supabase.from('profiles').select('community_id').eq('id',user.id).single(); if(!current?.community_id) redirect('/onboarding')
  if(pickupPointId){ const {data:pickup}=await supabase.from('pickup_points').select('id').eq('id',pickupPointId).eq('community_id',current.community_id).eq('active',true).maybeSingle(); if(!pickup) redirect('/profile?error=Choose+an+active+pickup+point+inside+your+community') }
  const {error}=await supabase.from('profiles').update({...(user.phone?{phone:user.phone}:{}),full_name:getText(formData,'full_name'),household_name:getText(formData,'household_name'),address_hint:getText(formData,'address_hint')||null,google_maps_url:getText(formData,'google_maps_url')||null,pickup_point_id:pickupPointId}).eq('id',user.id)
  if(error) redirect(`/profile?error=${encodeURIComponent(error.message)}`); revalidatePath('/profile'); redirect('/profile?notice=Profile+updated')
}
