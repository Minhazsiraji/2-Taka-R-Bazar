import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 md:px-8">
        <header className="flex items-center justify-between border-b border-black/10 pb-4">
          <Link href="/" className="font-black tracking-tight">2-TAKA-R-BAZAR</Link>
          <Link href="/login" className="btn-secondary">Sign in</Link>
        </header>
        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <section className="max-w-2xl">
            <img src="/brand-logo.webp" alt="2-TAKA-R-BAZAR — Smart Shopping. Real Savings." className="w-full max-w-[420px]" />
            <h1 className="mt-7 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">Buy together. Pay the real pool price. Keep the savings.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Your community combines demand first. We compare local market prices and supplier offers, publish the final price, and you decide whether to confirm.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link className="btn-primary" href="/signup">Join the community pool</Link><Link className="btn-secondary" href="/login">Sign in</Link></div>
          </section>
          <section className="rounded-[28px] border border-black/10 bg-slate-50 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">How it works</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">              <div className="rounded-2xl bg-white p-5"><b>1. Join your community</b><p className="muted mt-2">Choose your local community and pickup point.</p></div>
              <div className="rounded-2xl bg-white p-5"><b>2. Pool the demand</b><p className="muted mt-2">Households commit quantity before buying.</p></div>
              <div className="rounded-2xl bg-white p-5"><b>3. Confirm after price</b><p className="muted mt-2">A commitment becomes an order only after you accept the final price.</p></div>
              <div className="rounded-2xl bg-white p-5"><b>4. Verify the savings</b><p className="muted mt-2">Savings are credited only after collection.</p></div>
            </div>
            <div className="mt-5 rounded-2xl bg-black p-5 text-white"><p className="text-sm text-white/65">Our rule</p><p className="mt-1 text-xl font-black">No hidden order. No fake saving.</p></div>
          </section>
        </div>
      </div>
    </main>
  )
}
