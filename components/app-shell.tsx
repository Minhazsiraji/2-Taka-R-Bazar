import Link from 'next/link'
import type { AppRole } from '@/lib/auth'

const customerNav = [
  ['/home', 'Home'], ['/pool', 'Pool'], ['/orders', 'Orders'], ['/savings', 'Savings'], ['/community', 'Community'], ['/pickup', 'Pickup'], ['/profile', 'Profile'],
]

export function AppShell({ children, roles = new Set<AppRole>() }: { children: React.ReactNode; roles?: Set<AppRole> }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/home" className="flex items-baseline gap-2 font-black tracking-tight"><span className="text-xl text-emerald-700">1TAKA</span><span className="text-sm text-slate-500">BazarPool</span></Link>
          <div className="flex gap-2 text-sm">
            {roles.has('pickup_operator') && <Link className="chip" href="/pickup-ops">Pickup Ops</Link>}
            {roles.has('admin') && <Link className="chip" href="/admin">Admin</Link>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden">
        <div className="grid grid-cols-5 text-center text-[11px]">
          {customerNav.slice(0, 5).map(([href, label]) => <Link key={href} href={href} className="min-h-14 px-1 py-3 font-semibold text-slate-700">{label}</Link>)}
        </div>
      </nav>
      <footer className="hidden border-t bg-white md:block"><div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-4 text-sm">{customerNav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</div></footer>
    </div>
  )
}
