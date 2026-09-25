import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyPhoneOtp } from '@/app/actions/auth'
import { PublicHeader } from '@/components/public-header'
import { SubmitButton } from '@/components/submit-button'

export default async function VerifyOtpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const store = await cookies()
  const phone = store.get('bp_otp_phone')?.value
  const mode = store.get('bp_otp_mode')?.value === 'signup' ? 'signup' : 'login'
  if (!phone) redirect(mode === 'signup' ? '/signup' : '/login')
  const masked = `${phone.slice(0, 6)}••••${phone.slice(-3)}`
  const changeNumberHref = mode === 'signup' ? '/signup' : '/login'

  return <main className="min-h-screen bg-slate-50 text-black">
    <PublicHeader actionHref={changeNumberHref} actionLabel="Change number" />
    <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-6xl items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center"><h1 className="text-3xl font-black">Verify your mobile</h1><p className="muted mt-2">Enter the 6-digit OTP sent to <b className="text-slate-800">{masked}</b>.</p></div>
        {error && <div className="error mb-4">{error}</div>}
        <form action={verifyPhoneOtp} className="grid gap-4"><label><span className="label">6-digit OTP</span><input className="input text-center text-2xl font-black tracking-[0.35em]" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required /></label><SubmitButton>Verify & continue</SubmitButton></form>
        <p className="mt-5 text-center text-sm text-slate-600">Wrong number? <Link className="font-bold text-black underline underline-offset-4" href={changeNumberHref}>Change mobile number</Link></p>
      </section>
    </div>
  </main>
}
