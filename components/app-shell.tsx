import Link from 'next/link'
import type { AppRole } from '@/lib/auth'

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
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <Link href="/home" className="shrink-0" aria-label="2-TAKA-R-BAZAR home">
            <img src="/brand-logo-header.png" alt="2-TAKA-R-BAZAR - Smart Shopping. Real Savings." className="h-12 w-auto object-contain sm:h-14" />
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-1 overflow-x-auto text-[11px] sm:gap-2 sm:text-sm">
            {(roles.has('pickup_operator') || isSuperAdmin) && <Link className="chip shrink-0" href="/pickup-ops">Pickup Ops</Link>}
            {isAdmin && <Link className="chip shrink-0" href="/admin">Operations</Link>}
            {isSuperAdmin && <Link className="chip shrink-0 bg-black text-white" href="/super-admin">Super Admin</Link>}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl min-w-0 overflow-hidden px-3 pb-24 pt-4 sm:px-4 sm:pt-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
        <div className="grid grid-cols-5 text-center text-[11px]">{mobileNav.map(([href,label])=><Link key={href} href={href} className="min-h-14 px-1 py-3 font-semibold text-slate-700">{label}</Link>)}</div>
      </nav>
      <footer className="hidden border-t bg-white md:block"><div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-4 text-sm">{customerNav.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</div></footer>
    </div>
  )
}
