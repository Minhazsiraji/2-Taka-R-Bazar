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

const storefrontLinks=[
  ['/','Home','হোম','home'],
  ['/pool','Pools','পুল','pool'],
  ['/group-deals','Deals','ডিল','deal'],
  ['/#mobile-exclusive','Exclusive','এক্সক্লুসিভ','exclusive'],
  ['/cart','Cart','কার্ট','cart'],
] as const

function DockIcon({kind}:{kind:'home'|'pool'|'deal'|'exclusive'|'cart'}){
 const shape={
  home:<><path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z"/></>,
  pool:<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M15 16a4 4 0 0 1 7 3v2"/></>,
  deal:<><path d="M20 13 12 21 2 11V3h8z"/><circle cx="7" cy="8" r="1"/></>,
  exclusive:<><path d="M4 9h16l-2 12H6zM2 9l4-6h12l4 6M9 9V6m6 3V6"/></>,
  cart:<><path d="M2 4h3l2.5 12h12l2.5-9H6M8 21h.01M18 21h.01"/></>
 }[kind]
 return <svg className="mhome-dock-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{shape}</svg>
}

export function MobileCustomerNav({language='en',homeHref='/',storefront=false}:{language?:MarketplaceLanguage;homeHref?:string;storefront?:boolean}){
  const pathname = usePathname()

  return <nav className={'app-mobile-nav'+(storefront?' market-storefront-dock':'')} aria-label={chooseText(language,'Mobile customer navigation','মোবাইল কেনাকাটার নেভিগেশন')} lang={language}>
    <div className="app-mobile-nav-inner">
      {(storefront&&pathname==='/'?storefrontLinks:nav).map(([route,label,bn])=>{
        const href=route==='/home'?homeHref:route
        const active = pathname === href || pathname.startsWith(href + '/')
        return <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={'app-mobile-nav-link' + (active ? ' is-active' : '')}
        >
          {storefront&&pathname==='/'&&<DockIcon kind={route==='/'?'home':route==='/pool'?'pool':route==='/group-deals'?'deal':route==='/cart'?'cart':'exclusive'}/>}
          <span>{chooseText(language,label,bn)}</span>
        </Link>
      })}
    </div>
  </nav>
}
