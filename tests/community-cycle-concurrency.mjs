import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {createServerClient} from '@supabase/ssr'
import {chromium} from 'playwright'
const api=process.env.NEXT_PUBLIC_SUPABASE_URL??''
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??''
const secret=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY??''
if(new URL(api).hostname!=='127.0.0.1'||!secret||!key)throw Error('Disposable localhost only')
const svc=createClient(api,secret,{auth:{persistSession:false,autoRefreshToken:false}})
const sid=randomUUID().slice(0,8),a=randomUUID(),b=randomUUID(),product=randomUUID()
async function must(result,label){assert.ifError(result.error,label);return result.data}
const identities=[]
for(let i=0;i<9;i++){
 const email='scenario-'+sid+'-'+i+'@example.invalid',password='NotReal-'+randomUUID()+'A1!'
 const response=await svc.auth.admin.createUser({email,password,email_confirm:true})
 const user=(await must(response,'create fictional account')).user
 identities.push({id:user.id,email,password})
}
await must(await svc.from('user_roles').insert([{user_id:identities[0].id,role:'admin'},{user_id:identities[8].id,role:'admin'}]),'two independent admins')
await must(await svc.from('communities').insert([
 {id:a,name:'Parallel A '+sid,slug:'parallel-a-'+sid},
 {id:b,name:'Parallel B '+sid,slug:'parallel-b-'+sid}
]),'communities')
await must(await svc.from('products').insert({
 id:product,name:'Parallel Rice '+sid,category:'Rice',package_size:'1 kg',unit:'kg',sku:'CONCURRENT-'+sid,
 source_type:'SUPPLIER_POOL',active:true,is_demo:false
}),'product')
const buyers=[]
for(let i=1;i<8;i++){
 await must(await svc.from('profiles').update({
  full_name:'Fictional Buyer '+i,household_name:'Fictional Household '+i,
  phone:'017000001'+String(i).padStart(2,'0'),community_id:i>=6?b:a,
  onboarding_completed_at:new Date().toISOString()
 }).eq('id',identities[i].id),'complete fictional onboarding')
 const client=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}})
 await must(await client.auth.signInWithPassword({email:identities[i].email,password:identities[i].password}),'sign in')
 buyers.push(client)
}
const creator=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}})
await must(await creator.auth.signInWithPassword({email:identities[0].email,password:identities[0].password}),'sign in admin')
const tiers=[
 {threshold:3,prices:[{product_id:product,price:150}]},
 {threshold:5,prices:[{product_id:product,price:140}]}
]
const offer=await must(await creator.rpc('admin_save_simple_offer_with_tiers',{
 p_id:null,p_kind:'GROUP_DEAL',p_communities:[a,b],p_title:'Simultaneous Scenario '+sid,
 p_items:[{product_id:product,price:160,old_price:200,available_quantity:100}],
 p_published:true,p_closes:new Date(Date.now()+7*864e5).toISOString(),p_tiers:tiers
}),'save offer')
const submit=(client,area)=>client.rpc('join_simple_sale_group_deal_quantified',{
 p_offer:offer,p_product:product,p_area:area,p_quantity:1
})
// All members join at once. Area A ends at 5; Area B remains at 2.
const joins=await Promise.all(buyers.map((client,index)=>submit(client,index>=5?b:a)))
for(let i=0;i<joins.length;i++)assert.ifError(joins[i].error,'concurrent customer '+i)
const rows=await must(await svc.from('simple_sale_cycles').select('id,community_id,status,cycle_number,locked_threshold,next_cycle_id').eq('offer_id',offer),'get cycles')
const closedA=rows.find(r=>r.community_id===a&&r.status==='closed')
const openA=rows.find(r=>r.community_id===a&&r.status==='open')
const openB=rows.find(r=>r.community_id===b&&r.status==='open')
assert.ok(closedA&&openA&&openB,'independent A closure and B open')
assert.equal(closedA.locked_threshold,5)
assert.equal(closedA.next_cycle_id,openA.id)
async function count(id){
 const r=await svc.from('simple_sale_cycle_members').select('customer_id',{count:'exact',head:true}).eq('cycle_id',id)
 assert.ifError(r.error);return r.count
}
assert.equal(await count(closedA.id),5)
assert.equal(await count(openA.id),0)
assert.equal(await count(openB.id),2)
const quotes=await must(await svc.from('simple_sale_cycle_quotes').select('product_total').eq('cycle_id',closedA.id),'quotes')
assert.equal(quotes.length,5)
assert.ok(quotes.every(q=>Number(q.product_total)===140))
console.log('PASS parallel 7 customers: independent A 5/5 B 2/5; exactly five locked quotes; new A UUID empty')


// Browser UAT: six fictional customers + maker/checker roles, with NO real bank transfer.
// Guard: this is disposable localhost-only. All auth and payment records are test fixtures.
const base=process.env.NEXT_PUBLIC_SITE_URL??'http://127.0.0.1:3000'
if(new URL(base).hostname!=='127.0.0.1')throw Error('Browser UAT must run only against local website')
const pickupId=randomUUID(),recipientId=randomUUID()
await must(await svc.from('pickup_points').insert({
 id:pickupId,community_id:a,name:'Parallel Test Gate',address:'Synthetic avenue, mock community gate',active:true
}),'test gate')
await must(await svc.from('pilot_payment_recipients').insert({
 id:recipientId,method:'bkash',account_name:'Fictional bank account',account_number:'01700000000',
 active:true,configured_by:identities[0].id
}),'fictional recipient')
const byOwner=await must(await svc.from('simple_sale_cycle_quotes').select('id,product_total,status').eq('cycle_id',closedA.id).eq('customer_id',identities[1].id).single(),'locked quote')
assert.equal(Number(byOwner.product_total),140)
const quoteId=byOwner.id
async function awaitQuote(fields,predicate,label){
 let row
 for(let attempt=0;attempt<50;attempt++){
  row=await must(await svc.from('simple_sale_cycle_quotes').select(fields).eq('id',quoteId).single(),label)
  if(predicate(row))return row
  await new Promise(resolve=>setTimeout(resolve,200))
 }
 throw Error(label+' was not persisted: '+JSON.stringify(row))
}
async function makeSession(index){
 const jar=new Map(),auth=createServerClient(api,key,{
  cookies:{getAll:()=>[...jar.values()],setAll:list=>list.forEach(c=>jar.set(c.name,c))}
 })
 await must(await auth.auth.signInWithPassword({email:identities[index].email,password:identities[index].password}),'browser sign in')
 return [...jar.values()].filter(c=>c.value).map(c=>({name:c.name,value:c.value,url:base,sameSite:'Lax',secure:false}))
}
const browser=await chromium.launch({headless:true})
try{
 const customerCtx=await browser.newContext(),adminCtx=await browser.newContext(),checkerCtx=await browser.newContext()
 await customerCtx.addCookies(await makeSession(1))
 await adminCtx.addCookies(await makeSession(0))
 await checkerCtx.addCookies(await makeSession(8))
 const customer=await customerCtx.newPage(),makerPage=await adminCtx.newPage(),checkerPage=await checkerCtx.newPage()
 await customer.goto(base+'/account/commitments',{waitUntil:'networkidle'})
 const accountCard=customer.locator('article').filter({hasText:quoteId.slice(0,8).toUpperCase()})
 assert.equal(await accountCard.count(),1,'Buyer has exactly one matching final quote')
 assert.match(await accountCard.innerText(),/Locked product amount:.*140/s)
 await accountCard.locator('select[name="fulfillment"]').selectOption('pickup')
 await accountCard.locator('select[name="pickup_point_id"]').selectOption(pickupId)
 await accountCard.getByRole('button',{name:'Submit delivery preference'}).click()
 // A React server-action click can return before the database transaction finishes.
 // Poll actual persisted data instead of assuming immediate DOM/navigation completion.
 let q
 for(let attempt=0;attempt<50;attempt++){
  q=await must(await svc.from('simple_sale_cycle_quotes').select('status,fulfillment,pickup_point_id').eq('id',quoteId).single(),'pickup persisted')
  if(q.fulfillment==='pickup'&&q.pickup_point_id===pickupId)break
  await new Promise(resolve=>setTimeout(resolve,200))
 }
 if(q.fulfillment!=='pickup'||q.pickup_point_id!==pickupId)
  throw Error('Pickup not saved after server action: '+JSON.stringify({quote:q,url:customer.url(),page:await customer.locator('main').innerText()}))
 await makerPage.goto(base+'/admin/offer-settlement',{waitUntil:'networkidle'})
 const staffCard=makerPage.locator('article').filter({hasText:quoteId.slice(0,8).toUpperCase()})
 assert.equal(await staffCard.count(),1,'Staff can see customer quote')
 await staffCard.locator('input[name="delivery_fee"]').fill('30')
 await staffCard.getByRole('button',{name:'Publish complete quote'}).click()
 await awaitQuote('status,delivery_fee',r=>r.status==='quoted'&&Number(r.delivery_fee)===30,'Final delivery fee')
 await customer.goto(base+'/account/commitments',{waitUntil:'networkidle'})
 const quoted=customer.locator('article').filter({hasText:quoteId.slice(0,8).toUpperCase()})
 assert.match(await quoted.innerText(),/Total:.*170/s,'Product + delivery fee shown')
 await quoted.locator('input[name="contact_name"]').fill('Fictional buyer')
 await quoted.locator('input[name="contact_phone"]').fill('01700000101')
 await quoted.locator('input[name="terms"]').check()
 await quoted.getByRole('button',{name:'Accept ৳170'}).click()
 await customer.getByText('Pay exactly',{exact:false}).waitFor({timeout:16000})
 const accepted=customer.locator('article').filter({hasText:quoteId.slice(0,8).toUpperCase()})
 await accepted.locator('select[name="recipient_id"]').selectOption(recipientId)
 await accepted.locator('input[name="reference"]').fill('FICTIONAL-ONLY-'+sid)
 await accepted.getByRole('button',{name:'Submit transfer for independent checking'}).click()
 const submitted=await awaitQuote('status,order_id',r=>r.status==='payment_submitted','Waiting transfer')
 assert.equal(submitted.status,'payment_submitted');assert.equal(submitted.order_id,null)
 // Maker must not verify their own fee quote, even if a direct RPC is attempted.
 const makerAttempt=await creator.rpc('admin_verify_simple_sale_payment',{p_quote:quoteId,p_verified_amount:170,p_bank_confirmed:true})
 assert.ok(makerAttempt.error,'Quote maker cannot approve fictional payment')
 await checkerPage.goto(base+'/admin/offer-settlement',{waitUntil:'networkidle'})
 const review=checkerPage.locator('article').filter({hasText:quoteId.slice(0,8).toUpperCase()})
 assert.equal(await review.count(),1)
 await review.locator('input[name="verified_amount"]').fill('170')
 await review.locator('input[name="independent_confirmation"]').check()
 await review.getByRole('button',{name:'Verify transfer and create order once'}).click()
 const result=await awaitQuote('status,order_id',r=>r.status==='verified'&&Boolean(r.order_id),'Verified quote')
 assert.equal(result.status,'verified');assert.ok(result.order_id)
 const order=await must(await svc.from('launch_orders').select('id,status,total_amount,payment_status').eq('id',result.order_id).single(),'exact confirmed order')
 assert.equal(order.status,'confirmed');assert.equal(order.payment_status,'verified')
 assert.equal(Number(order.total_amount),170)
 assert.equal((await count(openA.id)),0,'New cycle not affected by closing previous')
 const reviewer=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}})
 await must(await reviewer.auth.signInWithPassword({email:identities[8].email,password:identities[8].password}),'reviewer sign in')
 assert.equal(await must(await reviewer.rpc('admin_verify_simple_sale_payment',{p_quote:quoteId,p_verified_amount:170,p_bank_confirmed:true}),'repeat payment verification'),result.order_id,'No duplicate order')
 await customer.goto(base+'/account/commitments',{waitUntil:'networkidle'})
 assert.equal(await customer.getByRole('link',{name:'View confirmed order'}).count(),1)
 console.log('PASS fictional browser settlement: pickup, delivery quote, exact consent, transfer submitted, independent approval, 1 confirmed order, replay-safe')
}finally{await browser.close()}
