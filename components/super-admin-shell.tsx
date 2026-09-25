import Link from 'next/link'

const executiveLinks = [
  ['/super-admin', 'Executive dashboard'],
  ['/super-admin/payments', 'Payments & cash'],
  ['/super-admin/access', 'Users & access'],
  ['/super-admin/audit', 'Audit trail'],
]

const operationsLinks = [
  ['/admin', 'Operations dashboard'],
  ['/admin/communities', 'Communities'],
  ['/admin/customers', 'Customers'],
  ['/admin/products', 'Products'],
  ['/admin/market-prices', 'Market prices'],
  ['/admin/suppliers', 'Suppliers'],
  ['/admin/pools', 'Pools'],
  ['/admin/commitments', 'Commitments'],
  ['/admin/orders', 'Orders'],
  ['/admin/pickup-points', 'Pickup points'],
  ['/admin/savings', 'Savings'],
  ['/admin/feedback', 'Feedback'],
  ['/admin/issues', 'Issues'],
]

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const navClass = mobile ? 'grid grid-cols-2 gap-1 sm:grid-cols-3' : 'grid gap-1'
  const linkClass = mobile
    ? 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700'
    : 'rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100'

  return <>
    <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Executive</p>
    <nav className={navClass}>{executiveLinks.map(([href,label])=><Link key={href} href={href} className={`${linkClass} font-bold`}>{label}</Link>)}</nav>
    <p className="mt-5 px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Operate the business</p>
    <nav className={navClass}>{operationsLinks.map(([href,label])=><Link key={href} href={href} className={linkClass}>{label}</Link>)}</nav>
  </>
}

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 text-slate-950 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
        <Link href="/super-admin" className="flex min-w-0 items-center gap-3" aria-label="2-TAKA-R-BAZAR Super Admin">
          <img src="/brand-logo-header.png" alt="2-TAKA-R-BAZAR - Smart Shopping. Real Savings." className="h-14 w-auto shrink-0 object-contain sm:h-16" />
          <div className="hidden min-w-0 md:block"><p className="font-black tracking-tight">SUPER ADMIN</p><p className="text-xs text-slate-500">Owner command center · live operational data</p></div>
        </Link>
        <div className="flex shrink-0 gap-2 text-xs sm:text-sm">
          <Link href="/admin" className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-bold text-slate-900 sm:px-3">Operations</Link>
          <Link href="/home" className="rounded-lg bg-black px-2.5 py-2 font-bold text-white sm:px-3">Customer app</Link>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-4 sm:py-5">
      <details className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:hidden">
        <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-800">☰ Super Admin sections</summary>
        <div className="mt-4"><Navigation mobile /></div>
      </details>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-24 xl:block">
          <Navigation />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  </div>
}
