import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {ShowcaseProductGallery} from '@/components/showcase-product-gallery'
import {SITE_NAME,SITE_URL} from '@/lib/site'
import type {ShowcaseProduct} from '@/lib/showcase-media'

export const dynamic='force-dynamic'

async function getProduct(id:string):Promise<ShowcaseProduct|null>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return null
  const supabase=await createClient()
  const {data,error}=await supabase.rpc('get_public_own_product_showcase',{p_product_id:id,p_featured_only:false})
  return error?null:((data?.[0]??null) as ShowcaseProduct|null)
}

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params
  const product=await getProduct(id)
  if(!product)return {title:'Product not found',robots:{index:false,follow:false}}
  const description=product.description||`Discover ${product.name} from ${SITE_NAME}. Pool prices depend on your community and must be confirmed before ordering.`
  return {title:product.name,description,alternates:{canonical:`${SITE_URL}/products/${id}`},
    openGraph:{title:`${product.name} | ${SITE_NAME}`,description,images:product.image_url?[product.image_url]:undefined}}
}

export default async function ProductDetailsPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params
  const product=await getProduct(id)
  if(!product)notFound()
  const images=[...new Set([product.image_url,...(product.gallery_urls??[])].filter((x):x is string=>Boolean(x)))]
  const schema={'@context':'https://schema.org','@type':'Product',name:product.name,description:product.description||undefined,brand:product.brand?{'@type':'Brand',name:product.brand}:undefined,
    image:images,category:product.category,sku:undefined,url:`${SITE_URL}/products/${product.product_id}`}
  return <main className="min-h-screen bg-white text-black">
    <PublicHeader actionHref="/login" actionLabel="Sign in"/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link href="/" className="underline">Home</Link><span>›</span><span>Exclusive products</span><span>›</span><span className="font-semibold">{product.name}</span></nav>
      <div className="grid gap-6 lg:grid-cols-2">
        <ShowcaseProductGallery name={product.name} images={images} videoUrl={product.video_url}/>
        <section className="showcase-detail-copy rounded-[28px] border border-black/10 p-6 sm:p-8">
          <p className="showcase-eyebrow">{product.source_type==='PRIVATE_LABEL'?'2-TAKA-R-BAZAR private label':product.source_type==='EXCLUSIVE_PARTNER'?'Exclusive partner product':'2-TAKA-R-BAZAR selection'}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">{[product.brand,product.category,product.package_size].filter(Boolean).join(' · ')}</p>
          <div className="mt-6 border-t border-black/10 pt-6"><h2 className="text-lg font-black">Product details</h2><p className="mt-3 whitespace-pre-line text-base leading-8 text-slate-600">{product.description||'More product information will be added soon.'}</p></div>
          {product.highlights?.length>0&&<div className="mt-6"><h2 className="font-black">Highlights</h2><ul className="mt-3 grid gap-3">{product.highlights.map((s,index)=><li key={index} className="flex items-start gap-3 text-sm leading-6 text-slate-600"><span className="text-teal-600" aria-hidden="true">✓</span><span>{s}</span></li>)}</ul></div>}
          <div className="mt-7 rounded-2xl border border-teal-200/50 bg-teal-50/50 p-4"><p className="font-bold">Transparent community pricing</p><p className="mt-1 text-sm leading-6 text-slate-600">This is a product showcase, not a confirmed order or price offer. Your relevant Pool or Group Deal will show its current price before you commit or confirm.</p><p className="mt-1 text-xs text-slate-500" lang="bn">আপনার কমিউনিটির পুলে মূল্য দেখে নিশ্চিত করুন।</p></div>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/signup" className="btn-primary">Join the community pool</Link><Link href="/login" className="btn-secondary">Sign in to see pools</Link></div>
        </section>
      </div>
      <div className="mt-8"><Link href="/" className="font-bold text-teal-700 underline">← Back to homepage</Link></div>
    </div>
    <PublicFooter/>
  </main>
}
