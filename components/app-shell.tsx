import Link from 'next/link'
import type { AppRole } from '@/lib/auth'
import { BrandLogo } from '@/components/brand-logo'

const customerNav = [
  ['/home', 'Home'], ['/pool', 'Pools'], ['/orders', 'Orders'], ['/savings', 'Savings'],
  ['/community', 'Community'], ['/pickup', 'Pickup'], ['/profile', 'Profile'],
]
const mobileNav = [
  ['/home', 'Home'], ['/pool', 'Pools'], ['/orders', 'Orders'], ['/savings', 'Savings'], ['/profile', 'Profile'],
]

export function AppShell({ children, roles = new Set<AppRole>() }: { children: React.ReactNode; roles?: Set<AppRole> }) {
  const isSuperAdmin = roles.has('super_admin')
  const isAdmin = roles.has('admin') || isSuperAdmin

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <Link href="/home" className="flex shrink-0 items-center gap-2.5" aria-label="2-TAKA-R-BAZAR home">
            <BrandLogo size={52} />
            <div className="hidden sm:block">
              <div className="text-sm font-black tracking-tight">2-TAKA-R-BAZAR</div>
              <div className="text-[10px] font-semibold tracking-wide text-slate-500">Smart Shopping. Real Savings.</div>
            </div>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto text-[10px] sm:gap-2 sm:text-xs">
            {(roles.has('pickup_operator') || isSuperAdmin) && <Link className="chip shrink-0 px-2.5" href="/pickup-ops">Pickup Ops</Link>}
            {isAdmin && <Link className="chip shrink-0 px-2.5" href="/admin">Operations</Link>}
            {isSuperAdmin && <Link className="chip shrink-0 bg-black px-2.5 text-white" href="/super-admin">Super Admin</Link>}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 overflow-x-hidden px-3 pb-24 pt-4 sm:px-5 sm:pb-8 sm:pt-6">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-6px_20px_rgba(15,23,42,0.06)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 text-center text-[11px]">{mobileNav.map(([href,label])=><Link key={href} href={href} className="flex min-h-16 min-w-0 items-center justify-center px-1 py-3 font-bold text-slate-700 hover:bg-slate-50">{label}</Link>)}</div>
      </nav>

      <footer className="hidden border-t border-slate-800 bg-slate-950 text-white md:block">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3"><BrandLogo size={48} /><div><div className="font-black">2-TAKA-R-BAZAR</div><div className="text-xs text-slate-400">Smart Shopping. Real Savings.</div></div></div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">Community-powered grocery pooling with transparent local price benchmarks, flexible pickup choices, and verified savings.</p>
          </div>
          <div><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Shop</div><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">{customerNav.slice(0,4).map(([href,label])=><Link key={href} href={href} className="text-slate-300 hover:text-white">{label}</Link>)}</div></div>
          <div><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Account & community</div><div className="mt-3 grid gap-2 text-sm">{customerNav.slice(4).map(([href,label])=><Link key={href} href={href} className="text-slate-300 hover:text-white">{label}</Link>)}</div></div>
        </div>
        <div className="border-t border-slate-800"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 text-xs text-slate-500"><span>© 2026 2-TAKA-R-BAZAR</span><span>Community first · transparent savings</span></div></div>
      </footer>
    </div>
  )
}
