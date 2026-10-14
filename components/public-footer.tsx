import { SiteFooter } from '@/components/site-footer'
import {StorefrontFooter} from '@/components/storefront-footer'

export function PublicFooter({storefront=false,language,shopBaseHref,activeHref}:{storefront?:boolean;language?:import('@/lib/storefront-language').MarketplaceLanguage;shopBaseHref?:string;activeHref?:string}){
  return storefront?<StorefrontFooter language={language} shopBaseHref={shopBaseHref} activeHref={activeHref}/>:<SiteFooter language={language}/>
}
