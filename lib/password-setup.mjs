export const PASSWORD_SETUP_WINDOW_SECONDS = 15 * 60

// Use verified AMR evidence, not a refreshed token's iat or editable metadata.
export function hasRecentAuthentication(claims, nowSeconds = Date.now() / 1000) {
  return Array.isArray(claims?.amr) && claims.amr.some(entry =>
    ['otp', 'password', 'recovery'].includes(entry?.method) &&
    Number.isFinite(entry.timestamp) && entry.timestamp <= nowSeconds + 30 &&
    nowSeconds - entry.timestamp <= PASSWORD_SETUP_WINDOW_SECONDS)
}

export function passwordSetupError(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    return 'Use a password between 12 and 128 characters.'
  if (password !== confirmation) return 'The two passwords do not match.'
  return null
}
