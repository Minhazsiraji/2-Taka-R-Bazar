'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { financeUatLoginEnabled } from '@/lib/finance/uat-access'

export async function signInFinanceUat(form: FormData) {
  if (!financeUatLoginEnabled()) throw new Error('Finance UAT sign-in unavailable')
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '')
  const client = await createClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  const authorization = error ? null : await client.rpc('finance_uat_session_active')
  if (error || authorization?.error || authorization?.data !== true) {
    await client.auth.signOut()
    redirect('/finance-uat/login?error=' + encodeURIComponent('Sign-in requires an authorized reviewer account with an active UAT lease.'))
  }
  redirect('/admin/finance-customers')
}
