'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useEffect,useRef,useState} from 'react'
import {signOut} from '@/app/actions/auth'
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
 shopBaseHref?:string;browseHref?:string;authenticated?:boolean
}
const shoppingLinks=[
 {href:'/#mobile-deals',label:'Group Deals',bn:'গ্রুপ ডিল'},
 {href:'/products',label:'Exclusive Products',bn:'এক্সক্লুসিভ পণ্য'},
 {href:'/pool',label:'Community Pools',bn:'কমিউনিটি পুল'},
 {href:'/#your-community',label:'Your community',bn:'আপনার এলাকা'},
 {href:'/about',label:'How it works',bn:'যেভাবে কাজ করে'},
 {href:'/faq',label:'FAQ',bn:'প্রশ্নোত্তর'},
] as const

export function PublicHeader({actionHref='/login',actionLabel='Sign in',storefront=false,
 searchValue='',onSearchChange,language='en',onLanguageChange,
 mobileActionLabel,authenticated}:HeaderProps){
 const t=(en:string,bn:string)=>chooseText(language,en,bn)
 const compactActionLabel=mobileActionLabel??(actionHref==='/account'?t('Account','অ্যাকাউন্ট'):actionHref==='/signup'?t('Sign up','নিবন্ধন'):actionHref==='/'?t('Home','হোম'):actionLabel)
 const actionCopy=<><span className="public-header-action-desktop" aria-hidden="true">{actionLabel}</span><span className="public-header-action-mobile" aria-hidden="true">{compactActionLabel}</span></>
 const [menuOpen,setMenuOpen]=useState(false)
 const pathname=usePathname()
 const [signedIn,setSignedIn]=useState(authenticated??false)
 const accountRef=useRef<HTMLDetailsElement>(null)
 useEffect(()=>{
  if(authenticated!==undefined){setSignedIn(authenticated);return}
  const controller=new AbortController()
  fetch('/api/notifications/status',{cache:'no-store',signal:controller.signal})
   .then(response=>response.ok?response.json():null)
   .then(status=>{if(status&&!controller.signal.aborted)setSignedIn(status.authenticated===true)})
   .catch(()=>{})
  return()=>controller.abort()
 },[authenticated,pathname])
 useEffect(()=>{setMenuOpen(false);accountRef.current?.removeAttribute('open')},[pathname])
 if(storefront)return <header className="public-glass-header market-flat-header" lang={language} aria-label="2-TAKA-R-BAZAR public shop header">
  <div className="market-header-inner">
   <Link href="/" className="market-brand-lockup" aria-label="2-TAKA-R-BAZAR home">
    <BrandLogo size={46}/>
    <span className="market-brand-copy">
     <strong>2-TAKA-R-BAZAR</strong>
     <small>{SITE_TAGLINE_EN}</small>
     <small lang="bn">{SITE_TAGLINE_BN}</small>
    </span>
   </Link>
   <form className="market-header-search" action="/" role="search" onSubmit={onSearchChange?e=>{e.preventDefault();document.getElementById('mobile-deals')?.scrollIntoView({behavior:'smooth',block:'start'})}:undefined}>
    <label htmlFor="market-header-product-search" className="sr-only">{t('Search groceries and products','পণ্য ও বাজার খুঁজুন')}</label>
    <span aria-hidden="true" className="market-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></span>
    <input id="market-header-product-search" name="q" type="search"
     {...(onSearchChange?{value:searchValue,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onSearchChange(e.target.value)}:{defaultValue:''})}
     placeholder={t('Search rice, oil, groceries…','চাল, ডাল, তেল, বাজার খুঁজুন…')} autoComplete="off" enterKeyHint="search"/>
    <button className="public-search-submit" type="submit" aria-label={t('Search','খুঁজুন')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button>
   </form>
   <div className="market-header-actions">
    <Link href="/cart" className="market-header-quick-link market-header-quick-cart" aria-label={t('Cart','কার্ট')} title={t('Cart','কার্ট')}>
     <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h3l2.5 12h12l2.5-9H6M8 21h.01M18 21h.01"/></svg>
     <span>{t('Cart','কার্ট')}</span>
    </Link>
    <div className="market-language-toggle" role="group" aria-label="Language / ভাষা">
     <button type="button" className="market-single-language" onClick={()=>onLanguageChange?.(language==='bn'?'en':'bn')}
      aria-label={language==='bn'?'Switch to English':'বাংলায় পরিবর্তন করুন'}
      title={language==='bn'?'Switch to English':'বাংলায় পরিবর্তন করুন'}>{language==='bn'?'EN':'BAN'}</button>
    </div>
    <ThemeToggle/>
    <NotificationBell/>
    <details className="public-account-menu" ref={accountRef} onKeyDown={e=>{if(e.key==='Escape')accountRef.current?.removeAttribute('open')}}>
     <summary className="public-account-trigger" aria-label={t('Account menu','অ্যাকাউন্ট মেনু')} title={t('Account','অ্যাকাউন্ট')}><HeaderActionIcon kind="profile"/></summary>
     <nav className="public-account-panel" aria-label={t('Account navigation','অ্যাকাউন্ট নেভিগেশন')}>
      {signedIn?<>
       <Link href="/account">{t('My Account','আমার অ্যাকাউন্ট')}</Link>
       <Link href="/account/orders">{t('My Orders','আমার অর্ডার')}</Link>
       <Link href="/money">{t('My Money','আমার টাকা')}</Link>
       <Link href="/account/savings">{t('My Savings','আমার সাশ্রয়')}</Link>
       <Link href="/profile">{t('Settings','সেটিংস')}</Link>
       <form action={signOut}><button type="submit">{t('Sign out','সাইন আউট')}</button></form>
      </>:<>
       <Link href="/login">{t('Sign in','সাইন ইন')}</Link>
       <Link href="/signup">{t('Sign up','নিবন্ধন')}</Link>
      </>}
     </nav>
    </details>
    <button type="button" className="market-mobile-menu-button" aria-expanded={menuOpen} aria-controls="market-mobile-navigation"
     aria-label={menuOpen?t('Close menu','মেনু বন্ধ করুন'):t('Open menu','মেনু খুলুন')}
     onClick={()=>setMenuOpen(open=>!open)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d={menuOpen?'m6 6 12 12M6 18 18 6':'M4 6h16M4 12h16M4 18h16'}/></svg></button>
   </div>
  </div>
  {pathname==='/login'&&<Link href="/signup" className="public-login-join">{t('Join the pool','পুলে যোগ দিন')}</Link>}
  {menuOpen&&<nav id="market-mobile-navigation" className="market-mobile-nav-panel"
    aria-label={t('Mobile navigation','মোবাইল মেনু')} onKeyDown={e=>{if(e.key==='Escape')setMenuOpen(false)}}>
   {shoppingLinks.map(item=><Link key={item.href} href={item.href} onClick={()=>setMenuOpen(false)}>{t(item.label,item.bn)} <span aria-hidden="true">↗</span></Link>)}
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
