// Runs only against disposable localhost Supabase. No hosted data or messages.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {createServerClient} from '@supabase/ssr'
import {chromium} from 'playwright'
const api=process.env.NEXT_PUBLIC_SUPABASE_URL??'',secret=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY??'',key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??''
const base=process.env.NEXT_PUBLIC_SITE_URL??'http://127.0.0.1:3000'
if(new URL(api).hostname!=='127.0.0.1'||new URL(base).hostname!=='127.0.0.1'||!secret)throw Error('Disposable localhost only')
const admin=createClient(api,secret,{auth:{persistSession:false,autoRefreshToken:false}})
const suffix=randomUUID().slice(0,8),cid=randomUUID(),name='Fictional offer rice '+suffix
const email='shared-offer-'+suffix+'@example.invalid',password=randomUUID()+'Aa1!'
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error)
const uid=created.data.user.id
assert.ifError((await admin.from('user_roles').insert({user_id:uid,role:'admin'})).error)
assert.ifError((await admin.from('communities').insert({id:cid,name:'Fictional offer area '+suffix,slug:'offer-area-'+suffix})).error)
const jar=new Map()
const client=createServerClient(api,key,{cookies:{getAll:()=>[...jar.values()],setAll:cs=>cs.forEach(c=>jar.set(c.name,c))}})
assert.ifError((await client.auth.signInWithPassword({email,password})).error)
const browser=await chromium.launch({headless:true})
try{
 const context=await browser.newContext({viewport:{width:393,height:852}})
 await context.addCookies([...jar.values()].filter(c=>c.value).map(c=>({name:c.name,value:c.value,url:base,sameSite:'Lax',secure:false})))
 const page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/admin/products',{waitUntil:'networkidle'})
 const upload=page.getByRole('form',{name:'Quick Product Upload'})
 for(const [field,value] of Object.entries({name,category:'Rice',package_size:'1 kg',unit:'kg',sku:'SHARED-'+suffix}))await upload.locator('[name="'+field+'"]').fill(value)
 await upload.getByRole('button',{name:'Save & activate product'}).click()
 await upload.getByText('Product saved and active',{exact:false}).waitFor()
 const product=await client.from('products').select('id,image_url').eq('sku',('SHARED-'+suffix).toUpperCase()).single();assert.ifError(product.error)
 const pid=product.data.id,offers={}
 for(const [kind,price] of [['SOLO','100'],['GROUP_DEAL','90'],['COMMUNITY_POOL','80']]){
  await page.goto(base+'/admin/offers',{waitUntil:'networkidle'})
  const form=page.getByRole('form',{name:'Shared offer setup'})
  await form.locator('[name="kind"]').selectOption(kind)
  await form.locator('[name="community_id"]').selectOption(cid)
  await form.locator('[name="title"]').fill('Fictional '+kind+' '+suffix)
  await form.getByLabel(name+' · 1 kg',{exact:false}).check()
  await form.locator('[name="price:'+pid+'"]').fill(price)
  if(kind==='SOLO')await form.locator('[name="stock:'+pid+'"]').fill('10')
  await form.getByLabel('Publish on website').check()
  await form.getByRole('button',{name:'Save offer',exact:true}).click()
  await form.getByText('Offer published.',{exact:false}).waitFor()
  const saved=await client.from('simple_sale_offers').select('id').eq('title','Fictional '+kind+' '+suffix).single();assert.ifError(saved.error);offers[kind]=saved.data.id
 }
 assert.equal((await client.from('launch_product_stock').select('available_quantity').eq('product_id',pid).single()).data.available_quantity,10)
 await page.goto(base+'/?q='+encodeURIComponent(name),{waitUntil:'networkidle'})
 const deal=page.locator('.app-card-preview-deal').filter({hasText:name})
 await deal.getByRole('button',{name:'Join Deal',exact:true}).click()
 await page.goto(base+'/cart',{waitUntil:'networkidle'})
 assert.match(await page.locator('main').innerText(),/৳90/)
 await page.goto(base+'/preview-live/pool/'+offers.COMMUNITY_POOL,{waitUntil:'networkidle'})
 await page.getByRole('button',{name:'Increase '+name,exact:true}).click()
 await page.getByRole('button',{name:'Review Pool order',exact:false}).click()
 await page.waitForURL('**/cart')
 assert.match(await page.locator('main').innerText(),/৳80/)
 await page.getByRole('link',{name:'Checkout / চেকআউট',exact:true}).click()
 await page.locator('[name="contact_name"]').fill('Fictional offer buyer')
 await page.locator('[name="contact_phone"]').fill('01700000000')
 await page.locator('[name="address"]').fill('Fictional local browser address')
 await page.locator('[name="terms"]').check()
 await page.getByRole('button',{name:'Place order / অর্ডার দিন',exact:true}).click()
 await page.waitForURL('**/launch-orders/**')
 const oid=new URL(page.url()).pathname.split('/').at(-1)
 const order=await client.from('launch_orders').select('subtotal,status,payment_status').eq('id',oid).single();assert.ifError(order.error)
 assert.equal(Number(order.data.subtotal),80);assert.equal(order.data.status,'requested');assert.equal(order.data.payment_status,'pending')
 assert.equal((await client.from('launch_order_items').select('offer_id').eq('order_id',oid).single()).data.offer_id,offers.COMMUNITY_POOL)
 assert.equal((await client.from('launch_product_stock').select('available_quantity').eq('product_id',pid).single()).data.available_quantity,9)
 assert.deepEqual(errors,[])
 await page.screenshot({path:'/tmp/2tbr-shared-offer-order.png',fullPage:true})
 console.log('PASS upload once → create all three offers → Deal cart price → Pool selection replaces offer → server-priced manual order → shared stock')
}finally{await browser.close()}
