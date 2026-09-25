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

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 text-slate-950">
    <header className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div><Link href="/super-admin" className="font-black tracking-tight">2-TAKA-R-BAZAR · SUPER ADMIN</Link><p className="text-xs text-white/55">Owner command center · live operational data</p></div>
        <div className="flex gap-2 text-sm"><Link href="/admin" className="rounded-lg border border-white/20 px-3 py-2 font-bold">Operations</Link><Link href="/home" className="rounded-lg bg-white px-3 py-2 font-bold text-black">Customer app</Link></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-5 xl:grid-cols-[245px_1fr]">
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4">
        <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Executive</p>
        <nav className="grid gap-1">{executiveLinks.map(([href,label])=><Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">{label}</Link>)}</nav>
        <p className="mt-5 px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Operate the business</p>
        <nav className="grid gap-1">{operationsLinks.map(([href,label])=><Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">{label}</Link>)}</nav>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  </div>
}
