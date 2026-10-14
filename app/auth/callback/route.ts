import {NextResponse} from 'next/server'
import {cookies} from 'next/headers'
import {createClient} from '@/lib/supabase/server'
import {authCallbackUrl, safeAuthReturnPath} from '@/lib/auth-policy.mjs'
import {COMMUNITY_QR_CODE_COOKIE, normalizeCommunityQrCode} from '@/lib/community-qr'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const store = await cookies()
  const expectedUser = store.get('bp_oauth_link_user')?.value
  const origin = new URL(authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL)).origin
  const fail = (message: string) => NextResponse.redirect(origin + (expectedUser ? '/account/security' : '/login') + '?error=' + encodeURIComponent(message))
  store.delete('bp_oauth_link_user')
  const code = params.get('code')
  if (!code || params.has('error')) return fail('Google sign-in was not completed. Please try again.')
  const supabase = await createClient()
  const {data, error} = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user || !data.session) return fail('Google sign-in could not be completed. Please try again.')
  if (expectedUser) {
    if (data.user.id !== expectedUser) {
      await supabase.auth.signOut()
      return fail('The account did not match. Sign in to your original account before linking Google.')
    }
    if (!data.user.identities?.some(identity => identity.provider === 'google')) return fail('Google was not linked. Please try again.')
    return NextResponse.redirect(origin + '/account/security?notice=Google+linked+to+your+existing+account')
  }
  const next = safeAuthReturnPath(store.get('bp_post_auth_next')?.value) || safeAuthReturnPath(params.get('next'))
  const {data: profile, error: profileError} = await supabase.from('profiles').select('full_name,phone,community_id,onboarding_completed_at').eq('id', data.user.id).maybeSingle()
  if (profileError) return fail('Your account profile could not be loaded. Please try again.')
  if (!profile?.full_name || !profile.phone || !profile.community_id || !profile.onboarding_completed_at) return NextResponse.redirect(origin + '/onboarding')
  store.delete('bp_post_auth_next')
  if (next === '/account/security') return NextResponse.redirect(origin + next)
  const qr = normalizeCommunityQrCode(store.get(COMMUNITY_QR_CODE_COOKIE)?.value)
  return NextResponse.redirect(origin + (qr ? '/community-invite/' + encodeURIComponent(qr) : next || '/'))
}
