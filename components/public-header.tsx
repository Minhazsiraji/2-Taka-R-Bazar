'use client'

import Link from 'next/link'
import {useState} from 'react'
import { BrandLogo } from '@/components/brand-logo'
import { NotificationBell } from '@/components/notification-bell'
import { HeaderActionIcon } from '@/components/header-action-icon'
import { ThemeToggle } from '@/components/theme-toggle'
import { SITE_TAGLINE_BN, SITE_TAGLINE_EN } from '@/lib/site'
import type {MarketplaceLanguage} from '@/lib/storefront-language'
import {chooseText} from '@/lib/storefront-language'

type HeaderProps={
 actionHref?:string;actionLabel?:string;mobileActionLabel?:string;storefront?:boolean
 searchValue?:string;onSearchChange?:(value:string)=>void
 language?:MarketplaceLanguage;onLanguageChange?:(language:MarketplaceLanguage)=>void
 shopBaseHref?:string;browseHref?:string
}
const storefrontNav=[
 {href:'#deals',label:'Group Deals',bn:'গ্রুপ ডিল'},
 {href:'#exclusive-products',label:'Our Products',bn:'আমাদের পণ্য'},
 {href:'#popular-nearby',label:'Popular Nearby',bn:'জনপ্রিয়'},
 {href:'#how-it-works',label:'How It Works',bn:'যেভাবে কাজ করে'},
 {href:'#our-communities',label:'Our Areas',bn:'এলাকা'},
 {href:'#customer-experiences',label:'Reviews',bn:'মতামত'},
 {href:'/cart',label:'Cart',bn:'কার্ট'},
] as const

export function PublicHeader({actionHref='/login',actionLabel='Sign in',storefront=false,
 searchValue='',onSearchChange,language='en',onLanguageChange,
 shopBaseHref='',browseHref,mobileActionLabel}:HeaderProps){
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const compactActionLabel=mobileActionLabel??(actionHref==='/account'?t('Account','অ্যাকাউন্ট'):actionHref==='/signup'?t('Sign up','নিবন্ধন'):actionHref==='/'?t('Home','হোম'):actionLabel)
 const actionCopy=<><span className="public-header-action-desktop" aria-hidden="true">{actionLabel}</span><span className="public-header-action-mobile" aria-hidden="true">{compactActionLabel}</span></>
 const shopHref=(href:string)=>href.startsWith('#')?shopBaseHref+href:href
 const [menuOpen,setMenuOpen]=useState(false)
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
    {!browseHref&&<label htmlFor="market-header-product-search" className="sr-only">{t('Search groceries and products','পণ্য ও বাজার খুঁজুন')}</label>}
    <span aria-hidden="true" className="market-search-icon">⌕</span>
    {browseHref?<Link href={browseHref} className="market-header-browse">{t('Browse groceries and products','পণ্য ও বাজার দেখুন')}</Link>:<input id="market-header-product-search" type="search" value={searchValue}
     onChange={e=>onSearchChange?.(e.target.value)}
     onKeyDown={e=>{if(e.key==='Enter')document.getElementById('deals')?.scrollIntoView({behavior:'smooth',block:'start'})}}
     placeholder={t('Search rice, oil, groceries…','চাল, ডাল, তেল, বাজার খুঁজুন…')} autoComplete="off" enterKeyHint="search"/>}
   </div>
   <div className="market-header-actions">
    <div className="market-language-toggle" role="group" aria-label="Language / ভাষা">
     <button type="button" className="market-single-language" onClick={()=>onLanguageChange?.(language==='bn'?'en':'bn')}
      aria-label={language==='bn'?'Switch to English':'বাংলায় পরিবর্তন করুন'}
      title={language==='bn'?'Switch to English':'বাংলায় পরিবর্তন করুন'}>{language==='bn'?'EN':'BAN'}</button>
    </div>
    <ThemeToggle/>
    <NotificationBell/>
    <Link href={actionHref} className="public-header-action market-header-account btn-secondary" aria-label={actionLabel} title={actionLabel}><span className="market-header-account-icon"><HeaderActionIcon kind="profile"/></span><span className="market-header-account-copy">{actionCopy}</span></Link>
    <button type="button" className="market-mobile-menu-button" aria-expanded={menuOpen} aria-controls="market-mobile-navigation"
     aria-label={menuOpen?t('Close menu','মেনু বন্ধ করুন'):t('Open menu','মেনু খুলুন')}
     onClick={()=>setMenuOpen(open=>!open)}><span aria-hidden="true">{menuOpen?'✕':'☰'}</span></button>
   </div>
  </div>
  <nav className="market-header-nav market-desktop-nav" aria-label={t('Shop and information','দোকান ও তথ্য')}>
   <div className="market-header-nav-inner">
    {storefrontNav.map(item=><a key={item.href} href={shopHref(item.href)}>{t(item.label,item.bn)}</a>)}
    <Link href="/signup" className="market-header-join">{t('Join Community','কমিউনিটিতে যোগ দিন')}</Link>
   </div>
  </nav>
  {menuOpen&&<nav id="market-mobile-navigation" className="market-mobile-nav-panel"
    aria-label={t('Mobile navigation','মোবাইল মেনু')} onKeyDown={e=>{if(e.key==='Escape')setMenuOpen(false)}}>
   {storefrontNav.map(item=><a key={item.href} href={shopHref(item.href)} onClick={()=>setMenuOpen(false)}>{t(item.label,item.bn)} <span aria-hidden="true">↗</span></a>)}
   <Link href="/signup" onClick={()=>setMenuOpen(false)}>{t('Join Community','কমিউনিটিতে যোগ দিন')} <span aria-hidden="true">↗</span></Link>
  </nav>}
 </header>
 return <header className="public-glass-header public-compact-header flex items-center justify-between gap-3">
  <Link href="/" className="public-header-brand flex min-w-0 shrink items-center gap-2.5" aria-label="2-TAKA-R-BAZAR home">
   <BrandLogo size={46}/>
   <div className="public-header-brand-copy hidden min-w-0 sm:block">
    <div className="truncate text-sm font-black tracking-tight">2-TAKA-R-BAZAR</div>
    <div className="truncate text-[10px] font-semibold tracking-wide text-slate-500">{SITE_TAGLINE_EN}</div>
    <div className="truncate text-[9px] font-medium text-slate-400" lang="bn">{SITE_TAGLINE_BN}</div>
   </div>
  </Link>
  <div className="public-header-actions flex shrink-0 items-center gap-2">
   {onLanguageChange&&<button type="button" className="public-header-language" onClick={()=>onLanguageChange(language==='bn'?'en':'bn')} aria-label={language==='bn'?'Switch to English':'বাংলায় পরিবর্তন করুন'}>{language==='bn'?'EN':'BAN'}</button>}
   <ThemeToggle/>
   <NotificationBell/>
   <Link href={actionHref} className="public-header-action btn-secondary shrink-0 px-4 text-xs sm:px-5 sm:text-sm" aria-label={actionLabel}>{actionCopy}</Link>
  </div>
 </header>
}
