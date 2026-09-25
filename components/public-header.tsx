import Link from 'next/link'

export function PublicHeader({ actionHref = '/login', actionLabel = 'Sign in' }: { actionHref?: string; actionLabel?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-b border-black/10 px-5 py-4 md:px-8">
      <Link href="/" className="min-w-0" aria-label="2-TAKA-R-BAZAR home">
        <img src="/brand-logo.webp" alt="2-TAKA-R-BAZAR" className="h-11 w-auto max-w-[210px] object-contain sm:h-12 sm:max-w-[245px]" />
      </Link>
      <Link href={actionHref} className="btn-secondary shrink-0">{actionLabel}</Link>
    </header>
  )
}
