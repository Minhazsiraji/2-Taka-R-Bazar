import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {CustomerHeader} from '@/components/customer-header'
import {CustomerFooter} from '@/components/customer-footer'
import {ShowcaseProductGallery} from '@/components/showcase-product-gallery'
import {SITE_NAME,SITE_URL} from '@/lib/site'
import type {PublicVendorBookingProduct} from '@/lib/public-vendor-booking'

export const dynamic='force-dynamic'
const valid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
async function findProduct(id:string):Promise<PublicVendorBookingProduct|null>{
 if(!valid(id))return null
 const db=await createClient()
 const {data,error}=await db.rpc('get_public_pilot_vendor_catalog',{p_product_id:id})
 return error?null:((data?.[0]??null) as PublicVendorBookingProduct|null)
}
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const {id}=await params
 const product=await findProduct(id)
 if(!product)return {title:'Product unavailable',robots:{index:false,follow:false}}
 return {title:product.name,description:`${product.name}, ${product.package_size}. Vendor-fulfilled by 2TBR. Place a booking request; price and next-day supplier handover are subject to staff confirmation.`,
  alternates:{canonical:`${SITE_URL}/vendor-products/${id}`}}
}
export default async function VendorBookingProductPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 const product=await findProduct(id)
 if(!product)notFound()
 const price=Number(product.approved_unit_price)
 return <main className="public-marketplace-flat customer-page-shell min-h-screen bg-white text-black">
  <CustomerHeader actionHref="/login" actionLabel="Sign in"/>
  <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
   <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm text-slate-500">
    <Link href="/" className="underline">Home</Link><span>›</span>
    <Link href="/products" className="underline">Our products</Link><span>›</span><span>{product.name}</span>
   </nav>
   <div className="grid gap-6 lg:grid-cols-2">
    <ShowcaseProductGallery name={product.name} images={product.image_url?[product.image_url]:[]} videoUrl={null}/>
    <section className="showcase-detail-copy rounded-[28px] border border-black/10 p-6 sm:p-8">
     <p className="showcase-eyebrow">2TBR selection · Vendor fulfilled</p>
     <h1 className="mt-3 text-3xl font-black sm:text-4xl">{product.name}</h1>
     <p className="mt-2 text-sm font-semibold text-slate-500">{product.category} · {product.package_size}</p>
     <div className="mt-6 border-t border-black/10 pt-5">
      <h2 className="text-lg font-black">Proposed customer price</h2>
      <p className="mt-2 text-3xl font-black">৳{price.toLocaleString('en-BD')}</p>
      <p className="mt-2 text-sm text-slate-600">This is the current owner-approved listing price per package. Final product price, supply availability and pickup/delivery fees require staff confirmation before payment.</p>
     </div>
     <div className="mt-6 rounded-2xl border border-teal-200/50 bg-teal-50/50 p-4">
      <h2 className="font-black">Daily on-demand supplier fulfillment</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Supplier: {product.supplier_name}. Expected supplier handover: next day after order acceptance, subject to confirmation. This is not warehouse stock or a guaranteed customer delivery deadline.</p>
      <p className="mt-2 text-sm leading-6 text-slate-600" lang="bn">অর্ডার অনুরোধ পাঠালে আমাদের টিম পণ্য, মূল্য ও ডেলিভারি নিশ্চিত করবে। পেমেন্ট করার আগে নিশ্চিতকরণের অপেক্ষা করুন।</p>
     </div>
     <div className="mt-6 flex flex-wrap gap-3">
      <Link className="btn-primary" href={'/pilot-book?product='+product.product_id}>Request booking / বুকিং করুন</Link>
      <Link className="btn-secondary" href="/">Continue shopping</Link>
     </div>
     <p className="mt-3 text-sm text-slate-600">Booking is not an automatic order or payment. Authorized 2TBR staff review the request and confirm the final amount before customer payment instructions appear.</p>
    </section>
   </div>
  </div>
  <CustomerFooter/>
 </main>
}
