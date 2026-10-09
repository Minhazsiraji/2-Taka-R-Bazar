import Link from 'next/link'
import { requestLoginOtp } from '@/app/actions/auth'
import { BdPhoneInput } from '@/components/bd-phone-input'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'
import { SubmitButton } from '@/components/submit-button'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams
  const previewMode = process.env.VERCEL_ENV === 'preview'

  return <main className="min-h-screen bg-slate-50 text-black">
    <PublicHeader actionHref="/signup" actionLabel="Join the community pool" />
    <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-6xl items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-black">Sign in</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600" lang="bn">সাইন ইন করুন</p>
          <p className="muted mt-3">Use your Bangladesh mobile number. We’ll send a 6-digit OTP.</p>
          <p className="mt-1 text-[12px] leading-5 text-slate-500" lang="bn">আপনার বাংলাদেশি মোবাইল নম্বর দিন। আমরা ৬ সংখ্যার একটি OTP পাঠাব।</p>
        </div>

        {notice && <div className="success mb-4">{notice}</div>}
        {error && <div className="error mb-4">{error}</div>}

        {previewMode && <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <div className="text-sm font-black text-cyan-950">Preview review mode</div>
          <p className="mt-1 text-xs leading-5 text-cyan-900">Open a Preview-only synthetic UAT view of Home, Pools, Deals, Orders and Savings. No SMS or OTP credit is used.</p>
          <Link href="/preview-demo" className="btn-primary mt-3 w-full">Open Preview without OTP</Link>
        </div>}

        <form action={requestLoginOtp} className="grid gap-4">
          <BdPhoneInput />
          <SubmitButton>Send OTP</SubmitButton>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">New here? <Link className="font-bold text-black underline underline-offset-4" href="/signup">Join the community pool</Link><span className="mt-1 block text-[12px] text-slate-500" lang="bn">নতুন? <Link className="font-bold text-black underline underline-offset-4" href="/signup">কমিউনিটি পুলে যোগ দিন</Link></span></p>
      </section>
    </div>
    <PublicFooter />
  </main>
}
