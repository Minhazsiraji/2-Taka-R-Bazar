import Link from 'next/link'
import { Suspense } from 'react'
import type { AppRole } from '@/lib/auth'
import { BrandLogo } from '@/components/brand-logo'
import { NotificationBell } from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { PILOT_MODE } from '@/lib/pilot-mode'
import { LEGAL_LINKS } from '@/lib/legal'

const customerNav = [
  ['/home', 'Home'], ['/pool', 'Pools'], ['/money', 'My Money'], ['/orders', 'Orders'], ['/savings', 'Savings'],
  ...(!PILOT_MODE ? [['/subscription', 'Membership']] : []),
  ['/community', 'Community'], ['/pickup', 'Pickup'], ['/profile', 'Profile'], ['/notifications', 'Notifications'],
]
const mobileNav = [
  ['/home', 'Home'], ['/pool', 'Pools'], ['/money', 'My Money'], ['/orders', 'Orders'], ['/savings', 'Savings'],
]

function NotificationBellFallback() {
  return <Link href="/notifications" className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label="Notifications"><span aria-hidden="true" className="text-base">🔔</span></Link>
}

export function AppShell({ children, roles = new Set<AppRole>() }: { children: React.ReactNode; roles?: Set<AppRole> }) {
  const isSuperAdmin = roles.has('super_admin')
  const isAdmin = roles.has('admin') || isSuperAdmin

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-[linear-gradient(135deg,#f8fdff,#eaf8ff_50%,#f8fdff)] text-slate-950">
      <header className="app-shell-header sticky top-0 z-40 w-full px-3 pt-2 sm:px-5">
        <div className="app-shell-header-bar mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-[20px] border border-sky-200/80 bg-white/65 px-3 py-2 shadow-[inset_0_1px_0_white,0_10px_30px_rgba(14,165,233,.08)] backdrop-blur-xl sm:px-5">
          <Link href="/home" className="flex shrink-0 items-center gap-2.5" aria-label="2-TAKA-R-BAZAR home">
            <BrandLogo size={46} />
            <div className="hidden sm:block">
              <div className="text-sm font-black tracking-tight">2-TAKA-R-BAZAR</div>
              <div className="text-[10px] font-semibold tracking-wide text-slate-500">Smart Shopping. Real Savings.</div>
            </div>
          </Link>
          <div className="app-role-actions flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto text-[10px] sm:gap-2 sm:text-xs">
            <ThemeToggle className="shrink-0" />
            <Suspense fallback={<NotificationBellFallback />}><NotificationBell /></Suspense>
            {(roles.has('pickup_operator') || isSuperAdmin) && <Link className="app-role-link shrink-0 rounded-full border border-white bg-white/60 px-3 py-2 font-bold text-blue-700 shadow-sm" href="/pickup-ops" aria-label="Pickup Ops"><span aria-hidden="true">▣</span><span className="role-label">Pickup Ops</span></Link>}
            {isAdmin && <Link className="app-role-link shrink-0 rounded-full border border-white bg-white/60 px-3 py-2 font-bold text-blue-700 shadow-sm" href="/admin" aria-label="Operations"><span aria-hidden="true">⚙</span><span className="role-label">Operations</span></Link>}
            {isSuperAdmin && <Link className="app-role-link shrink-0 rounded-full border border-white bg-white/60 px-3 py-2 font-bold text-blue-700 shadow-sm" href="/super-admin" aria-label="Super Admin"><span aria-hidden="true">♛</span><span className="role-label">Super Admin</span></Link>}
            <Link href="/profile" aria-label="Profile" className="app-profile-link flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-white/70 text-lg shadow-sm">👤</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 overflow-x-hidden px-3 pb-24 pt-4 sm:px-5 sm:pb-8 sm:pt-5">{children}</main>

      <nav className="app-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-sky-100 bg-white/90 shadow-[0_-6px_20px_rgba(15,23,42,0.06)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 text-center text-[11px]">{mobileNav.map(([href,label])=><Link key={href} href={href} className="flex min-h-16 min-w-0 items-center justify-center px-1 py-3 font-bold text-slate-700 hover:bg-sky-50">{label}</Link>)}</div>
      </nav>

      <div className="app-mobile-legal border-t border-slate-800 bg-[#062747] px-3 pb-20 pt-4 text-xs text-slate-300 md:hidden">
        <nav className="mx-auto flex max-w-lg flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Legal and help">{LEGAL_LINKS.map(([href,label])=><Link key={href} href={href} className="hover:text-white">{label}</Link>)}</nav>
        <div className="mx-auto mt-3 max-w-lg text-center text-[11px] text-slate-400">
          © 2026 2-TAKA-R-BAZAR · Developed by: <a href="https://agentsiraji.com" target="_blank" rel="noreferrer" className="hover:text-white">agentsiraji.com</a> · Contact: <a href="mailto:business@agentsiraji.com" className="hover:text-white">business@agentsiraji.com</a>
        </div>
      </div>

      <footer className="app-desktop-footer hidden bg-[#062747] text-white md:block">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-6 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div><div className="flex items-center gap-3"><BrandLogo size={44} /><div><div className="font-black">2-TAKA-R-BAZAR</div><div className="text-xs text-slate-400">Smart Shopping. Real Savings.</div></div></div><p className="mt-3 max-w-sm text-xs leading-5 text-slate-400">Community-powered grocery pooling with transparent local price benchmarks, flexible pickup choices, and verified savings.</p></div>
          <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200">Shop</div><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">{customerNav.slice(0,5).map(([href,label])=><Link key={href} href={href} className="text-slate-300 hover:text-white">{label}</Link>)}</div></div>
          <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200">Account & community</div><div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">{customerNav.slice(5).map(([href,label])=><Link key={href} href={href} className="text-slate-300 hover:text-white">{label}</Link>)}</div></div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-[11px] text-slate-400">
            <div>
              <span>© 2026 2-TAKA-R-BAZAR · Developed by: </span>
              <a href="https://agentsiraji.com" target="_blank" rel="noreferrer" className="hover:text-white">agentsiraji.com</a>
              <span> · Contact: </span>
              <a href="mailto:business@agentsiraji.com" className="hover:text-white">business@agentsiraji.com</a>
            </div>
            <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legal and help">{LEGAL_LINKS.map(([href,label])=><Link key={href} href={href} className="hover:text-white">{label}</Link>)}</nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
