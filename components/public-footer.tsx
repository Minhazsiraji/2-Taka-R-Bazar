import { SiteFooter } from '@/components/site-footer'
import {StorefrontFooter} from '@/components/storefront-footer'
import {MobileCustomerNav} from '@/components/mobile-customer-nav'

export function PublicFooter({storefront=false,language,shopBaseHref}:{storefront?:boolean;language?:import('@/lib/storefront-language').MarketplaceLanguage;shopBaseHref?:string}){
  return storefront?<StorefrontFooter language={language} shopBaseHref={shopBaseHref}/>:<><SiteFooter language={language} withMobileNavOffset/><MobileCustomerNav language={language}/></>
}
