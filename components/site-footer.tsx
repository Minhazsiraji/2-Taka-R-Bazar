import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { LEGAL_LINKS } from '@/lib/legal'
import { SITE_TAGLINE_BN, SITE_TAGLINE_EN } from '@/lib/site'

export function SiteFooter({ withMobileNavOffset = false }: { withMobileNavOffset?: boolean }) {
  return (
    <footer className={`site-unified-footer mx-auto mt-6 w-[calc(100%-24px)] max-w-6xl rounded-[24px] text-slate-900 ${withMobileNavOffset ? 'mb-[calc(5.75rem+env(safe-area-inset-bottom))] md:mb-4' : 'mb-3'}`}>
      <div className="grid w-full gap-7 px-5 py-6 md:grid-cols-[minmax(230px,0.9fr)_minmax(0,1.6fr)] md:items-center md:px-7">
        <div className="flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <div className="font-black">2-TAKA-R-BAZAR</div>
            <div className="text-xs text-slate-500">{SITE_TAGLINE_EN}</div>
            <div className="mt-0.5 text-[11px] text-slate-500" lang="bn">{SITE_TAGLINE_BN}</div>
          </div>
        </div>

        <nav className="site-footer-links grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3" aria-label="Legal and help">
          {LEGAL_LINKS.map(([href,labelEn,labelBn])=>(
            <Link key={href} href={href} className="site-footer-link">
              <span className="site-footer-link-en">{labelEn}</span>
              <span className="site-footer-link-bn" lang="bn">{labelBn}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/40 px-5 py-3 text-center text-xs leading-5 text-slate-500 md:px-7">
        <span>© 2026 2-TAKA-R-BAZAR · Developed by: </span>
        <a href="https://agentsiraji.com" target="_blank" rel="noreferrer" className="hover:text-teal-700">agentsiraji.com</a>
        <span> · Contact: </span>
        <a href="mailto:business@agentsiraji.com" className="hover:text-teal-700">business@agentsiraji.com</a>
      </div>
    </footer>
  )
}
