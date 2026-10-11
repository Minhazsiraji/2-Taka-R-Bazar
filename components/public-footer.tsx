import { SiteFooter } from '@/components/site-footer'

export function PublicFooter({storefront=false,language}:{storefront?:boolean;language?:import('@/lib/storefront-language').MarketplaceLanguage}){
  return <SiteFooter fullWidth={storefront} language={language}/>
}
