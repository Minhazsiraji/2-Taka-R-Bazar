import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { LEGAL_LINKS } from '@/lib/legal'

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={42} />
          <div><div className="font-black">2-TAKA-R-BAZAR</div><div className="text-xs text-slate-400">Smart Shopping. Real Savings.</div></div>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-300" aria-label="Legal and help">
          {LEGAL_LINKS.map(([href,label])=><Link key={href} href={href} className="hover:text-white">{label}</Link>)}
        </nav>
      </div>
      <div className="border-t border-slate-800 px-5 py-3 text-center text-xs text-slate-500">© 2026 2-TAKA-R-BAZAR · Community first · Transparent savings</div>
    </footer>
  )
}
