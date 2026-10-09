import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { SITE_TAGLINE_BN, SITE_TAGLINE_EN } from '@/lib/site'

export function PublicHeader({ actionHref = '/login', actionLabel = 'Sign in' }: { actionHref?: string; actionLabel?: string }) {
  return (
    <header className="public-glass-header flex items-center justify-between gap-3">
      <Link href="/" className="flex min-w-0 shrink items-center gap-2.5" aria-label="2-TAKA-R-BAZAR home">
        <BrandLogo size={46} />
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-black tracking-tight">2-TAKA-R-BAZAR</div>
          <div className="truncate text-[10px] font-semibold tracking-wide text-slate-500">{SITE_TAGLINE_EN}</div>
          <div className="truncate text-[9px] font-medium text-slate-400" lang="bn">{SITE_TAGLINE_BN}</div>
        </div>
      </Link>
      <div className="public-header-actions flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <Link href={actionHref} className="public-header-action btn-secondary shrink-0 px-4 text-xs sm:px-5 sm:text-sm">{actionLabel}</Link>
      </div>
    </header>
  )
}
