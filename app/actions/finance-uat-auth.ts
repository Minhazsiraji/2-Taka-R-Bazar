'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { financeUatLoginEnabled } from '@/lib/finance/uat-access'
import { passwordCredentials } from '@/lib/password-login.mjs'

export async function signInFinanceUat(form: FormData) {
  if (!financeUatLoginEnabled()) throw new Error('Finance UAT sign-in unavailable')
  const credentials = passwordCredentials(form, true)
  if (!credentials) redirect('/finance-uat/login?error=Enter+a+valid+reviewer+identifier+and+password')
  const client = await createClient()
  const { error } = await client.auth.signInWithPassword(credentials)
  const authorization = error ? null : await client.rpc('finance_uat_session_active')
  if (error || authorization?.error || authorization?.data !== true) {
    await client.auth.signOut()
    redirect('/finance-uat/login?error=' + encodeURIComponent('Sign-in requires an authorized reviewer account with an active UAT lease.'))
  }
  redirect('/admin/finance-customers')
}
