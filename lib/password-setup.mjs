export function passwordSetupError(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    return 'Use a password between 12 and 128 characters.'
  if (password !== confirmation) return 'The two passwords do not match.'
  return null
}
