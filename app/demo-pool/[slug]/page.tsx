import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {demoStorefrontEnabled,DEMO_OFFERS} from '@/lib/public-demo-products'
import {getDemoFeaturedPools, type FeaturedPoolKind} from '@/lib/featured-pools'
import {DemoPoolDetail} from '@/components/demo-pool-detail'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Featured Pool demo | 2-TAKA-R-BAZAR',robots:{index:false,follow:false}}
export default async function DemoPoolPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params
 if(!demoStorefrontEnabled())notFound()
 const pool=getDemoFeaturedPools(DEMO_OFFERS).find(p=>p.slug===slug)
 if(!pool)notFound()
 return <DemoPoolDetail pool={pool}/>
}
