'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {chooseText,type MarketplaceLanguage} from '@/lib/storefront-language'

const nav = [
  ['/home', 'Home','হোম'],
  ['/pool', 'Pools','পুল'],
  ['/group-deals', 'Deals','ডিল'],
  ['/cart', 'Cart','কার্ট'],
  ['/account', 'Account','অ্যাকাউন্ট'],
] as const

export function MobileCustomerNav({language='en',homeHref='/'}:{language?:MarketplaceLanguage;homeHref?:string}){
  const pathname = usePathname()

  return <nav className="app-mobile-nav" aria-label="Mobile customer navigation">
    <div className="app-mobile-nav-inner">
      {nav.map(([route,label,bn])=>{
        const href=route==='/home'?homeHref:route
        const active = pathname === href || pathname.startsWith(href + '/')
        return <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={'app-mobile-nav-link' + (active ? ' is-active' : '')}
        >
          <span>{chooseText(language,label,bn)}</span>
        </Link>
      })}
    </div>
  </nav>
}
