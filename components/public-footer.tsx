import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { LEGAL_LINKS } from '@/lib/legal'

export function PublicFooter() {
  return (
    <footer className="public-glass-footer mx-auto mb-3 mt-6 w-[calc(100%-24px)] max-w-6xl rounded-[24px] text-slate-900">
      <div className="flex w-full flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={42} />
          <div><div className="font-black">2-TAKA-R-BAZAR</div><div className="text-xs text-slate-500">Smart Shopping. Real Savings.</div></div>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600" aria-label="Legal and help">
          {LEGAL_LINKS.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}
        </nav>
      </div>
      <div className="border-t border-white/40 px-5 py-3 text-center text-xs text-slate-500">
        <span>© 2026 2-TAKA-R-BAZAR · Developed by: </span>
        <a href="https://agentsiraji.com" target="_blank" rel="noreferrer" className="hover:text-teal-700">agentsiraji.com</a>
        <span> · Contact: </span>
        <a href="mailto:business@agentsiraji.com" className="hover:text-teal-700">business@agentsiraji.com</a>
      </div>
    </footer>
  )
}
