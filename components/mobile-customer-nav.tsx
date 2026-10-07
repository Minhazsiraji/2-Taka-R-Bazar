'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  ['/home', 'Home'],
  ['/pool', 'Pools'],
  ['/group-deals', 'Deals'],
  ['/orders', 'Orders'],
  ['/savings', 'Savings'],
] as const

export function MobileCustomerNav(){
  const pathname = usePathname()

  return <nav className="app-mobile-nav" aria-label="Mobile customer navigation">
    <div className="app-mobile-nav-inner">
      {nav.map(([href,label])=>{
        const active = pathname === href || pathname.startsWith(href + '/')
        return <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={'app-mobile-nav-link' + (active ? ' is-active' : '')}
        >
          <span>{label}</span>
        </Link>
      })}
    </div>
  </nav>
}
