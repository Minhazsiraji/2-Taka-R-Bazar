import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
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
