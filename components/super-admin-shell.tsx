import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'

const executiveLinks = [['/super-admin','Executive dashboard'],['/super-admin/finance','Finance intelligence'],['/super-admin/treasury','Treasury & cash flow'],['/super-admin/money-analytics','My Money analytics'],['/super-admin/payments','Payments & cash'],['/super-admin/access','Users & access'],['/super-admin/audit','Audit trail']]
const operationsLinks = [['/admin','Operations dashboard'],['/admin/communities','Communities'],['/admin/customers','Customers'],['/admin/products','Products'],['/admin/market-prices','Market prices'],['/admin/suppliers','Suppliers'],['/admin/pools','Pools'],['/admin/commitments','Commitments'],['/admin/orders','Orders'],['/admin/deliveries','Home deliveries'],['/admin/pickup-points','Pickup points'],['/admin/savings','Savings'],['/admin/feedback','Feedback'],['/admin/issues','Issues']]

function Navigation({ mobile=false }:{mobile?:boolean}) {
  const navClass=mobile?'grid grid-cols-1 gap-1 min-[380px]:grid-cols-2 sm:grid-cols-3':'grid gap-1'
  const linkClass=mobile?'super-admin-nav-link min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 break-words':'super-admin-nav-link rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100'
  return <><p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Executive</p><nav className={navClass}>{executiveLinks.map(([href,label])=><Link key={href} href={href} className={`${linkClass} font-bold`}>{label}</Link>)}</nav><p className="mt-5 px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Operate the business</p><nav className={navClass}>{operationsLinks.map(([href,label])=><Link key={href} href={href} className={linkClass}>{label}</Link>)}</nav></>
}

export function SuperAdminShell({children}:{children:React.ReactNode}) {
  return <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100 text-slate-950">
    <header className="app-shell-header sticky top-0 z-50 w-full px-2 pt-2 sm:px-5">
      <div className="app-shell-header-bar mx-auto flex w-full max-w-6xl items-center justify-between gap-1.5 rounded-[20px] border border-sky-200/80 bg-white/65 px-2 py-2 shadow-[inset_0_1px_0_white,0_10px_30px_rgba(14,165,233,.08)] backdrop-blur-xl sm:gap-3 sm:px-5">
        <Link href="/super-admin" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label="2-TAKA-R-BAZAR Super Admin">
          <span className="sm:hidden"><BrandLogo size={36}/></span><span className="hidden sm:block"><BrandLogo size={46}/></span>
          <div className="hidden min-w-0 sm:block"><div className="text-sm font-black tracking-tight">SUPER ADMIN</div><div className="text-[10px] font-semibold tracking-wide text-slate-500">Owner command center · live operational data</div></div>
        </Link>
        <div className="app-role-actions flex min-w-0 flex-1 items-center justify-end gap-1 text-[10px] sm:gap-2 sm:text-xs">
          <ThemeToggle className="shrink-0 px-2 [&_.theme-toggle-label]:hidden min-[430px]:[&_.theme-toggle-label]:inline"/>
          <Link href="/admin" aria-label="Operations" title="Operations" className="app-role-link shrink-0 rounded-full border border-white bg-white/60 px-2.5 py-2 font-bold text-blue-700 shadow-sm sm:px-3"><span className="sm:hidden">Ops</span><span className="hidden sm:inline">Operations</span></Link>
          <Link href="/home" aria-label="Customer app" title="Customer app" className="btn-primary min-h-9 shrink-0 rounded-full px-2.5 py-2 sm:min-h-11 sm:px-3"><span className="sm:hidden">App</span><span className="hidden sm:inline">Customer app</span></Link>
        </div>
      </div>
    </header>
    <div className="mx-auto w-full max-w-6xl min-w-0 px-3 py-4 sm:px-5 sm:py-5">
      <details className="mb-4 w-full max-w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:hidden"><summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-800">☰ Super Admin sections</summary><div className="mt-4 min-w-0"><Navigation mobile/></div></details>
      <div className="grid w-full max-w-full min-w-0 gap-4 xl:grid-cols-[245px_minmax(0,1fr)]"><aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-20 xl:block"><Navigation/></aside><main className="w-full max-w-full min-w-0 overflow-x-hidden">{children}</main></div>
    </div>
  </div>
}
