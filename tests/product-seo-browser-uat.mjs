// Issue #80 SEO browser UAT. Runs ONLY in disposable local Supabase CI, never the shared live database.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'

const db=process.env.NEXT_PUBLIC_SUPABASE_URL??''
const secret=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY??''
const base=process.env.NEXT_PUBLIC_SITE_URL??'http://127.0.0.1:3000'
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\b/.test(db)||!secret||!/127\.0\.0\.1|localhost/.test(base)){
 throw Error('Product SEO browser fixtures require isolated localhost database, localhost site and service-role key.')
}
const client=createClient(db,secret,{auth:{autoRefreshToken:false,persistSession:false}})
const id=randomUUID(),slug='seo-uat-brown-rice-'+id.slice(0,8),sku='SEO-UAT-'+id.slice(0,8).toUpperCase()
async function insert(table,rows){
 const {error}=await client.from(table).insert(rows)
 if(error)throw Error(table+': '+error.message)
}
await insert('products',{id,name:'Synthetic loose brown rice',brand:null,category:'Rice & Grains',
 package_size:'1 kg',unit:'kg',sku,is_demo:false,active:true,image_url:'https://res.cloudinary.com/demo/image/upload/sample.jpg'})
await insert('product_seo_content',{product_id:id,slug,title_en:'Brown Rice Loose 1 kg - Preview',
 title_bn:'ব্রাউন রাইস খোলা চাল ১ কেজি',
 short_en:'Synthetic fixture for isolated browser SEO validation.',
 short_bn:'আলাদা পরীক্ষামূলক ডেটাবেসের পণ্য।',
 description_en:'This is isolated synthetic product content for SEO testing only.',
 description_bn:'এটি কেবল বিচ্ছিন্ন পরীক্ষামূলক ডেটাবেসে ব্যবহৃত একটি পরীক্ষামূলক পণ্য।',
 meta_title_en:'Brown Rice Loose 1 kg - SEO Preview',
 meta_title_bn:'ব্রাউন রাইস খোলা ১ কেজি',
 meta_description_en:'Test product SEO descriptions in a disposable isolated browser preview; never expose to production.',
 meta_description_bn:'এটি কেবল আলাদা পরীক্ষামূলক ডেটাবেসের পণ্যের বিবরণ।',
 alt_en:'Synthetic brown rice grains',alt_bn:'পরীক্ষামূলক ব্রাউন রাইস',
 verification_notes:'Synthetic fixture for isolated CI browser verification',
 specs:{package_kind:'Loose by weight'},status:'published'})
await insert('product_seo_faqs',{product_id:id,position:1,
 question_en:'Is it a real product offer?',answer_en:'No, synthetic browser testing only.',
 question_bn:'এটি কি আসল অফার?',answer_bn:'না, শুধু পরীক্ষার জন্য।'})
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:390,height:844}})
 const en=await page.goto(base+'/p/'+slug,{waitUntil:'domcontentloaded'})
 assert.equal(en?.status(),200,'EN SEO page reachable')
 assert.match(await page.locator('h1').textContent()??'',/Brown Rice Loose 1 kg/)
 assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),base+'/p/'+slug)
 assert.equal(await page.locator('link[hreflang="bn-BD"]').getAttribute('href'),base+'/bn/p/'+slug)
 const json=JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent()??'{}')
 assert.equal(json['@graph'].find(x=>x['@type']==='Product')?.sku,sku)
 assert.ok(!json['@graph'].find(x=>x['@type']==='Product')?.offers,'No fictitious merchant Offer')
 assert.match(await page.locator('body').textContent()??'',/Is it a real product offer\?/)
 await page.screenshot({path:'/tmp/2tbr-product-seo-en.png',fullPage:true})
 const bn=await page.goto(base+'/bn/p/'+slug,{waitUntil:'domcontentloaded'})
 assert.equal(bn?.status(),200,'Bangla SEO page reachable')
 assert.match(await page.locator('h1').textContent()??'',/ব্রাউন রাইস/)
 assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),base+'/bn/p/'+slug)
 await page.screenshot({path:'/tmp/2tbr-product-seo-bn.png',fullPage:true})
 const map=await fetch(base+'/sitemap.xml').then(r=>r.text())
 assert.ok(map.includes(base+'/p/'+slug),'English listing indexed in sitemap')
 assert.ok(map.includes(base+'/bn/p/'+slug),'Bangla listing indexed in sitemap')
 const {error}=await client.from('products').update({is_demo:true}).eq('id',id)
 if(error)throw error
 const blocked=await page.goto(base+'/p/'+slug,{waitUntil:'domcontentloaded'})
 assert.equal(blocked?.status(),404,'Demo products blocked from publication')
 console.log('Product SEO EN/BN browser, canonical, schema, sitemap, RLS-gated demo isolation PASS')
}finally{await browser.close()}
