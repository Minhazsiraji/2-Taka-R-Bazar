// Synthetic disposable Supabase only; never run with a hosted project URL.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {chromium} from 'playwright'
import {assertHeaderGeometry, assertCustomerPageHeader} from './header-layout-assertions.mjs'
import {assertMobileDock} from './mobile-dock-assertions.mjs'
import {assertCustomerChrome} from './customer-chrome-assertions.mjs'
const api=process.env.NEXT_PUBLIC_SUPABASE_URL
if(!api||new URL(api).hostname!=='127.0.0.1')throw new Error('Disposable local Supabase required')
const key=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
if(!key)throw new Error('Local fixture credential required')
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'}
async function insert(table,row,requestHeaders=headers){const r=await fetch(`${api}/rest/v1/${table}`,{method:'POST',headers:requestHeaders,body:JSON.stringify(row)});if(!r.ok)throw new Error(`Fixture ${table}: ${r.status} ${await r.text()}`)}
async function assertReviewLayout(page,width){
 const card=page.locator('#customer-experiences .market-review-pending')
 await card.waitFor()
 const geometry=await card.evaluate(element=>{
  const bounds=x=>x.getBoundingClientRect()
  const cardBox=bounds(element)
  const copyBox=bounds(element.children[1])
  const noteBox=bounds(element.querySelector('.market-review-note'))
  return {cardWidth:cardBox.width,cardHeight:cardBox.height,copyWidth:copyBox.width,
   copyTop:copyBox.top,noteBottom:noteBox.bottom,
   copyLeft:copyBox.left,cardLeft:cardBox.left,copyRight:copyBox.right,cardRight:cardBox.right,
   documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth}
 })
 assert.ok(geometry.documentWidth<=geometry.viewportWidth,`No horizontal overflow at ${width}px`)
 assert.ok(geometry.copyLeft>=geometry.cardLeft-1&&geometry.copyRight<=geometry.cardRight+1,`Review copy stays inside its card at ${width}px`)
 if(width<=767){
  assert.ok(geometry.copyWidth>=geometry.cardWidth*.72,`Review copy must not be squeezed into a narrow mobile column at ${width}px: ${JSON.stringify(geometry)}`)
  assert.ok(geometry.copyTop>=geometry.noteBottom-1,`Review copy must flow below verified label at ${width}px`)
  assert.ok(geometry.cardHeight<560,`Review card should remain compact at ${width}px`)
 }
}
async function assertUnifiedApprovedHome(page,width){
 const mobile=page.locator('.mhome')
 await mobile.waitFor({state:'visible'})
 assert.equal(await page.locator('.market-legacy-home').isVisible(),false,'Only the approved mobile home is visible')
 const headings=await mobile.locator('.mhome-section-heading h2').allTextContents()
 assert.deepEqual(headings,['Group Deals','Exclusive Products','Community Pools'])
 assert.equal((await mobile.locator('.mhome-savings-heading h2').textContent())?.trim(),'Your savings')
 const columns=await mobile.locator('.mhome-savings-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length)
 assert.equal(columns,4,'All four verified savings tiles must fit in one row at '+width+'px')
 assert.equal(await mobile.locator('.mhome-savings-card').count(),4,'Four safely derived savings cards are present')
 assert.ok(await mobile.locator('.mhome-savings-grid').isVisible(),'Savings grid is visible on every viewport')
 const hero=mobile.locator('.mhome-hero')
 await hero.getByRole('heading',{level:1}).waitFor()
 const title=await hero.getByRole('heading',{level:1}).textContent()
 await hero.getByRole('button',{name:'Next banner'}).click()
 assert.notEqual(await hero.getByRole('heading',{level:1}).textContent(),title)
 assert.equal(await page.locator('.market-brand-copy').isVisible(),true)
 const labels=await page.locator('.market-storefront-dock .app-mobile-nav-link').allTextContents()
 assert.deepEqual(labels,['Home','Pools','Deals','Exclusive','Cart'])
 assert.equal(await page.locator('.market-storefront-dock .mhome-dock-icon').count(),5)
 assert.ok(await mobile.locator('.mhome-pool-card').count()>=1,'Published Pool in compact mobile row')
 const overflow=await page.evaluate(()=>({
  scroll:document.documentElement.scrollWidth,viewport:innerWidth,
  cards:[...document.querySelectorAll('.mhome-deal-card,.mhome-exclusive-card,.mhome-pool-card')]
   .map(x=>({right:x.getBoundingClientRect().right,width:x.getBoundingClientRect().width})),
 }))
 assert.ok(overflow.scroll<=overflow.viewport, 'Approved mobile design no horizontal overflow at '+width+': '+JSON.stringify(overflow))
 for(const c of overflow.cards)assert.ok(c.right<=width+1&&c.width>0,'Mobile card must fit viewport at '+width)
}
const ids={community:'00000000-0000-4000-8000-000000000821',product:'00000000-0000-4000-8000-000000000822',pool:'00000000-0000-4000-8000-000000000823',item:'00000000-0000-4000-8000-000000000824'}
await insert('communities',{id:ids.community,name:'Synthetic browser community',slug:'synthetic-browser-community'})
// QR codes are operator-provisioned, with no public/client insert grant. Seed
// only this disposable localhost DB; retain the deployed permission boundary.
execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',"insert into public.community_qr_codes(code,community_id,campaign_name) values ('UAT-UI-SHELL','00000000-0000-4000-8000-000000000821','Synthetic customer UI qualification')"],{env:{...process.env,PGPASSWORD:'postgres'},stdio:'pipe'})
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
await insert('own_product_showcase',{product_id:ids.product,published:true,description:'Synthetic UI qualification product'},{...headers,Authorization:`Bearer ${session.access_token}`})
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
 for(const width of [320,360,393,430,640,767,768,790,820,1024,1100,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:900}})
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'domcontentloaded',timeout:60000})
  await page.locator('.mhome').waitFor({state:'visible'})
  await page.getByRole('heading',{name:'Synthetic browser Pool',exact:true}).waitFor()
  if(width===393){
   const toggle=page.locator('.market-flat-header .market-single-language')
   // Brand-new browser context is English, and the button offers BAN.
   assert.equal((await toggle.innerText()).trim(),'BAN')
   await toggle.click()
   assert.equal((await toggle.innerText()).trim(),'EN')
   // All viewports now share the same approved responsive component tree.
   await page.reload({waitUntil:'domcontentloaded',timeout:60000})
   assert.equal((await toggle.innerText()).trim(),'EN','BAN choice must survive full reload')
   assert.equal((await page.context().cookies()).some(c=>c.name==='2tbr_storefront_language'&&c.value==='bn'),true)
   await toggle.click()
   assert.equal((await toggle.innerText()).trim(),'BAN')
   await page.reload({waitUntil:'domcontentloaded',timeout:60000})
   assert.equal((await toggle.innerText()).trim(),'BAN','EN choice must survive full reload')
  }
  assert.equal(await page.locator('header .market-header-location').count(),0)
  assert.equal(await page.locator('.customer-notification-bell').count(),1)
  await assertCustomerChrome(page,width)
  if([768,820,1024].includes(width))await page.screenshot({path:'/tmp/2tbr-header-tablet-brand-'+width+'.png'})
  if(width===393)await page.screenshot({path:'/tmp/2tbr-header-storefront-guest.png',fullPage:true})
  await assertUnifiedApprovedHome(page,width)
  const savingsColumns=await page.locator('.mhome-savings-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)
  assert.equal(savingsColumns,width<768?2:4,'Approved savings cards respond to viewport')
  const dock=page.locator('.market-storefront-dock')
  assert.equal(await dock.isVisible(),width<768)
  if(width<768)assert.equal(await dock.evaluate(e=>getComputedStyle(e).position),'fixed')
  await assertMobileDock(page,width)
  const links=await page.locator('footer a[href^="mailto:"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')))
  assert.deepEqual(links,['mailto:business@2takarbazar.com','mailto:support@2takarbazar.com','mailto:business@agentsiraji.com'])
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  if([393,820,1440].includes(width))await page.locator('.mhome').screenshot({path:'/tmp/2tbr-approved-unified-home-'+width+'-en.png'})
  await page.locator('header').getByRole('button',{name:'Switch to dark mode'}).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
  await assertCustomerChrome(page,width)
  assert.equal(await dock.isVisible(),width<768)
  await assertMobileDock(page,width)
  await assertUnifiedApprovedHome(page,width)
  if([393,820,1440].includes(width))await page.locator('.mhome').screenshot({path:'/tmp/2tbr-approved-unified-home-'+width+'-dark.png'})
  if(width===393){
   await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}))
   await page.screenshot({path:'/tmp/2tbr-header-dock-storefront-footer.png'})
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  }
  await page.locator('.mhome-pool-photos a').first().click()
  await page.waitForURL(url=>url.pathname==='/shop/'+ids.product)
  await page.getByRole('heading',{name:'Synthetic browser rice',exact:true,level:1}).waitFor()
  await assertCustomerChrome(page,width)
  assert.ok(!page.url().includes('/login'))
  await page.getByRole('link',{name:'Sign in to join',exact:true}).click()
  await page.waitForURL(url=>url.pathname==='/login')
  assert.ok(page.url().includes('/login'))
  assert.ok(!page.url().includes('/demo-'))
  await page.close()
 }
 const infoPage=await browser.newPage({viewport:{width:393,height:900}})
 infoPage.on('pageerror',e=>errors.push(e.message))
 for(const path of ['/login','/signup','/about','/faq','/privacy','/terms','/refund-policy','/return-policy','/products/'+ids.product,'/community-invite/UAT-UI-SHELL','/shop/invalid']){
  await infoPage.goto('http://127.0.0.1:3000'+path,{waitUntil:'domcontentloaded'})
  await infoPage.locator('.market-flat-header').waitFor()
  for(const width of [320,393,768,820,1024,1440]){
   await infoPage.setViewportSize({width,height:900})
   await assertCustomerChrome(infoPage,width)
   await assertMobileDock(infoPage,width)
   await infoPage.locator('header').getByRole('button',{name:'Switch to dark mode',exact:true}).click()
   await assertCustomerChrome(infoPage,width)
   await infoPage.locator('header').getByRole('button',{name:'Switch to light mode',exact:true}).click()
  }
 }
 await infoPage.goto('http://127.0.0.1:3000/about',{waitUntil:'networkidle'})
 await infoPage.locator('.market-single-language').click()
 await infoPage.reload({waitUntil:'networkidle'})
 assert.equal(await infoPage.locator('.market-single-language').innerText(),'EN')
 assert.equal(await infoPage.locator('footer').getAttribute('lang'),'bn')
 await assertCustomerChrome(infoPage,1440)
 await infoPage.locator('.market-single-language').click()
 const guestStatus=await infoPage.request.get('http://127.0.0.1:3000/api/notifications/status')
 assert.deepEqual(await guestStatus.json(),{authenticated:false,unread:0,latest:null})
 assert.match(guestStatus.headers()['cache-control'],/no-store/)
 await infoPage.close()
 console.log('Compact public header UAT passed: login, signup and six information/policy pages at four widths.')
 assert.deepEqual(errors,[])
 console.log('Storefront real-RPC → responsive UI → public product → gated login UAT passed at seven widths, with header geometry checks')
}finally{await browser.close()}
