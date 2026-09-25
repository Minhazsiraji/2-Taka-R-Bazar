import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-5 py-10">
      <div className="grid w-full gap-8 md:grid-cols-2 md:items-center">
        <section>
          <p className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">Savar community pilot</p>
          <h1 className="text-5xl font-black tracking-tight md:text-6xl"><span className="text-emerald-700">1TAKA</span><br/>BazarPool</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Families combine demand. We compare local market prices and supplier offers. You confirm only after the final pool price is published, then verified savings are recorded after pickup.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link className="btn-primary" href="/signup">Join the pilot</Link><Link className="btn-secondary" href="/login">Sign in</Link></div>
        </section>
        <section className="card grid gap-4">
          <div><div className="card-title">The promise</div><div className="metric text-emerald-700">You saved ৳___</div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><b>Demand first</b><p className="muted mt-1">No inventory speculation.</p></div><div className="rounded-xl bg-slate-50 p-4"><b>Confirm after price</b><p className="muted mt-1">A commitment is not a purchase.</p></div><div className="rounded-xl bg-slate-50 p-4"><b>Local pickup</b><p className="muted mt-1">Lean pilot operations.</p></div><div className="rounded-xl bg-slate-50 p-4"><b>Verified savings</b><p className="muted mt-1">Credited only after collection.</p></div></div>
        </section>
      </div>
    </main>
  )
}
