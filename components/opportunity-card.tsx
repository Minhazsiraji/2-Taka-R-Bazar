import Link from 'next/link'

export function OpportunityCard({ title, href, count }: { title: string; href: string; count: number }) {
  const active = count > 0
  return <Link href={href} className="cx-opportunity-card" aria-label={`${title}: ${count} active. Click to open`}>
    <span className="cx-opportunity-heading"><strong>{title}</strong><span className="cx-count-badge">{count} Active</span></span>
    <span className="cx-opportunity-helper">Click to open</span>
    <span className="cx-opportunity-status"><span aria-hidden="true" className={'cx-signal' + (active ? ' is-live' : '')}/>{active ? 'Live now' : 'No live opportunity'}</span>
  </Link>
}
