import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'

export function PublicHeader({ actionHref = '/login', actionLabel = 'Sign in' }: { actionHref?: string; actionLabel?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 border-b border-black/10 px-4 py-3 sm:px-5 sm:py-4 md:px-8">
      <Link href="/" className="flex min-w-0 shrink items-center gap-2.5" aria-label="2-TAKA-R-BAZAR home">
        <BrandLogo size={48} />
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-black tracking-tight">2-TAKA-R-BAZAR</div>
          <div className="truncate text-[10px] font-semibold tracking-wide text-slate-500">Smart Shopping. Real Savings.</div>
        </div>
      </Link>
      <Link href={actionHref} className="btn-secondary shrink-0 px-3 text-xs sm:px-4 sm:text-sm">{actionLabel}</Link>
    </header>
  )
}
