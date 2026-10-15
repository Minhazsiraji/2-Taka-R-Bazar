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
 // Keep synthetic image qualification independent of external image CDN outages.
 await page.route('https://res.cloudinary.com/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WXKtU0AAAAASUVORK5CYII=','base64')}))
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
 // Issue #99: published-product catalog reuses the same secure public projection.
 // Seed two pages, plus unpublished, inactive, and demo rows in disposable DB only.
 const extra=Array.from({length:13},(_,i)=>({
  id:randomUUID(),slug:'catalog-uat-'+i+'-'+id.slice(0,8),sku:'CATALOG-UAT-'+i+'-'+id.slice(0,8),
  en:'Catalog synthetic item '+i,bn:'ক্যাটালগ পরীক্ষামূলক পণ্য '+i
 }))
 await insert('products',extra.map(x=>({
  id:x.id,name:x.en,sku:x.sku,category:'Dairy',package_size:'1 kg',unit:'kg',
  active:true,is_demo:false,image_url:'https://res.cloudinary.com/demo/image/upload/sample.jpg'
 })))
 await insert('product_seo_content',extra.map(x=>({
  product_id:x.id,slug:x.slug,title_en:x.en,title_bn:x.bn,status:'published',
  alt_en:'Authentic synthetic catalog photo '+x.en,alt_bn:'পরীক্ষার পণ্যের ছবি'
 })))
 const ineligible=[
  {id:randomUUID(),slug:'catalog-test-draft-'+id.slice(0,8),status:'draft',active:true,is_demo:false},
  {id:randomUUID(),slug:'catalog-test-inactive-'+id.slice(0,8),status:'published',active:false,is_demo:false},
  {id:randomUUID(),slug:'catalog-test-demo-'+id.slice(0,8),status:'published',active:true,is_demo:true}
 ]
 await insert('products',ineligible.map(x=>({
  id:x.id,name:x.slug,sku:x.slug.toUpperCase(),category:'Dairy',
  package_size:'1 kg',unit:'kg',active:x.active,is_demo:x.is_demo,
  image_url:'https://res.cloudinary.com/demo/image/upload/sample.jpg'
 })))
 await insert('product_seo_content',ineligible.map(x=>({
  product_id:x.id,slug:x.slug,title_en:x.slug,title_bn:'প্রকাশিত নয়',status:x.status,
  alt_en:'Test item',alt_bn:'পরীক্ষার ছবি'
 })))
 const home=await page.goto(base+'/',{waitUntil:'domcontentloaded'})
 assert.equal(home?.status(),200)
 const section=page.locator('#published-products')
 await section.getByRole('heading',{name:'All Products'}).waitFor()
 assert.equal(await section.locator('[data-testid="published-product-card"]').count(),12,'First catalog page contains 12 eligible records')
 assert.equal(await section.getByRole('link',{name:/View Details/}).count(),12,'Every product has a public details link')
 assert.equal(await section.getByText('Price pending',{exact:true}).count(),12)
 assert.equal(await section.locator('img[src="https://res.cloudinary.com/demo/image/upload/sample.jpg"]').count(),12)
 assert.equal(await section.locator('form,[href^="/cart"],[href^="/checkout"],button:has-text("Buy"),button:has-text("Cart")').count(),0,
  'Read-only catalog has no cart or buy controls')
 for(const excluded of ineligible)assert.equal(await section.getByText(excluded.slug).count(),0,'Unapproved, inactive and demo products cannot appear')
 await section.getByRole('button',{name:'Show more products'}).click()
 await page.waitForFunction(()=>document.querySelectorAll('#published-products [data-testid="published-product-card"]').length===14)
 assert.equal(await section.getByRole('button',{name:'Show more products'}).count(),0,'Pagination ends without duplicates')
 const firstLink=section.locator('[data-testid="published-product-card"]').first().locator('h3 a')
 assert.match(await firstLink.getAttribute('href')??'',/^\/p\/(?:catalog-uat|seo-uat)/)
 const toggle=page.locator('.market-flat-header .market-single-language')
 await toggle.click()
 assert.equal(await section.getByRole('heading',{name:'সব পণ্য'}).count(),1)
 assert.equal(await section.getByText('মূল্য শীঘ্রই',{exact:true}).count(),14)
 assert.match(await firstLink.getAttribute('href')??'',/^\/bn\/p\/(?:catalog-uat|seo-uat)/)
 await page.screenshot({path:'/tmp/2tbr-product-seo-catalog-bn-mobile.png',fullPage:true})
 await toggle.click()
 for(const width of [320,393,768,1024,1440]){
  await page.setViewportSize({width,height:900})
  await page.locator('#published-products').scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,
   'No catalog horizontal overflow at '+width)
 }
 await page.screenshot({path:'/tmp/2tbr-product-seo-catalog-desktop.png',fullPage:true})
 // A product published AFTER the initial visit must be discovered on the next page refresh.
 const future={id:randomUUID(),slug:'catalog-future-'+id.slice(0,8)}
 await insert('products',{id:future.id,name:'Newly published catalog item',sku:'CATALOG-FUTURE-'+id.slice(0,8),
  category:'Dairy',package_size:'1 kg',unit:'kg',active:true,is_demo:false,
  image_url:'https://res.cloudinary.com/demo/image/upload/sample.jpg'})
 await insert('product_seo_content',{product_id:future.id,slug:future.slug,
  title_en:'Newly published catalog item',title_bn:'নতুন প্রকাশিত ক্যাটালগ পণ্য',
  alt_en:'True uploaded test fixture image',alt_bn:'পরীক্ষার ছবি',status:'published'})
 await page.reload({waitUntil:'domcontentloaded'})
 assert.equal(await page.locator('#published-products').getByText('Newly published catalog item').count(),1,
  'Future published products automatically appear after refresh')
 console.log('Issue 99 published catalog: EN/BN, genuine image URL, no purchase, 12+ paging, ineligible isolation, future publish and responsive widths PASS.')
 const {error}=await client.from('products').update({is_demo:true}).eq('id',id)
 if(error)throw error
 const blocked=await page.goto(base+'/p/'+slug,{waitUntil:'domcontentloaded'})
 assert.equal(blocked?.status(),404,'Demo products blocked from publication')
 console.log('Product SEO EN/BN browser, canonical, schema, sitemap, RLS-gated demo isolation PASS')
}finally{await browser.close()}
