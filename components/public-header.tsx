'use client'

import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { SITE_TAGLINE_BN, SITE_TAGLINE_EN } from '@/lib/site'

type HeaderProps={
 actionHref?:string;actionLabel?:string;storefront?:boolean
 searchValue?:string;onSearchChange?:(value:string)=>void
 onLocationClick?:()=>void;locating?:boolean;locationLabel?:string
}
const storefrontNav=[
 {href:'#deals',label:'Group Deals'},
 {href:'#exclusive-products',label:'Our Products'},
 {href:'#popular-nearby',label:'Popular Nearby'},
 {href:'#how-it-works',label:'How It Works'},
 {href:'#our-communities',label:'Our Areas'},
 {href:'#customer-experiences',label:'Reviews'},
 {href:'#marketplace-faq',label:'FAQ'},
] as const

export function PublicHeader({actionHref='/login',actionLabel='Sign in',storefront=false,
 searchValue='',onSearchChange,onLocationClick,locating=false,locationLabel='Find my community'}:HeaderProps){
 if(storefront)return <header className="public-glass-header market-flat-header" aria-label="2-TAKA-R-BAZAR public shop header">
  <div className="market-header-inner">
   <Link href="/" className="market-brand-lockup" aria-label="2-TAKA-R-BAZAR home">
    <BrandLogo size={46}/>
    <span className="market-brand-copy">
     <strong>2-TAKA-R-BAZAR</strong>
     <small>{SITE_TAGLINE_EN}</small>
     <small lang="bn">{SITE_TAGLINE_BN}</small>
    </span>
   </Link>
   <div className="market-header-search">
    <label htmlFor="market-header-product-search" className="sr-only">Search groceries and products</label>
    <span aria-hidden="true" className="market-search-icon">⌕</span>
    <input id="market-header-product-search" type="search" value={searchValue}
     onChange={e=>onSearchChange?.(e.target.value)}
     onKeyDown={e=>{if(e.key==='Enter')document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'})}}
     placeholder="Search rice, oil, groceries…" autoComplete="off" enterKeyHint="search"/>
   </div>
   <div className="market-header-actions">
    <button type="button" onClick={onLocationClick} disabled={locating} className="market-header-location" aria-label="Find communities near my location">
     <span aria-hidden="true">📍</span><span className="market-header-location-text">{locating?'Finding area…':locationLabel}</span>
    </button>
    <ThemeToggle/>
    <Link href={actionHref} className="public-header-action btn-secondary">{actionLabel}</Link>
   </div>
  </div>
  <nav className="market-header-nav" aria-label="Shop and information">
   <div className="market-header-nav-inner">
    {storefrontNav.map(item=><a key={item.href} href={item.href}>{item.label}</a>)}
    <Link href="/signup" className="market-header-join">Join Community</Link>
   </div>
  </nav>
 </header>
 return <header className="public-glass-header flex items-center justify-between gap-3">
  <Link href="/" className="flex min-w-0 shrink items-center gap-2.5" aria-label="2-TAKA-R-BAZAR home">
   <BrandLogo size={46}/>
   <div className="hidden min-w-0 sm:block">
    <div className="truncate text-sm font-black tracking-tight">2-TAKA-R-BAZAR</div>
    <div className="truncate text-[10px] font-semibold tracking-wide text-slate-500">{SITE_TAGLINE_EN}</div>
    <div className="truncate text-[9px] font-medium text-slate-400" lang="bn">{SITE_TAGLINE_BN}</div>
   </div>
  </Link>
  <div className="public-header-actions flex shrink-0 items-center gap-2">
   <ThemeToggle/>
   <Link href={actionHref} className="public-header-action btn-secondary shrink-0 px-4 text-xs sm:px-5 sm:text-sm">{actionLabel}</Link>
  </div>
 </header>
}
