import type {Metadata} from 'next'
import {notFound,permanentRedirect} from 'next/navigation'
import {loadPublicProduct,productMeta} from '@/lib/product-seo-public'
import {PublicSeoProductPage} from '@/components/public-seo-product-page'

export const dynamic='force-dynamic'
type Props={params:Promise<{slug:string}>}
const LOCALE='bn' as const
const PREFIX='/bn'
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params
 const {product}=await loadPublicProduct(slug)
 return product?productMeta(product,LOCALE):{title:'Product unavailable',robots:{index:false,follow:false}}
}
export default async function Page({params}:Props){
 const {slug}=await params
 const {product,canonicalSlug}=await loadPublicProduct(slug)
 if(canonicalSlug)permanentRedirect(PREFIX+'/p/'+canonicalSlug)
 if(!product)notFound()
 return <PublicSeoProductPage product={product} locale={LOCALE}/>
}
