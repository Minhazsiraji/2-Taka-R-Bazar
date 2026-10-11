import { SiteFooter } from '@/components/site-footer'

export function PublicFooter({storefront=false}:{storefront?:boolean}){
  return <SiteFooter fullWidth={storefront}/>
}
