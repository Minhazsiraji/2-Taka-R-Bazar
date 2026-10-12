import { notFound } from 'next/navigation'
import { signInFinanceUat } from '@/app/actions/finance-uat-auth'
import { financeUatLoginEnabled } from '@/lib/finance/uat-access'
import { SubmitButton } from '@/components/submit-button'
import { BdPhoneInput } from '@/components/bd-phone-input'

export default async function FinanceUatLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!financeUatLoginEnabled()) notFound()
  const { error } = await searchParams
  return <main className="mx-auto max-w-md px-4 py-12">
    <section className="card p-6">
      <h1 className="text-2xl font-bold">Finance UAT reviewer sign-in</h1>
      <p className="my-4 text-sm">Use your temporary reviewer account. Each maker and checker signs in separately. Access expires with your UAT lease.</p>
      {error && <p className="error mb-4" role="alert">{error}</p>}
      <form action={signInFinanceUat} className="grid gap-4">
        <label>Reviewer email<input className="input mt-1 w-full" name="email" type="email" autoComplete="username" required maxLength={254} /></label>
        <label>Password<input className="input mt-1 w-full" name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
        <SubmitButton>Sign in for finance UAT</SubmitButton>
      </form>
      <h2 className="mt-6 font-bold">Existing mobile reviewer account</h2>
      <p className="my-3 text-sm">Use your existing verified mobile number and password. Your independent reviewer role and temporary UAT lease are still required. No SMS is sent.</p>
      <form action={signInFinanceUat} className="grid gap-4">
        <BdPhoneInput />
        <label>Password<input className="input mt-1 w-full" name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
        <SubmitButton>Sign in with mobile and password</SubmitButton>
      </form>
    </section>
  </main>
}
