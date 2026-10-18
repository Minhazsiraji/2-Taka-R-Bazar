// Pilot booking public security/entry smoke, isolated localhost database only.
import assert from 'node:assert/strict'
import {chromium} from 'playwright'

const api=process.env.NEXT_PUBLIC_SUPABASE_URL??''
const base=process.env.NEXT_PUBLIC_SITE_URL??''
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(api)||!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
 throw Error('Pilot browser smoke requires isolated localhost only')

const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:390,height:844}})
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 const productId='00000000-0000-4000-8000-000000000822'
 const response=await page.goto(base+'/pilot-book?product='+productId,{waitUntil:'domcontentloaded'})
 assert.ok(response&&response.status()<500,'Pilot booking entrypoint must not server-error')
 await page.waitForURL(url=>url.pathname==='/login',{timeout:15000})
 assert.match(decodeURIComponent(new URL(page.url()).searchParams.get('next')??''),/\/pilot-book\?product=/,
  'Guest login must preserve the requested product')
 await page.goto(base+'/pilot-bookings',{waitUntil:'domcontentloaded'})
 await page.waitForURL(url=>url.pathname==='/login',{timeout:15000})
 await page.goto(base+'/admin/pilot-bookings',{waitUntil:'domcontentloaded'})
 await page.waitForURL(url=>url.pathname==='/login',{timeout:15000})
 await page.goto(base+'/cart',{waitUntil:'domcontentloaded'})
 await page.getByRole('link',{name:/Book a product/}).waitFor()
 assert.deepEqual(errors,[],'No browser exceptions in pilot booking entry flow')
 console.log('PASS: pilot booking CTA, customer and admin login gates, mobile browser layout entry')
}finally{await browser.close()}
