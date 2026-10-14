import type { MetadataRoute } from 'next'
import { SEO_UPDATED_AT, SITE_URL } from '@/lib/site'
import {createClient} from '@/lib/supabase/server'

export const dynamic='force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date(SEO_UPDATED_AT)
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: SITE_URL+'/about', lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: SITE_URL+'/faq', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: SITE_URL+'/privacy', lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: SITE_URL+'/terms', lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: SITE_URL+'/return-policy', lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: SITE_URL+'/refund-policy', lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ]
  // The public RPC excludes draft, inactive and demo records and exposes no cost/stock data.
  // Preserve existing sitemap during migration rollout.
  try {
    const supabase=await createClient()
    const products:MetadataRoute.Sitemap=[]
    for(let offset=0;offset<25000;offset+=500){
      const {data,error}=await supabase.rpc('get_public_product_seo',{p_slug:null,p_limit:500,p_offset:offset})
      if(error)break
      for(const p of data??[]){
        if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug))continue
        const stamp=p.updated_at?new Date(p.updated_at):lastModified
        products.push({url:SITE_URL+'/p/'+p.slug,lastModified:stamp,changeFrequency:'weekly',priority:0.7},
          {url:SITE_URL+'/bn/p/'+p.slug,lastModified:stamp,changeFrequency:'weekly',priority:0.7})
      }
      if(!data||data.length<500)break
    }
    return [...staticPages,...products]
  }catch{return staticPages}
}
