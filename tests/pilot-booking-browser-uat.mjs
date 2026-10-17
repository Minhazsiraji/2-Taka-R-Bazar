// Isolated localhost browser qualification for 2TBR customer pilot bookings.
// Never run against shared hosted database or a real user session.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'

const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL??''
const secret=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY??''
const base=process.env.NEXT_PUBLIC_SITE_URL??''
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint)||!secret||!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
 throw Error('Pilot booking browser qualification requires localhost-only Supabase and site')
const client=createClient(endpoint,secret,{auth:{persistSession:false,autoRefreshToken:false}})
const id=randomUUID(),sku='PILOT-BROWSER-'+id.slice(0,8).toUpperCase()
const community=randomUUID()
const password='TestOnlyA1!'+randomUUID()
const suffix=String(Math.floor(Math.random()*80000+10000))
const customerPhone='01788'+suffix
const adminPhone='01799'+suffix

async function insert(table,payload){
 const {error}=await client.from(table).insert(payload)
 if(error)throw Error('Fixture '+table+': '+error.message)
}
async function user(phone){
 const {data,error}=await client.auth.admin.createUser({phone:'88'+phone,password,phone_confirm:true})
 if(error||!data.user)throw Error('Synthetic identity: '+(error?.message??'Missing user'))
 return data.user.id
}
await insert('communities',{id:community,name:'Synthetic pilot booking UAT',slug:'synthetic-pilot-booking-'+id.slice(0,8)})
await insert('products',{id,name:'Synthetic butter for pilot booking',sku,category:'Groceries',unit:'pack',
 package_size:'1 kg',source_type:'PRIVATE_LABEL',active:true,is_demo:false})
const customer=await user(customerPhone)
const staff=await user(adminPhone)
const {error:profileError}=await client.from('profiles').update({
 full_name:'Pilot browser customer',phone:customerPhone,community_id:community,
 household_name:'Synthetic Pilot',onboarding_completed_at:new Date().toISOString()
}).eq('id',customer)
if(profileError)throw Error('Customer profile: '+profileError.message)
await insert('user_roles',{user_id:staff,role:'admin'})

const browser=await chromium.launch({headless:true})
const seenErrors=[]
async function signIn(page,phone,next){
 await page.goto(base+'/login?next='+encodeURIComponent(next),{waitUntil:'domcontentloaded'})
 await page.locator('[name="phone"]').fill(phone)
 await page.locator('[name="password"]').fill(password)
 await page.getByRole('button',{name:'Sign in with password',exact:true}).click()
 await page.waitForURL(url=>url.pathname===next.split('?')[0],{timeout:20000})
}
try{
 const customerPage=await browser.newPage({viewport:{width:390,height:844}})
 customerPage.on('pageerror',e=>seenErrors.push('customer: '+e.message))
 await customerPage.goto(base+'/pilot-book?product='+id,{waitUntil:'domcontentloaded'})
 assert.equal(new URL(customerPage.url()).pathname,'/login','Anonymous booking requires login')
 await signIn(customerPage,customerPhone,'/pilot-book?product='+id)
 await customerPage.getByRole('heading',{name:/Book your products/}).waitFor()
 assert.equal(await customerPage.locator('[name="product_id"]').inputValue(),id)
 await customerPage.locator('[name="quantity"]').fill('2')
 await customerPage.locator('[name="customer_note"]').fill('Please call before pickup')
 await customerPage.locator('[name="terms_accepted"]').check()
 await customerPage.getByRole('button',{name:/Submit booking request/}).click()
 await customerPage.waitForURL(url=>url.pathname==='/pilot-bookings',{timeout:20000})
 assert.match(await customerPage.locator('body').textContent()??'',/Synthetic butter for pilot booking/)
 const {data:records,error:orderError}=await client.from('pilot_booking_requests')
  .select('id,status,quantity,confirmed_unit_price,customer_id').eq('customer_id',customer)
 if(orderError)throw Error(orderError.message)
 assert.equal(records.length,1,'One real, non-payable booking persisted')
 assert.equal(records[0].quantity,2)
 assert.equal(records[0].status,'requested')
 assert.equal(records[0].confirmed_unit_price,null)
 const orderId=records[0].id
 const {data:staffNotifications,error:notificationsError}=await client.from('notifications')
  .select('id').eq('user_id',staff).eq('kind','pilot_booking')
 if(notificationsError)throw Error(notificationsError.message)
 assert.equal(staffNotifications.length,1,'Staff notified immediately')

 const staffContext=await browser.newContext({viewport:{width:1280,height:850}})
 const staffPage=await staffContext.newPage()
 staffPage.on('pageerror',e=>seenErrors.push('staff: '+e.message))
 await signIn(staffPage,adminPhone,'/admin/pilot-bookings')
 await staffPage.getByRole('heading',{name:/Customer booking inbox/}).waitFor()
 const card=staffPage.locator('article.card').filter({hasText:'Synthetic butter for pilot booking'})
 await card.locator('[name="unit_price"]').fill('1240')
 await card.locator('[name="delivery_fee"]').fill('0')
 await card.locator('[name="staff_note"]').fill('Agreed free pickup at the community point')
 await card.getByRole('button',{name:'Confirm booking'}).click()
 await staffPage.waitForURL(url=>url.pathname==='/admin/pilot-bookings'&&url.searchParams.has('notice'),{timeout:20000})
 const {data:confirmed,error:confirmedError}=await client.from('pilot_booking_requests')
  .select('status,confirmed_unit_price,confirmed_delivery_fee').eq('id',orderId).single()
 if(confirmedError)throw Error(confirmedError.message)
 assert.equal(confirmed.status,'confirmed')
 assert.equal(Number(confirmed.confirmed_unit_price),1240)
 assert.equal(Number(confirmed.confirmed_delivery_fee),0)
 await customerPage.goto(base+'/pilot-bookings',{waitUntil:'domcontentloaded'})
 assert.match(await customerPage.locator('body').textContent()??'',/৳2,480/)
 assert.match(await customerPage.locator('body').textContent()??'',/confirmed/i)

 const {data:financeState,error:financeError}=await client
  .schema('private').from('commerce_configuration').select('production_purchases_enabled').maybeSingle()
 // Supabase Data API may deliberately not expose private schema. This does not
 // authorize querying it from a user or weakening the SQL gate.
 if(!financeError&&financeState)assert.equal(financeState.production_purchases_enabled,false)
 assert.deepEqual(seenErrors,[],'No browser runtime errors')
 await staffContext.close()
 console.log('PASS: mobile booking request, admin notification, staff price confirmation, customer view; zero online payment.')
}finally{await browser.close()}
