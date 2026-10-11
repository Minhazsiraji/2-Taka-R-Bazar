import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {ShowcaseProductGallery} from '@/components/showcase-product-gallery'
import {formatPrice} from '@/lib/storefront'
import type {StorefrontOffer} from '@/lib/storefront'
import type {ShowcaseProduct} from '@/lib/showcase-media'
import {SITE_NAME,SITE_URL} from '@/lib/site'

export const dynamic='force-dynamic'
type Params={params:Promise<{id:string}>;searchParams:Promise<{area?:string}>}
async function loadProductOffers(id:string){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))return null
 const supabase=await createClient()
 const [offersResponse,showcaseResponse,claimsResponse]=await Promise.all([
  supabase.rpc('get_public_storefront_offers',{p_community_id:null}),
  supabase.rpc('get_public_own_product_showcase',{p_product_id:id,p_featured_only:false}),
  supabase.auth.getClaims(),
 ])
 if(offersResponse.error)return null
 const matches=((offersResponse.data??[]) as StorefrontOffer[]).filter(o=>o.product_id===id)
 if(matches.length===0)return null
 return {matches,showcase:(showcaseResponse.data?.[0]??null) as ShowcaseProduct|null,authenticated:Boolean(claimsResponse.data?.claims?.sub)}
}
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const {id}=await params
 const product=await loadProductOffers(id)
 if(!product)return {title:'Product unavailable',robots:{index:false,follow:false}}
 const offer=product.matches[0]
 return {title:`${offer.product_name} | Local Offers`,
  description:`Explore ${offer.product_name} and verified community buying opportunities on ${SITE_NAME}. Login is only required to buy or join.`,
  alternates:{canonical:`${SITE_URL}/shop/${id}`},
  openGraph:{title:offer.product_name,images:offer.image_url?[offer.image_url]:undefined}}
}
export default async function PublicProductPage({params,searchParams}:Params){
 const [{id},query]=await Promise.all([params,searchParams])
 const product=await loadProductOffers(id)
 if(!product)notFound()
 const offers=[...product.matches].sort((a,b)=>Number(b.community_id===query.area)-Number(a.community_id===query.area))
 const item=offers[0]
 const video=product.showcase?.video_url??null
 const gallery=[...new Set([item.image_url,...(product.showcase?.gallery_urls??[])].filter((u):u is string=>Boolean(u)))]
 const schema={'@context':'https://schema.org','@type':'Product',name:item.product_name,
  brand:item.brand?{'@type':'Brand',name:item.brand}:undefined,
  image:gallery,category:item.category,url:`${SITE_URL}/shop/${id}`}
 return <main className="min-h-screen bg-white text-black">
  <PublicHeader actionHref={product.authenticated?'/home':'/login'} actionLabel={product.authenticated?'My dashboard':'Sign in'}/>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
  <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
   <nav aria-label="Breadcrumb" className="mb-6 text-sm font-semibold"><Link href="/" className="underline">Shop</Link> → {item.category} → {item.product_name}</nav>
   <div className="grid gap-6 lg:grid-cols-2">
    <ShowcaseProductGallery name={item.product_name} images={gallery} videoUrl={video}/>
    <section className="rounded-[28px] border border-black/10 bg-white p-5 sm:p-8">
     <p className="text-xs font-black uppercase tracking-wider text-teal-700">{item.category} · Local buying</p>
     <h1 className="mt-3 text-3xl font-black">{item.product_name}</h1>
     <p className="mt-2 text-sm text-slate-600">{[item.brand,item.package_size].filter(Boolean).join(' · ')}</p>
     {product.showcase?.description&&<p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">{product.showcase.description}</p>}
     {product.showcase?.highlights?.length>0&&<ul className="mt-5 list-inside list-disc text-sm leading-7">{product.showcase.highlights.map(x=><li key={x}>{x}</li>)}</ul>}
     <h2 className="mt-7 text-lg font-black">Choose how to buy</h2>
     <div className="mt-3 grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-black/10 p-4"><p className="text-sm font-black">Buy Alone</p><p className="mt-2 text-lg font-black">Price not published</p><p className="mt-1 text-xs text-slate-500">Individual orders will open after inventory and solo checkout verification.</p><button type="button" disabled className="mt-4 w-full cursor-not-allowed rounded-xl border p-3 text-xs font-black opacity-60">Buy Alone · Soon</button></div>
      <div className="rounded-2xl border border-teal-300 p-4"><p className="text-sm font-black text-teal-700">Group Buy</p><p className="mt-2 text-lg font-black text-teal-700">{formatPrice(item.confirmed_price??item.upcoming_price)}</p><p className="mt-1 text-xs text-slate-500">{item.confirmed_price?'Published/unlocked group price':'Potential price, not yet unlocked'}</p><Link href={product.authenticated?(item.offer_kind==='GROUP_DEAL'?'/group-deals':'/pool'):(item.offer_kind==='GROUP_DEAL'?'/login?next=%2Fgroup-deals':'/login?next=%2Fpool')} className="btn-primary mt-4 block text-center text-xs">{product.authenticated?'View & join':'Sign in to join'}</Link></div>
     </div>
     <p className="mt-4 text-sm text-slate-600">{item.buyer_count} qualified joined · {item.quantity_joined} requested units. The final amount will be confirmed inside your verified community.</p>
     <p className="mt-3 text-xs leading-6 text-slate-500">Delivery charges are separate from product savings. Free community pickup; optional within-community home delivery is ৳20 for baskets up to ৳1,000 and ৳30 above ৳1,000.</p>
    </section>
   </div>
   {offers.length>1&&<section className="mt-10"><h2 className="text-xl font-black">Available community buying opportunities</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{offers.map(o=><div key={o.offer_id+o.community_id} className="rounded-2xl border p-4"><b>{o.offer_title}</b><p className="mt-1 text-sm">{o.offer_kind==='GROUP_DEAL'?'Group Deal':'Community Pool'} · {formatPrice(o.confirmed_price??o.upcoming_price)} · {o.buyer_count} buyers</p></div>)}</div></section>}
  </div><PublicFooter/>
 </main>
}
