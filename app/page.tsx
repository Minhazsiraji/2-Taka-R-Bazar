import type {Metadata} from 'next'
import {createClient} from '@/lib/supabase/server'
import {PublicHeader} from '@/components/public-header'
import {PublicFooter} from '@/components/public-footer'
import {PublicMarketplace} from '@/components/public-marketplace'
import {FeaturedProductsCarousel} from '@/components/featured-products-carousel'
import type {ShowcaseProduct} from '@/lib/showcase-media'
import type {StorefrontArea,StorefrontOffer} from '@/lib/storefront'
import {PUBLIC_CONTACT_EMAIL,SITE_DESCRIPTION,SITE_NAME,SITE_TAGLINE_EN,SITE_URL} from '@/lib/site'

export const dynamic='force-dynamic'
export const metadata:Metadata={
 title:{absolute:`${SITE_NAME} | ${SITE_TAGLINE_EN}`},
 description:SITE_DESCRIPTION,
 alternates:{canonical:SITE_URL},
}

export default async function Page(){
 const supabase=await createClient()
 const [claims,areasRes,offersRes,featuredRes]=await Promise.all([
  supabase.auth.getClaims(),
  supabase.rpc('get_public_storefront_areas'),
  supabase.rpc('get_public_storefront_offers',{p_community_id:null}),
  supabase.rpc('get_public_own_product_showcase',{p_product_id:null,p_featured_only:true}),
 ])
 const authenticated=Boolean(claims.data.claims?.sub)
 const areas=(areasRes.data??[]) as StorefrontArea[]
 const offers=(offersRes.data??[]) as StorefrontOffer[]
 const featured=(featuredRes.data??[]) as ShowcaseProduct[]
 const schema={
  '@context':'https://schema.org',
  '@graph':[
   {'@type':'Organization','@id':`${SITE_URL}/#organization`,name:SITE_NAME,url:SITE_URL,
    logo:`${SITE_URL}/brand-logo-header.png`,email:PUBLIC_CONTACT_EMAIL,slogan:SITE_TAGLINE_EN},
   {'@type':'WebSite','@id':`${SITE_URL}/#website`,name:SITE_NAME,url:SITE_URL,
    description:SITE_DESCRIPTION,publisher:{'@id':`${SITE_URL}/#organization`}},
   {'@type':'WebPage','@id':`${SITE_URL}/#webpage`,name:`${SITE_NAME} | ${SITE_TAGLINE_EN}`,
    url:SITE_URL,description:SITE_DESCRIPTION,inLanguage:['en-BD','bn-BD']},
  ],
 }
 return <main className="min-h-screen bg-white text-black">
  <PublicHeader actionHref={authenticated?'/home':'/login'} actionLabel={authenticated?'My dashboard':'Sign in'}/>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  <PublicMarketplace areas={areas} offers={offers} authenticated={authenticated}/>
  {featured.length>0&&<section className="mx-auto mb-10 max-w-6xl px-5 md:px-8">
   <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-teal-700">Our own & exclusive products</p><h2 className="mt-2 text-2xl font-black">Explore the 2-TAKA-R-BAZAR collection</h2></div>
   <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white"><FeaturedProductsCarousel products={featured}/></div>
  </section>}
  <PublicFooter/>
 </main>
}
