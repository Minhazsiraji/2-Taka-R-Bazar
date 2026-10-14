import { SiteFooter } from '@/components/site-footer'
import {StorefrontFooter} from '@/components/storefront-footer'

export function PublicFooter({storefront=false,language}:{storefront?:boolean;language?:import('@/lib/storefront-language').MarketplaceLanguage}){
  return storefront?<StorefrontFooter language={language}/>:<SiteFooter language={language}/>
}
