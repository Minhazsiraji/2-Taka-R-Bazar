'use client'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import type {ReactNode} from 'react'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'

export function CustomerShellClient({children,initialLanguage,hasLanguageCookie,operations,pickup,superAdmin}:{children:ReactNode;initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean;operations:boolean;pickup:boolean;superAdmin:boolean}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const router=useRouter()
 return <main className="public-marketplace-flat customer-page-shell min-h-screen">
  <PublicHeader storefront language={language} shopBaseHref="/" browseHref="/#deals"
   onLanguageChange={next=>{setLanguage(next);router.refresh()}}
   actionHref="/account" actionLabel={language==='bn'?'আমার ড্যাশবোর্ড':'My dashboard'}/>
  <div className="customer-page-content mx-auto w-full max-w-6xl min-w-0 px-3 py-5 sm:px-5">
   {(operations||pickup||superAdmin)&&<nav className="customer-staff-shortcuts mb-4 flex flex-wrap gap-2" aria-label="Staff tools">
    {pickup&&<Link className="app-role-link btn-secondary" href="/community-ops">Community Ops</Link>}
    {operations&&<Link className="app-role-link btn-secondary" href="/admin">Operations</Link>}
    {superAdmin&&<Link className="app-role-link btn-secondary" href="/super-admin">Super Admin</Link>}
   </nav>}
   {children}
  </div>
  <PublicFooter language={language}/>
 </main>
}
