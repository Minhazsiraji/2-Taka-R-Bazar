// Synthetic disposable Supabase only; never run with a hosted project URL.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {chromium} from 'playwright'
import {assertHeaderGeometry} from './header-layout-assertions.mjs'
const api=process.env.NEXT_PUBLIC_SUPABASE_URL
if(!api||new URL(api).hostname!=='127.0.0.1')throw new Error('Disposable local Supabase required')
const key=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
if(!key)throw new Error('Local fixture credential required')
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'}
async function insert(table,row){const r=await fetch(`${api}/rest/v1/${table}`,{method:'POST',headers,body:JSON.stringify(row)});if(!r.ok)throw new Error(`Fixture ${table}: ${r.status} ${await r.text()}`)}
const ids={community:'00000000-0000-4000-8000-000000000821',product:'00000000-0000-4000-8000-000000000822',pool:'00000000-0000-4000-8000-000000000823',item:'00000000-0000-4000-8000-000000000824'}
await insert('communities',{id:ids.community,name:'Synthetic browser community',slug:'synthetic-browser-community'})
await insert('products',{id:ids.product,name:'Synthetic browser rice',category:'Rice',package_size:'1 kg',unit:'bag',sku:'synthetic-browser-rice',active:true,is_demo:false,source_type:'PRIVATE_LABEL',image_url:null})
await insert('pools',{id:ids.pool,community_id:ids.community,title:'Synthetic browser Pool',status:'open',cadence:'weekly',opens_at:new Date(Date.now()-60000).toISOString(),commitment_closes_at:new Date(Date.now()+86400000).toISOString(),confirmation_closes_at:new Date(Date.now()+172800000).toISOString()})
await insert('pool_items',{id:ids.item,pool_id:ids.pool,product_id:ids.product,benchmark_price_snapshot:100})
const email='storefront-browser-admin@example.invalid'
const password=randomUUID()+'aA1!'
const created=await fetch(`${api}/auth/v1/admin/users`,{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true})})
if(!created.ok)throw new Error('Local synthetic admin creation failed')
const user=await created.json()
await insert('user_roles',{user_id:user.id,role:'admin'})
const signed=await fetch(`${api}/auth/v1/token?grant_type=password`,{method:'POST',headers,body:JSON.stringify({email,password})})
if(!signed.ok)throw new Error('Local synthetic admin sign-in failed')
const session=await signed.json()
const published=await fetch(`${api}/rest/v1/rpc/admin_publish_storefront_pool`,{method:'POST',headers:{...headers,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({p_pool_id:ids.pool,p_product_ids:[ids.product],p_published:true,p_sort_order:100})})
if(!published.ok)throw new Error(`Authorized publication failed: ${published.status} ${await published.text()}`)
const browser=await chromium.launch({headless:true})
const errors=[]
try{
 const legacy = await fetch('http://127.0.0.1:3000/home?notice=legacy-bookmark', {redirect: 'manual'})
 assert.equal(legacy.status, 308)
 const location = new URL(legacy.headers.get('location'), 'http://127.0.0.1:3000')
 assert.equal(location.pathname, '/')
 assert.equal(location.searchParams.get('notice'), 'legacy-bookmark')
 for(const width of [320,360,393,640,768,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:900}})
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'})
  await page.getByRole('heading',{name:'Synthetic browser Pool',exact:true}).waitFor()
  if(width===393){
   const toggle=page.locator('.market-flat-header .market-single-language')
   // Brand-new browser context is English, and the button offers BAN.
   assert.equal((await toggle.innerText()).trim(),'BAN')
   await toggle.click()
   assert.equal((await toggle.innerText()).trim(),'EN')
   await page.reload({waitUntil:'networkidle'})
   assert.equal((await toggle.innerText()).trim(),'EN','BAN choice must survive full reload')
   assert.equal((await page.context().cookies()).some(c=>c.name==='2tbr_storefront_language'&&c.value==='bn'),true)
   await toggle.click()
   assert.equal((await toggle.innerText()).trim(),'BAN')
   await page.reload({waitUntil:'networkidle'})
   assert.equal((await toggle.innerText()).trim(),'BAN','EN choice must survive full reload')
  }
  await assertHeaderGeometry(page,'.market-brand-copy strong','.market-header-actions',width)
  if(width===393)await page.screenshot({path:'/tmp/2tbr-header-storefront-guest.png',fullPage:true})
  assert.equal(await page.locator('.market-pool-demo-pill').count(),0)
  assert.equal(await page.locator('.market-pool-thumbnails a').first().getAttribute('href'),`/shop/${ids.product}?area=${ids.community}`)
  const poolText=await page.locator('.market-featured-pool').innerText()
  assert.ok(!poolText.includes('নমুনা'))
  assert.ok(poolText.includes('Price pending'))
  const dock=page.locator('.market-storefront-dock')
  assert.equal(await dock.isVisible(),width<768)
  if(width<768)assert.equal(await dock.evaluate(e=>getComputedStyle(e).position),'fixed')
  const links=await page.locator('footer a[href^="mailto:"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')))
  assert.deepEqual(links,['mailto:business@2takarbazar.com','mailto:support@2takarbazar.com','mailto:business@agentsiraji.com'])
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.getByRole('button',{name:'Switch to dark mode'}).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
  assert.equal(await dock.isVisible(),width<768)
  await page.locator('.market-pool-thumbnail').first().click()
  await page.getByRole('heading',{name:'Synthetic browser rice',exact:true}).first().waitFor()
  assert.ok(!page.url().includes('/login'))
  await page.getByRole('link',{name:'Sign in to join',exact:true}).click()
  await page.waitForURL(url=>url.pathname==='/login')
  assert.ok(page.url().includes('/login'))
  assert.ok(!page.url().includes('/demo-'))
  await page.close()
 }
 assert.deepEqual(errors,[])
 console.log('Storefront real-RPC → responsive UI → public product → gated login UAT passed at seven widths, with header geometry checks')
}finally{await browser.close()}
