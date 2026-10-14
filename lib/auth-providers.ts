import 'server-only'
import {cache} from 'react'
import {authProviderStatus} from '@/lib/auth-policy.mjs'

export const getAuthProviders = cache(async () => {
  try {
    const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!endpoint || !key) return authProviderStatus(null)
    const response = await fetch(endpoint + '/auth/v1/settings', {
      headers: {apikey: key}, cache: 'no-store', signal: AbortSignal.timeout(5000),
    })
    return authProviderStatus(response.ok ? await response.json() : null)
  } catch { return authProviderStatus(null) }
})
