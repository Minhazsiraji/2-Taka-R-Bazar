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
assert.ifError((await admin.from('pickup_points').insert({id:randomUUID(),community_id:cid,name:'Fictional shared-offer community gate',address:'Synthetic test gate, local community only',active:true})).error)
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
   const tierCount=kind==='GROUP_DEAL'?2:3
   await form.getByLabel('Number of tiers to offer').selectOption(String(tierCount))
   for(let level=1;level<=tierCount;level++){
    const target=kind==='GROUP_DEAL'?[3,5][level-1]:[5,10,20][level-1]
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
  await page.goto(base+'/?area='+area+'&q='+encodeURIComponent(name),{waitUntil:'domcontentloaded',timeout:60000})
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
 await page.getByText('Commitment recorded. Final tier price',{exact:false}).waitFor({timeout:20000})
 await page.waitForFunction(productId=>{
  try{return JSON.parse(localStorage.getItem('2tbr-launch-cart-v1')||'[]').some(item=>item.product_id===productId)}
  catch{return false}
 },pid,{timeout:20000})
 await page.goto(base+'/cart',{waitUntil:'networkidle'})
 assert.match(await page.locator('main').innerText(),/৳90/)
 const cartQty=page.getByRole('group',{name:'Quantity for '+name})
 const decrease=cartQty.getByRole('button',{name:'Decrease '+name+' quantity'})
 const increase=cartQty.getByRole('button',{name:'Increase '+name+' quantity'})
 const before=await decrease.boundingBox(),after=await increase.boundingBox()
 assert.ok(before&&after&&Math.abs(before.y-after.y)<8,'Cart quantity controls must remain horizontal on mobile')
 await increase.click()
 // Cart updates persist the commitment through a server action before updating local state.
 // Do not assert immediately after the click: React updates only after the RPC resolves.
 try{await cartQty.locator('output').getByText('2',{exact:true}).waitFor({timeout:15000})}
 catch{throw Error('Cart increment did not persist: '+JSON.stringify({quantity:await cartQty.locator('output').innerText(),errors:await page.getByRole('alert').allInnerTexts()}))}
 await decrease.click()
 try{await cartQty.locator('output').getByText('1',{exact:true}).waitFor({timeout:15000})}
 catch{throw Error('Cart decrement did not persist: '+JSON.stringify({quantity:await cartQty.locator('output').innerText(),errors:await page.getByRole('alert').allInnerTexts()}))}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Cart must fit mobile viewport')
 const groupQty=await admin.from('simple_sale_commitment_items').select('quantity').eq('offer_id',offers.GROUP_DEAL).eq('customer_id',uid).eq('product_id',pid).single();assert.ifError(groupQty.error)
 assert.equal(groupQty.data.quantity,1,'Group Deal quantity is persistent after increment/decrement')
 await page.goto(base+'/preview-live/pool/'+offers.COMMUNITY_POOL,{waitUntil:'networkidle'})
 await page.getByRole('button',{name:'Increase '+name,exact:true}).click()
 await page.getByRole('button',{name:'Join Pool · Save commitment',exact:false}).click()
 const poolNavigation=await Promise.race([
  page.waitForURL('**/cart',{timeout:15000}).then(()=>({navigated:true})).catch(()=>null),
  page.locator('.native-preview-status').waitFor({timeout:15000}).then(async()=>({message:await page.locator('.native-preview-status').innerText()})).catch(()=>null)
 ])
 if(!poolNavigation?.navigated)throw Error('Pool join failed: '+JSON.stringify({result:poolNavigation,now:page.url(),visibleStatus:await page.locator('.native-preview-status').allInnerTexts(),clientErrors:errors}))
 // Router navigation completes before the client cart has hydrated; wait for real Pool pricing.
 await page.locator('main').getByText(/৳80/).first().waitFor({timeout:20000})
 assert.match(await page.locator('main').innerText(),/৳80/)
 const poolQty=await admin.from('simple_sale_commitment_items').select('quantity').eq('offer_id',offers.COMMUNITY_POOL).eq('customer_id',uid).eq('product_id',pid).single();assert.ifError(poolQty.error)
 assert.equal(poolQty.data.quantity,1,'Pool commitment quantity saved before any checkout')

 const prefForm=page.getByRole('region',{name:/Delivery preference for/})
 await prefForm.locator('select').selectOption({index:1})
 await prefForm.getByRole('button',{name:'Save delivery preference',exact:false}).click()
 await prefForm.getByText('Delivery preference saved.',{exact:false}).waitFor()
 let preference=await admin.from('simple_sale_commitment_delivery').select('fulfillment,delivery_fee,pickup_point_id').eq('offer_id',offers.COMMUNITY_POOL).eq('customer_id',uid).single()
 assert.ifError(preference.error)
 assert.equal(preference.data.fulfillment,'pickup');assert.equal(preference.data.delivery_fee,null)
 await prefForm.getByRole('radio',{name:'Home delivery'}).check()
 await prefForm.locator('textarea').fill('Fictional home address, Road 2, Test Community')
 await prefForm.getByRole('button',{name:'Save delivery preference',exact:false}).click()
 await prefForm.getByText('Delivery preference saved.',{exact:false}).waitFor()
 preference=await admin.from('simple_sale_commitment_delivery').select('fulfillment,delivery_fee,home_address').eq('offer_id',offers.COMMUNITY_POOL).eq('customer_id',uid).single()
 assert.ifError(preference.error)
 assert.equal(preference.data.fulfillment,'home_delivery')
 assert.equal(preference.data.delivery_fee,null,'Delivery fee remains unquoted before final price and consent')
 assert.match(preference.data.home_address,/Fictional home address/)

 assert.equal(await page.getByRole('link',{name:'Checkout / চেকআউট',exact:true}).count(),0,'Pool commitment cannot checkout')
 assert.match(await page.locator('main').innerText(),/commitment only/i)
 await page.goto(base+'/checkout',{waitUntil:'domcontentloaded'})
 assert.equal(await page.getByRole('button',{name:'Place order / অর্ডার দিন',exact:true}).count(),0)
 // Guard the database even when a client bypasses the UI.
 const beforeOrderCount=(await client.from('launch_orders').select('id',{count:'exact',head:true})).count
 for(const kind of ['GROUP_DEAL','COMMUNITY_POOL']){
  const attempt=await client.rpc('launch_submit_order',{
   p_items:[{product_id:pid,offer_id:offers[kind],quantity:1}],
   p_request_key:randomUUID(),p_name:'Fictional customer',p_phone:'01700000000',
   p_address:'Fictional home address, Test Road',p_method:'home_delivery',p_terms:true
  })
  assert.ok(attempt.error,'Premature '+kind+' order must fail at the database')
  assert.match(attempt.error.message,/commitments only/i)
 }
 assert.equal((await client.from('launch_orders').select('id',{count:'exact',head:true})).count,beforeOrderCount)
 assert.equal((await client.from('launch_product_stock').select('available_quantity').eq('product_id',pid).single()).data.available_quantity,10)
 assert.deepEqual(errors,[])
 // Five extra fictional customers: all disposable/local, no real signups or SMS.
 const fictionalPeople=[]
 for(let n=0;n<5;n++){
  const peerEmail='fictional-community-'+suffix+'-'+n+'@example.invalid',peerPass='Ab12!'+randomUUID()
  const createdPeer=await admin.auth.admin.createUser({email:peerEmail,password:peerPass,email_confirm:true});assert.ifError(createdPeer.error)
  const communityId=n===4?cid2:cid
  assert.ifError((await admin.from('profiles').update({community_id:communityId,onboarding_completed_at:new Date().toISOString(),
   full_name:'Fictional customer '+n,household_name:'Fictional household '+n,phone:'017000000'+String(n).padStart(2,'0')}).eq('id',createdPeer.data.user.id)).error)
  const peer=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}})
  assert.ifError((await peer.auth.signInWithPassword({email:peerEmail,password:peerPass})).error)
  const joined=await peer.rpc('join_simple_sale_group_deal_quantified',{p_offer:offers.GROUP_DEAL,p_product:pid,p_area:communityId,p_quantity:1})
  assert.ifError(joined.error)
  fictionalPeople.push({id:createdPeer.data.user.id,communityId})
 }
 assert.equal(fictionalPeople.length,5)
 const joins=await admin.from('simple_sale_offer_joins').select('customer_id,community_id').eq('offer_id',offers.GROUP_DEAL).eq('status','active')
 assert.ifError(joins.error)
 assert.equal(new Set(joins.data.filter(j=>j.community_id===cid).map(j=>j.customer_id)).size,5)
 assert.equal(new Set(joins.data.filter(j=>j.community_id===cid2).map(j=>j.customer_id)).size,1)
 const cycles=await admin.from('simple_sale_cycles').select('id,community_id,status,cycle_number,locked_threshold,next_cycle_id').eq('offer_id',offers.GROUP_DEAL)
 assert.ifError(cycles.error)
 const closedA=cycles.data.find(c=>c.community_id===cid&&c.status==='closed')
 const freshA=cycles.data.find(c=>c.community_id===cid&&c.status==='open')
 const ongoingB=cycles.data.find(c=>c.community_id===cid2&&c.status==='open')
 assert.ok(closedA&&freshA&&ongoingB,'Closed and reopened A with independent open B')
 assert.equal(closedA.locked_threshold,5)
 assert.equal(closedA.next_cycle_id,freshA.id)
 assert.notEqual(closedA.id,freshA.id)
 const openA=await admin.from('simple_sale_cycle_members').select('customer_id',{count:'exact',head:true}).eq('cycle_id',freshA.id)
 const openB=await admin.from('simple_sale_cycle_members').select('customer_id',{count:'exact',head:true}).eq('cycle_id',ongoingB.id)
 assert.equal(openA.count,0,'Reopened A must have zero buyers')
 assert.equal(openB.count,1,'B count must remain independent')
 const updatedFeed=await client.rpc('get_public_simple_offers')
 assert.ifError(updatedFeed.error)
 const finalDeal=updatedFeed.data.find(o=>o.id===offers.GROUP_DEAL)
 assert.equal(finalDeal.buyer_count,0,'Public card must never imply global unlocked price')
 assert.equal(finalDeal.community_progress.find(p=>p.community_id===cid).buyer_count,0)
 assert.equal(finalDeal.community_progress.find(p=>p.community_id===cid2).buyer_count,1)
 assert.equal((await admin.from('simple_sale_commitment_items').select('customer_id',{count:'exact',head:true}).eq('offer_id',offers.GROUP_DEAL)).count,6)
 console.log('PASS six fictional users: Area A reaches 5/5 and closes, then reopens with a distinct empty cycle. Area B retains 1/3 without unlocking.')
 await page.screenshot({path:'/tmp/2tbr-shared-offer-order.png',fullPage:true})
 console.log('PASS upload once → multi-area offers → Deal and Pool commitments → no premature orders or stock deduction → cross-community six-person test')
}finally{await browser.close()}
