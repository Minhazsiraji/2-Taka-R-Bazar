export function financeUatLoginEnabled() {
  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return process.env.VERCEL_ENV === 'preview' &&
    process.env.FINANCE_UAT_LOGIN_ENABLED === 'true' &&
    process.env.FINANCE_WRITES_ENABLED === 'true' && !!endpoint &&
    endpoint === process.env.FINANCE_PREVIEW_SUPABASE_URL &&
    (!endpoint.includes('sukabonfjcnaavjgjyuy') || process.env.FINANCE_SHARED_DB_UAT_ENABLED === 'true')
}
