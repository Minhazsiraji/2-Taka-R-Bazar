import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const NOINDEX_PREFIXES = [
  '/login',
  '/signup',
  '/auth',
  '/admin',
  '/super-admin',
  '/home',
  '/pool',
  '/orders',
  '/savings',
  '/community',
  '/pickup',
  '/pickup-ops',
  '/profile',
  '/notifications',
  '/subscription',
  '/onboarding',
  '/verify-otp',
  '/feedback',
  '/money',
]

function shouldNoIndex(pathname: string) {
  return NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)

  if (shouldNoIndex(request.nextUrl.pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|maskable.svg|sw.js|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
