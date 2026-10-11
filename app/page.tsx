import type {Metadata} from 'next'
import {createClient} from '@/lib/supabase/server'
import {PublicFooter} from '@/components/public-footer'
import {PublicMarketplace} from '@/components/public-marketplace'
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
 const authenticated=Boolean(claims.data?.claims?.sub)
 const areas=(areasRes.data??[]) as StorefrontArea[]
 const offers=(offersRes.data??[]) as StorefrontOffer[]
 const featured=(featuredRes.data??[]) as ShowcaseProduct[]
 const catalogAvailable=!areasRes.error&&!offersRes.error
 const schema={
  '@context':'https://schema.org',
  '@graph':[
   {'@type':'Organization','@id':`${SITE_URL}/#organization`,name:SITE_NAME,url:SITE_URL,
    logo:`${SITE_URL}/brand-logo-header.png`,email:PUBLIC_CONTACT_EMAIL,slogan:SITE_TAGLINE_EN,
    contactPoint:{'@type':'ContactPoint',contactType:'customer service',email:PUBLIC_CONTACT_EMAIL}},
   {'@type':'WebSite','@id':`${SITE_URL}/#website`,name:SITE_NAME,url:SITE_URL,
    description:SITE_DESCRIPTION,publisher:{'@id':`${SITE_URL}/#organization`}},
   {'@type':'ImageObject','@id':`${SITE_URL}/#primaryimage`,contentUrl:`${SITE_URL}/grocery-hero-glass.svg`,caption:'Everyday essentials bought with community savings'},
   {'@type':'WebPage','@id':`${SITE_URL}/#webpage`,name:`${SITE_NAME} | ${SITE_TAGLINE_EN}`,
    url:SITE_URL,description:SITE_DESCRIPTION,inLanguage:['en-BD','bn-BD']},
  ],
 }
 return <main className="public-marketplace-flat min-h-screen bg-white text-black">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  <PublicMarketplace areas={areas} offers={offers} authenticated={authenticated} catalogAvailable={catalogAvailable} featured={featured} howLabelBn="কীভাবে কাজ করে"/>
  <PublicFooter storefront/>
 </main>
}
