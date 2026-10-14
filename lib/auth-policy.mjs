const ALLOWED = new Set(['/', '/group-deals', '/pool', '/shop', '/home', '/cart', '/checkout', '/account', '/account/security'])

export function safeAuthReturnPath(value) {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('#') || raw.length > 100) return null
  try {
    const url = new URL(raw, 'https://2takarbazar.com')
    return url.origin === 'https://2takarbazar.com' && ALLOWED.has(url.pathname) ? url.pathname : null
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
