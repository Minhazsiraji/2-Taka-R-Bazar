export function commerceUatLoginEnabled(env=process.env) {
  return env.VERCEL_ENV==='preview' && env.COMMERCE_UAT_LOGIN_ENABLED==='true'
}
