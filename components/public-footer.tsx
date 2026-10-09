import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { LEGAL_LINKS } from '@/lib/legal'

export function PublicFooter() {
  return (
    <footer className="public-glass-footer mx-auto mb-3 mt-6 w-[calc(100%-24px)] max-w-6xl rounded-[24px] text-slate-900">
      <div className="grid w-full gap-6 px-5 py-6 sm:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.6fr)] sm:items-center">
        <div className="flex items-center gap-3">
          <BrandLogo size={42} />
          <div><div className="font-black">2-TAKA-R-BAZAR</div><div className="text-xs text-slate-500">Smart shopping. Real savings!</div><div className="mt-0.5 text-[11px] text-slate-500" lang="bn">একসাথে কিনি, কম দামে পাই!</div></div>
        </div>
        <nav className="grid grid-cols-2 gap-x-8 gap-y-5 text-xs font-semibold text-slate-600 sm:grid-cols-3" aria-label="Legal and help">
          {LEGAL_LINKS.map(([href,labelEn,labelBn])=><Link key={href} href={href} className="min-w-0 rounded-xl px-1 py-1 text-left leading-tight hover:text-slate-950"><div className="whitespace-normal">{labelEn}</div><div className="mt-1 text-[10px] font-medium leading-4 text-slate-500" lang="bn">{labelBn}</div></Link>)}
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
