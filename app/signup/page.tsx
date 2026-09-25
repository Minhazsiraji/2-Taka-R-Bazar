import Link from 'next/link'
import { requestSignupOtp } from '@/app/actions/auth'
import { BdPhoneInput } from '@/components/bd-phone-input'
import { PublicHeader } from '@/components/public-header'
import { SubmitButton } from '@/components/submit-button'

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <main className="min-h-screen bg-slate-50 text-black">
    <PublicHeader actionHref="/login" actionLabel="Sign in" />
    <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-6xl items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center"><h1 className="text-3xl font-black">Join the community pool</h1><p className="muted mt-2">No email required. Enter your Bangladesh mobile number and verify it with OTP.</p></div>
        {error && <div className="error mb-4">{error}</div>}
        <form action={requestSignupOtp} className="grid gap-4">
          <BdPhoneInput />
          <SubmitButton>Send OTP</SubmitButton>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">Already a member? <Link className="font-bold text-black underline underline-offset-4" href="/login">Sign in</Link></p>
      </section>
    </div>
  </main>
}
