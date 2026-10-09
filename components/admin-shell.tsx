import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'

const links = [['/admin','Dashboard'],['/admin/notifications','Notifications'],['/admin/communities','Communities'],['/admin/customers','Customers'],['/admin/products','Products'],['/admin/own-products','2-TAKA-R-BAZAR Products'],['/admin/market-prices','Market prices'],['/admin/suppliers','Suppliers'],['/admin/supply-control','Supply Control'],['/admin/treasury','Treasury requests'],['/admin/group-deals','Group Deals'],['/admin/pools','Pools'],['/admin/commitments','Commitments'],['/admin/orders','Orders'],['/admin/deliveries','Home deliveries'],['/admin/community-ops','Community Ops'],['/admin/pickup-points','Pickup points'],['/admin/savings','Savings'],['/admin/feedback','Feedback'],['/admin/issues','Issues']]

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
    <header className="app-shell-header sticky top-0 z-40 w-full px-3 pt-2 sm:px-5">
      <div className="app-shell-header-bar mx-auto flex w-full max-w-6xl items-center justify-between gap-2 rounded-[20px] border border-sky-200/80 bg-white/65 px-2.5 py-2 shadow-[inset_0_1px_0_white,0_10px_30px_rgba(14,165,233,.08)] backdrop-blur-xl sm:gap-3 sm:px-5">
        <Link href="/admin" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label="2-TAKA-R-BAZAR Operations"><BrandLogo size={42}/><div className="hidden min-w-0 sm:block"><div className="text-sm font-black tracking-tight">OPERATIONS</div><div className="text-[10px] font-semibold tracking-wide text-slate-500">Business operations dashboard</div></div></Link>
        <div className="app-role-actions flex min-w-0 flex-1 items-center justify-end gap-1 text-[10px] sm:gap-2 sm:text-xs"><ThemeToggle className="shrink-0"/><Link href="/super-admin" aria-label="Executive" title="Executive" className="app-role-link flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white bg-white/60 p-0 font-bold text-blue-700 shadow-sm sm:h-auto sm:w-auto sm:px-3 sm:py-2"><span className="sm:hidden">♛</span><span className="hidden sm:inline">Executive</span></Link><Link href="/home" className="btn-primary shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[10px] sm:text-xs">Customer app</Link></div>
      </div>
    </header>
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:grid-cols-[250px_minmax(0,1fr)]"><aside className="card h-fit max-w-full overflow-x-auto lg:sticky lg:top-20"><nav className="flex gap-2 lg:grid">{links.map(([href,label])=><Link className="chip shrink-0 whitespace-nowrap lg:w-full lg:justify-start lg:whitespace-normal lg:break-words lg:leading-tight" href={href} key={href}>{label}</Link>)}</nav></aside><main className="w-full max-w-full min-w-0 overflow-x-hidden">{children}</main></div>
  </div>
}
