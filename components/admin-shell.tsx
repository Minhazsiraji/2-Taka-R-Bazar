import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'

const links = [['/admin','Dashboard'],['/admin/communities','Communities'],['/admin/customers','Customers'],['/admin/products','Products'],['/admin/market-prices','Market prices'],['/admin/suppliers','Suppliers'],['/admin/pools','Pools'],['/admin/commitments','Commitments'],['/admin/orders','Orders'],['/admin/pickup-points','Pickup points'],['/admin/savings','Savings'],['/admin/feedback','Feedback'],['/admin/issues','Issues']]

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Link href="/admin" className="flex shrink-0 items-center gap-2"><BrandLogo size={56}/><span className="hidden font-black lg:inline">OPERATIONS</span></Link>
        <div className="flex min-w-0 items-center justify-end gap-1 text-[10px] font-bold sm:gap-3 sm:text-sm"><Link href="/super-admin" className="shrink-0 rounded-lg border border-slate-300 px-2 py-2 text-slate-900 sm:px-2.5">Executive</Link><Link href="/home" className="shrink-0 rounded-lg bg-black px-2 py-2 text-white sm:px-2.5">Customer app</Link></div>
      </div>
    </header>
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-5">
      <aside className="card h-fit max-w-full overflow-x-auto lg:sticky lg:top-20"><nav className="flex gap-2 lg:grid">{links.map(([href,label])=><Link className="chip shrink-0 whitespace-nowrap lg:justify-start" href={href} key={href}>{label}</Link>)}</nav></aside>
      <main className="w-full max-w-full min-w-0 overflow-x-hidden">{children}</main>
    </div>
  </div>
}
