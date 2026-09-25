import Link from 'next/link'
import { requestLoginOtp } from '@/app/actions/auth'
import { BdPhoneInput } from '@/components/bd-phone-input'
import { PublicHeader } from '@/components/public-header'
import { SubmitButton } from '@/components/submit-button'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams
  return <main className="min-h-screen bg-slate-50 text-black">
    <PublicHeader actionHref="/signup" actionLabel="Join the community pool" />
    <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-6xl items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center"><h1 className="text-3xl font-black">Sign in</h1><p className="muted mt-2">Use your Bangladesh mobile number. We’ll send a 6-digit OTP.</p></div>
        {notice && <div className="success mb-4">{notice}</div>}{error && <div className="error mb-4">{error}</div>}
        <form action={requestLoginOtp} className="grid gap-4">
          <BdPhoneInput />
          <SubmitButton>Send OTP</SubmitButton>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">New here? <Link className="font-bold text-black underline underline-offset-4" href="/signup">Join the community pool</Link></p>
      </section>
    </div>
  </main>
}
