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
const suffix=randomUUID().slice(0,8),cid=randomUUID(),cid2=randomUUID(),cid3=randomUUID(),name='Fictional offer rice '+suffix
const email='shared-offer-'+suffix+'@example.invalid',password=randomUUID()+'Aa1!'
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error)
const uid=created.data.user.id
assert.ifError((await admin.from('user_roles').insert({user_id:uid,role:'admin'})).error)
assert.ifError((await admin.from('communities').insert([{id:cid,name:'Fictional offer area '+suffix,slug:'offer-area-'+suffix},{id:cid2,name:'Fictional second area '+suffix,slug:'offer-second-'+suffix},{id:cid3,name:'Fictional unselected area '+suffix,slug:'offer-other-'+suffix}])).error)
assert.ifError((await admin.from('profiles').update({full_name:'Fictional shared-offer buyer',household_name:'Fictional household',phone:'017'+String(Math.floor(Math.random()*100000000)).padStart(8,'0'),community_id:cid,onboarding_completed_at:new Date().toISOString()}).eq('id',uid)).error)
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
 await upload.locator('input[type="file"]').setInputFiles({name:'fictional-rice.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC','base64')})
 await upload.getByText(/^Ready/).waitFor()
 await upload.getByRole('button',{name:'Save & activate product'}).click()
 await upload.getByText('Product saved and active',{exact:false}).waitFor()
 const product=await client.from('products').select('id,image_url').eq('sku',('SHARED-'+suffix).toUpperCase()).single();assert.ifError(product.error)
 assert.ok(product.data.image_url?.includes('/product-images/'))
 const pid=product.data.id,offers={}
 for(const [kind,price] of [['SOLO','100'],['GROUP_DEAL','90'],['COMMUNITY_POOL','80']]){
  await page.goto(base+'/admin/offers',{waitUntil:'networkidle'})
  const form=page.getByRole('form',{name:'Shared offer setup'})
  await form.locator('[name="kind"]').selectOption(kind)
  if(kind==='GROUP_DEAL'){
   await form.getByRole('button',{name:'Select all',exact:true}).click()
   assert.ok(await form.locator('input[name="community_ids"]').count()>=3)
   await form.getByRole('button',{name:'Clear selection',exact:true}).click()
   assert.equal(await form.locator('input[name="community_ids"]').count(),0)
  }
  await form.getByRole('searchbox',{name:'Search communities / areas'}).fill('Fictional offer area '+suffix)
  await form.getByLabel('Fictional offer area '+suffix,{exact:true}).check()
  await form.getByRole('searchbox',{name:'Search communities / areas'}).fill('Fictional second area '+suffix)
  await form.getByLabel('Fictional second area '+suffix,{exact:true}).check()
  assert.equal(await form.locator('input[name="community_ids"]').count(),2)
  await form.getByRole('searchbox',{name:'Search communities / areas'}).fill('')
  await form.locator('[name="title"]').fill('Fictional '+kind+' '+suffix)
  await form.getByLabel(name+' · 1 kg',{exact:false}).check()
  await form.locator('[name="price:'+pid+'"]').fill(price)
  if(kind!=='SOLO'){
   const tierCount=kind==='GROUP_DEAL'?3:2
   await form.getByLabel('Number of tiers to offer').selectOption(String(tierCount))
   for(let level=1;level<=tierCount;level++){
    const target=kind==='GROUP_DEAL'?[3,5,10][level-1]:[2,4][level-1]
    await form.locator('[name="threshold:'+level+'"]').fill(String(target))
    await form.locator('[name="tier:'+level+':'+pid+'"]').fill(String(Number(price)-5*level))
   }
  }
  if(kind==='SOLO')await form.locator('[name="stock:'+pid+'"]').fill('10')
  await form.getByLabel('Publish on website').check()
  if(kind==='SOLO'){
   await form.locator('[name="closes_at"]').fill('2000-01-01T00:00')
   await form.getByRole('button',{name:'Save offer',exact:true}).click()
   await form.getByRole('alert').waitFor()
   assert.equal(await form.locator('[name="title"]').inputValue(),'Fictional '+kind+' '+suffix)
   assert.equal(await form.locator('[name="price:'+pid+'"]').inputValue(),price)
   assert.equal(await form.locator('input[name="community_ids"]').count(),2)
   await form.locator('[name="closes_at"]').fill('')
  }
  if(kind==='COMMUNITY_POOL'){
   for(const width of [393,820,1440]){
    await page.setViewportSize({width,height:900})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Offer form overflows at '+width)
    await page.screenshot({path:'/tmp/2tbr-shared-offer-areas-'+width+'.png',fullPage:true})
   }
   await page.setViewportSize({width:393,height:852})
  }
  await form.getByRole('button',{name:'Save offer',exact:true}).click()
  await form.getByText('Offer published.',{exact:false}).waitFor()
  const saved=await client.from('simple_sale_offers').select('id').eq('title','Fictional '+kind+' '+suffix).single();assert.ifError(saved.error);offers[kind]=saved.data.id
 }
 await page.goto(base+'/admin/offers?edit='+offers.COMMUNITY_POOL,{waitUntil:'networkidle'})
 const editForm=page.getByRole('form',{name:'Shared offer setup'})
 assert.equal(await editForm.getByLabel('Fictional offer area '+suffix,{exact:true}).isChecked(),true)
 assert.equal(await editForm.getByLabel('Fictional second area '+suffix,{exact:true}).isChecked(),true)
 assert.equal(await editForm.getByLabel('Fictional unselected area '+suffix,{exact:true}).isChecked(),false)
 await editForm.getByRole('button',{name:'Save offer',exact:true}).click()
 await editForm.getByText('Offer published.',{exact:false}).waitFor()
 const feed=await client.rpc('get_public_simple_offers');assert.ifError(feed.error)
 const own=feed.data.filter(o=>Object.values(offers).includes(o.id))
 assert.equal(own.length,3)
 assert.ok(own.every(o=>o.community_ids.length===2&&o.community_ids.includes(cid)&&o.community_ids.includes(cid2)&&!o.community_ids.includes(cid3)))
 for(const area of [cid,cid2,cid3]){
  await page.evaluate(()=>localStorage.removeItem('2tbr-browsing-area-v1'))
  await page.goto(base+'/?area='+area+'&q='+encodeURIComponent(name),{waitUntil:'networkidle'})
  const count=await page.locator('.app-card-preview-deal').filter({hasText:name}).count()
  assert.equal(count,area===cid3?0:1,'Deal community membership')
  const poolCount=await page.locator('.app-card-preview-pool').filter({hasText:'Fictional COMMUNITY_POOL '+suffix}).count()
  assert.equal(poolCount,area===cid3?0:1,'Pool community membership')
 }
 await page.evaluate(()=>localStorage.removeItem('2tbr-browsing-area-v1'))
 assert.ok(feed.data.filter(o=>Object.values(offers).includes(o.id)).every(o=>o.items[0].image_url===product.data.image_url))
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
 console.log('PASS upload once → multi-area all three offers → search/select all/edit/retry → selected-area public browsing without duplicate cards → Deal cart price → Pool checkout → shared stock')
}finally{await browser.close()}
