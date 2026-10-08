import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function previewPhone(userId: string) {
  const hex = userId.replace(/-/g, '')
  const suffix = (BigInt('0x' + hex) % 100_000_000n).toString().padStart(8, '0')
  return '+88019' + suffix
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.redirect(new URL('/login?error=Preview+demo+login+is+available+only+on+Preview+deployments', url))
  }

  const supabase = await createClient()
  const { data: { user: existingUser } } = await supabase.auth.getUser()
  if (existingUser) return NextResponse.redirect(new URL('/home', url))

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) {
    console.error('Preview anonymous sign-in failed', { code: error?.code, message: error?.message })
    return NextResponse.redirect(new URL('/login?error=Preview+demo+login+is+not+enabled+yet', url))
  }

  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', 'e2e-uat-community')
    .eq('active', true)
    .maybeSingle()

  if (communityError || !community) {
    console.error('Preview demo community lookup failed', { message: communityError?.message })
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=Preview+demo+community+is+unavailable', url))
  }

  const { data: pickup } = await supabase
    .from('pickup_points')
    .select('id')
    .eq('community_id', community.id)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: 'Preview Demo Customer',
      phone: previewPhone(data.user.id),
      household_name: 'Preview Demo Household',
      community_id: community.id,
      pickup_point_id: pickup?.id ?? null,
      address_hint: 'Preview-only E2E household',
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', data.user.id)

  if (profileError) {
    console.error('Preview demo profile setup failed', { message: profileError.message })
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=Preview+demo+profile+setup+failed', url))
  }

  return NextResponse.redirect(new URL('/home', url))
}
