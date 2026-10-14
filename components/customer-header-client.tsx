'use client'
import {useRouter} from 'next/navigation'
import {PublicHeader} from '@/components/public-header'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'

export type CustomerHeaderProps={actionHref?:string;actionLabel?:string;mobileActionLabel?:string}
export function CustomerHeaderClient({initialLanguage,hasLanguageCookie,actionHref='/account',actionLabel='Account',mobileActionLabel}:CustomerHeaderProps&{initialLanguage:MarketplaceLanguage;hasLanguageCookie:boolean}){
 const [language,setLanguage]=useStorefrontLanguage(initialLanguage,hasLanguageCookie)
 const router=useRouter()
 return <PublicHeader storefront shopBaseHref="/" browseHref="/#deals" language={language}
  onLanguageChange={next=>{setLanguage(next);router.refresh()}}
  actionHref={actionHref} actionLabel={actionLabel} mobileActionLabel={mobileActionLabel}/>
}
