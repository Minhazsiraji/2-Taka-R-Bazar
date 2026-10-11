import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {DEMO_OFFERS,demoStorefrontEnabled} from '@/lib/public-demo-products'
import {DemoProductDetails} from '@/components/demo-product-details'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Demo product · 2-TAKA-R-BAZAR',robots:{index:false,follow:false}}
export default async function DemoProductPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!demoStorefrontEnabled())notFound()
 const offer=DEMO_OFFERS.find(p=>p.product_id===id)
 if(!offer)notFound()
 return <DemoProductDetails offer={offer}/>
}
