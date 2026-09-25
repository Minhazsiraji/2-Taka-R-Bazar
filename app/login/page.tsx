import Link from 'next/link'
import { requestLoginOtp } from '@/app/actions/auth'
import { SubmitButton } from '@/components/submit-button'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="card w-full max-w-md p-6 sm:p-8">
    <Link href="/" className="block"><img src="/brand-logo.webp" alt="2-TAKA-R-BAZAR" className="mx-auto w-56" /></Link>
    <div className="mb-6 mt-5 text-center"><h1 className="text-3xl font-black">Sign in</h1><p className="muted mt-2">Use your Bangladesh mobile number. We’ll send a 6-digit OTP.</p></div>
    {notice && <div className="success mb-4">{notice}</div>}{error && <div className="error mb-4">{error}</div>}
    <form action={requestLoginOtp} className="grid gap-4">
      <label><span className="label">Mobile number</span><div className="flex"><span className="flex min-h-11 items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 px-3 font-bold">+88</span><input className="input rounded-l-none" name="phone" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" pattern="01[3-9][0-9]{8}" required /></div></label>
      <SubmitButton>Send OTP</SubmitButton>
    </form>
    <p className="mt-5 text-center text-sm text-slate-600">New here? <Link className="font-bold text-black underline underline-offset-4" href="/signup">Join the community pool</Link></p>
  </section></main>
}
