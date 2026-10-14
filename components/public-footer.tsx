'use client'
import {StorefrontFooter} from '@/components/storefront-footer'
import {useStorefrontLanguage} from '@/lib/use-storefront-language'
import type {MarketplaceLanguage} from '@/lib/storefront-language'

export function PublicFooter({language,initialLanguage='en',hasLanguageCookie=false,shopBaseHref='/'}:{storefront?:boolean;language?:MarketplaceLanguage;initialLanguage?:MarketplaceLanguage;hasLanguageCookie?:boolean;shopBaseHref?:string}){
  const [preferredLanguage]=useStorefrontLanguage(language??initialLanguage,hasLanguageCookie)
  return <StorefrontFooter language={language??preferredLanguage} shopBaseHref={shopBaseHref}/>
}
