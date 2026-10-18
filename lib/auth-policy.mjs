const ALLOWED = new Set(['/', '/group-deals', '/pool', '/shop', '/cart', '/checkout', '/account', '/account/security', '/pilot-book', '/pilot-bookings'])

export function safeAuthReturnPath(value) {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('#') || raw.length > 100) return null
  try {
    const url = new URL(raw, 'https://2takarbazar.com')
    const path = url.pathname === '/home' ? '/' : url.pathname
    if (url.origin !== 'https://2takarbazar.com' || !ALLOWED.has(path)) return null
    if (path === '/pilot-book') {
      const product = url.searchParams.get('product')
      return product && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(product)
        ? '/pilot-book?product=' + product.toLowerCase()
        : '/pilot-book'
    }
    return path
  } catch { return null }
}

// Configuration comes from the deployment, never request Host/forwarded headers.
export function authCallbackUrl(siteUrl) {
  const url = new URL(siteUrl || 'https://2takarbazar.com')
  const local = ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('Invalid authentication site URL')
  return url.origin + '/auth/callback'
}

export function authProviderStatus(settings) {
  const available = !!settings && typeof settings === 'object' && typeof settings.external === 'object' && settings.external !== null
  return {
    available,
    google: available && settings.external.google === true,
    // Fail closed before signup/updateUser(phone), which otherwise might send SMS.
    mobileSignup: available && settings.external.phone === true && settings.phone_autoconfirm === true && settings.disable_signup === false,
    mobilePassword: available && settings.external.phone === true && settings.phone_autoconfirm === true,
  }
}
