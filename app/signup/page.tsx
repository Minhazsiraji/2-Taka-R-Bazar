import Link from 'next/link'
import { signUp } from '@/app/actions/auth'
import { SubmitButton } from '@/components/submit-button'

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10"><section className="card w-full">
    <div className="mb-6"><Link href="/" className="text-lg font-black text-emerald-700">1TAKA BazarPool</Link><h1 className="mt-3 text-3xl font-black">Join the pilot</h1><p className="muted mt-1">Start with email/password. Your Bangladesh mobile number is collected securely in onboarding.</p></div>
    {error && <div className="error mb-4">{error}</div>}
    <form action={signUp} className="grid gap-4"><label><span className="label">Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label><label><span className="label">Password</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label><SubmitButton>Create account</SubmitButton></form>
    <p className="mt-5 text-sm text-slate-600">Already joined? <Link className="font-bold text-emerald-700" href="/login">Sign in</Link></p>
  </section></main>
}
