// Browser UAT refuses hosted Supabase and uses synthetic accounts in disposable local DB.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
const db=process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secret=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
const base='http://127.0.0.1:3000'
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(db??'')||
 db!==process.env.FINANCE_PREVIEW_SUPABASE_URL||process.env.FINANCE_WRITES_ENABLED!=='true'||
 process.env.VERCEL_ENV!=='preview'||!key||!secret)
 throw new Error('Refusing browser UAT outside disposable local Supabase')
const supa=createClient(db,secret,{auth:{persistSession:false,autoRefreshToken:false}})
function psql(sql){
 return execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-tAX',
 '-v','ON_ERROR_STOP=1','-c',sql],{env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8'}).trim()
}
const identities=new Map()
async function viewer(role,identityKey=role){
 const email='uat-'+role+'-'+Date.now()+'@example.invalid'
 const password='LOCAL-ONLY-Synthetic!349'
 const {data,error}=await supa.auth.admin.createUser({email,password,email_confirm:true})
 if(error||!data?.user?.id)throw new Error('Synthetic user failed '+error?.message)
 const id=data.user.id
 assert.match(id,/^[0-9a-f-]{36}$/i)
 assert.ok(['admin','super_admin','customer'].includes(role))
 psql("insert into public.user_roles(user_id,role) values('"+id+"','"+role+"') on conflict do nothing")
 if(role!=='customer')psql("insert into private.finance_uat_leases(actor_id,expires_at,reason) values('"+id+"',clock_timestamp()+interval '1 hour','Issue 57 disposable browser maker checker UAT')")
 const jar=new Map()
 const client=createServerClient(db,key,{cookies:{
  getAll:()=>[...jar.values()].map(c=>({name:c.name,value:c.value})),
  setAll:cookies=>{for(const cookie of cookies)jar.set(cookie.name,cookie)}
 }})
 const login=await client.auth.signInWithPassword({email,password})
 if(login.error||!login.data.user)throw new Error('Local synthetic login failed '+login.error?.message)
 identities.set(identityKey,{client,id})
 return [...jar.values()].filter(c=>c.value).map(c=>({
  name:c.name,value:c.value,url:base,httpOnly:c.options?.httpOnly??false,
  secure:false,sameSite:'Lax'
 }))
}
async function visit(page,path,heading){
 const res=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:90000})
 assert.ok(res&&res.status()<500,'Server failed '+path+' '+res?.status())
 await page.getByRole('heading',{name:heading}).first().waitFor({timeout:90000})
 assert.ok(!page.url().includes('/login'),'Unexpected login redirect '+path)
}
async function assertFinancialDesign(page,label) {
 await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{})
 await page.waitForTimeout(500)
 await page.waitForFunction(()=>{const h=document.querySelector('.finance-ops-hero');return Boolean(h&&h.isConnected&&getComputedStyle(h).backgroundImage.includes('linear-gradient'))},null,{timeout:20000})
 await page.waitForFunction(()=>{const hero=document.querySelector('.finance-ops-hero'),panel=document.querySelector('.finance-panel');return Boolean(hero&&panel&&getComputedStyle(hero).backgroundImage.includes('linear-gradient')&&getComputedStyle(panel).backgroundImage.includes('linear-gradient'))},null,{timeout:20000})
 const summary=await page.locator('.finance-ops-hero').evaluate(el=>{
  const css=getComputedStyle(el),title=el.querySelector('h1'),headCss=title?getComputedStyle(title):null
  return {height:el.getBoundingClientRect().height,gradient:css.backgroundImage,
   titleColor:headCss?.color,scroll:document.documentElement.scrollWidth,viewport:innerWidth}
 })
 assert.ok(summary.gradient.includes('linear-gradient'),label+' hero lost its brand gradient')
 assert.equal(summary.titleColor,'rgb(18, 48, 68)',label+' hero title should be dark ink on pearl glass')
 assert.ok(summary.height<390,label+' hero distorted: '+summary.height+'px')
 assert.ok(summary.scroll<=summary.viewport+1,label+' overflows viewport')
 const panel=await page.locator('.finance-panel').first().evaluate(el=>{const z=getComputedStyle(el);return {gradient:z.backgroundImage,border:z.borderTopColor}})
 assert.ok(panel.gradient.includes('linear-gradient'),label+' glass panel must have nonempty material gradient')
 assert.notEqual(panel.border,'rgba(0, 0, 0, 0)',label+' glass panel must have visible rim')
 const headGlass=await page.locator('.app-shell-header-bar').evaluate(el=>{
  const z=getComputedStyle(el)
  return {background:z.backgroundImage,border:z.borderTopColor,shadow:z.boxShadow,blur:z.backdropFilter}
 })
 const cardGlass=await page.locator('.finance-panel').first().evaluate(el=>{
  const z=getComputedStyle(el)
  return {background:z.backgroundImage,border:z.borderTopColor,shadow:z.boxShadow,blur:z.backdropFilter}
 })
 console.log('HEADER_GLASS_PARITY '+label+' '+JSON.stringify({head:headGlass,card:cardGlass}))
 const heroGlass=await page.locator('.finance-ops-hero').evaluate(el=>{
  const z=getComputedStyle(el)
  return {background:z.backgroundImage,border:z.borderTopColor,shadow:z.boxShadow,blur:z.backdropFilter}
 })
 console.log('HERO_GLASS_PARITY '+label+' '+JSON.stringify({head:headGlass,hero:heroGlass}))
 assert.equal(heroGlass.background,headGlass.background,label+' hero must share header glass gradient')
 assert.equal(heroGlass.border,headGlass.border,label+' hero must share header pearl rim')
 assert.equal(heroGlass.shadow,headGlass.shadow,label+' hero must share header shadow recipe')
 const blurDebug=await page.locator('.finance-ops-hero').first().evaluate(el=>{
  const matching=[]
  function scan(rules){
   for(const r of rules){
    if('cssRules'in r){try{scan(r.cssRules)}catch{}}
    if(!('selectorText'in r)||!r.style)continue
    const value=r.style.getPropertyValue('backdrop-filter')
    if(!value)continue
    try{if(el.matches(r.selectorText))matching.push({selector:r.selectorText.slice(0,260),value,priority:r.style.getPropertyPriority('backdrop-filter')})}catch{}
   }
  }
  for(const sh of document.styleSheets){try{scan(sh.cssRules)}catch{}}
  const computed=getComputedStyle(el)
  return {tag:el.tagName,classes:el.className,style:el.getAttribute('style'),computed:computed.backdropFilter,
   targetedOverride:el.matches('html body.site-glass-root main .finance-ops-surface.finance-ops-surface > section.finance-ops-hero.finance-ops-hero'),
   perfRule:el.matches('.site-glass-root main :is(section,article,form,div)[class*="rounded-"]:not([class*="rounded-full"]):not(.card):not(.table-wrap):not(.finance-ops-hero)'),
   matchedRules:matching.slice(-32)}
 })
 console.log('FINANCE_BLUR_CASCADE_DIAGNOSTIC '+label+' '+JSON.stringify(blurDebug))
 assert.equal(heroGlass.blur,headGlass.blur,label+' hero must match header backdrop blur on desktop')
 assert.equal(cardGlass.background,headGlass.background,label+' content card must share header glass gradient')
 assert.equal(cardGlass.border,headGlass.border,label+' content card must share header pearl rim')
 assert.equal(cardGlass.shadow,headGlass.shadow,label+' content card must share header shadow recipe')

 assert.ok(cardGlass.background.includes('linear-gradient'),label+' must have pearl glass gradient')
 assert.equal(cardGlass.blur,headGlass.blur,label+' card must match header backdrop blur on desktop')
 assert.ok(cardGlass.shadow!=='none',label+' must have molded glass shadow')
 console.log('PASS '+label+' financial brand contrast and layout')
}

async function snapshot(page,label){
 for(const width of [1440,768,360]){
  await page.setViewportSize({width,height:900})
  await page.screenshot({path:'artifacts/'+label+'-'+width+'.png',fullPage:true,timeout:60000})
 }
 await page.setViewportSize({width:1440,height:900})
}
async function main(){
 await mkdir('artifacts',{recursive:true})
 // Retain the fully asserted synthetic supply chain only in this disposable DB.
 // No hosted target is accepted by the guard above; CI destroys the entire stack.
 const fixture=readFileSync('tests/supply-handover-e2e.sql','utf8').replace('\\ir finance-customer-lifecycle-e2e.sql','\\i tests/finance-customer-lifecycle-e2e.sql').replace(/rollback;\s*$/,'set constraints all immediate; commit;')
 execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{
  input:fixture,env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8',stdio:['pipe','pipe','pipe']})
 const ownerCookie=await viewer('super_admin')
 const makerCookie=await viewer('admin')
 const browser=await chromium.launch({headless:true})
 let stages=0
 try{
  const ownerContext=await browser.newContext({viewport:{width:1440,height:900}})
  const makerContext=await browser.newContext({viewport:{width:1440,height:900}})
  await ownerContext.addCookies(ownerCookie)
  await makerContext.addCookies(makerCookie)
  const owner=await ownerContext.newPage(),maker=await makerContext.newPage()
  await visit(owner,'/super-admin/finance','Finance intelligence')
  await assertFinancialDesign(owner,'Finance')
  await snapshot(owner,'finance')
  console.log('PASS Finance Control 1440/768/360');stages++
  await visit(owner,'/super-admin/treasury','Cash flow & liquidity')
  await assertFinancialDesign(owner,'Treasury')
  await snapshot(owner,'treasury')
  console.log('PASS Treasury 1440/768/360');stages++
  // The deployed screenshots showed milky pills and bars; verify the actual
  // computed styles AND hover label, not just presence of HTML/classes.
  await visit(owner,'/super-admin/finance?demo=1','Finance intelligence')
  await owner.locator('.finance-hero-badge').waitFor({state:'visible',timeout:20000})
  await owner.waitForFunction(()=>{const el=document.querySelector('.finance-hero-badge');if(!el||!el.isConnected)return false;const css=getComputedStyle(el);return css.backgroundColor==='rgb(195, 247, 239)'&&css.color==='rgb(6, 63, 67)'},null,{timeout:20000})
  const badge=await owner.locator('.finance-hero-badge').evaluate(el=>({
   background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color
  }))
  assert.equal(badge.background,'rgb(195, 247, 239)','Finance synthetic badge must have a solid high-contrast background')
  assert.equal(badge.color,'rgb(6, 63, 67)','Finance synthetic badge must have dark readable text')
  await owner.locator('.finance-month-selector').waitFor({state:'visible',timeout:20000})
  await owner.waitForFunction(()=>{const el=document.querySelector('.finance-month-selector');if(!el||!el.isConnected)return false;const css=getComputedStyle(el);return /^rgba?\((?:1|16), (?:41|61), (?:52|74)(?:, 0\.9)?\)$/.test(css.backgroundColor)&&css.color==='rgb(255, 255, 255)'},null,{timeout:20000})
  const month=await owner.locator('.finance-month-selector').evaluate(el=>({
   background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color
  }))
  assert.ok(/^rgba?\((?:1|16), (?:41|61), (?:52|74)(?:, 0\.9)?\)$/.test(month.background),'Month control must have strong dark teal background with at least 90% opacity: '+month.background)
  assert.equal(month.color,'rgb(255, 255, 255)','Month selector must have readable white text')
  await snapshot(owner,'finance-synthetic-branded')
  console.log('PASS Finance solid synthetic badge and readable month selector');stages++
  await visit(owner,'/super-admin/treasury?demo=1','Cash flow & liquidity')
  await assertFinancialDesign(owner,'Treasury synthetic')
  const bars=owner.locator('.finance-cash-svg rect[role="img"]')
  assert.equal(await bars.count(),12,'6 months must show 2 focusable bars each')
  assert.equal(await bars.nth(4).getAttribute('fill'),'#0F8B8D','Inflow should be vivid teal SVG')
  assert.equal(await bars.nth(5).getAttribute('fill'),'#4F46E5','Outflow should be vivid indigo SVG')
  await bars.nth(4).hover()
  const tip=owner.getByTestId('cash-chart-tooltip')
  await tip.waitFor({timeout:10000})
  const words=await tip.innerText()
  assert.ok(words.includes('Jul 2026'),'Tooltip should display hovered month')
  assert.ok(words.includes('174,000.00'),'Tooltip should sum July synthetic operating receipts 24,000 plus financing 150,000')
  const tipStyle=await tip.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}))
  assert.equal(tipStyle.background,'rgb(16, 52, 67)','Tooltip must be solid dark teal')
  assert.equal(tipStyle.color,'rgb(255, 255, 255)','Tooltip must be readable white')
  await snapshot(owner,'treasury-synthetic-with-hover')
  await bars.nth(5).focus()
  assert.ok((await tip.innerText()).includes('Cash outflows'),'Keyboard focus must update tooltip series')
  console.log('PASS 12 vivid cash bars, exact BDT hover tooltip and keyboard focus');stages++
  await visit(owner,'/super-admin/profit-breakdown?demo=1','Profit calculation breakdown')
  await owner.getByRole('heading',{name:'Formula-by-formula profit bridge'}).waitFor({timeout:30000})
  await owner.getByText('−৳2,980.00').first().waitFor({timeout:30000})
  await owner.getByText('FINAL COMPANY NET PROFIT: BLOCKED',{exact:false}).waitFor()
  await assertFinancialDesign(owner,'Profit breakdown')
  await snapshot(owner,'profit-breakdown-amt-01')
  console.log('PASS verified 95-unit supplier COGS, gross zero, operating loss, release blockers');stages++
  await owner.goto(base+'/super-admin/profit-breakdown?demo=1&community=syn-amt-01&pool=syn-pool-amt-01&product=syn-oil-5l',{waitUntil:'domcontentloaded'})
  await owner.getByText('Pool/product scope shows unit economics only',{exact:false}).waitFor({timeout:30000})
  await owner.getByText('Not verified').first().waitFor({timeout:30000})
  console.log('PASS community / pool / product filters refuse arbitrary overhead allocation');stages++
  await visit(owner,'/super-admin/cash-bridge?demo=1','Cash Bridge — Profit is not Cash')
  await owner.getByText('৳255,140.00').first().waitFor({timeout:30000})
  await owner.getByText('৳193,200.00').first().waitFor({timeout:30000})
  await owner.getByText('BOOK BRIDGE ARITHMETIC: PASS',{exact:false}).waitFor({timeout:30000})
  await owner.getByText('BANK VERIFICATION: NOT CERTIFIED',{exact:false}).waitFor({timeout:30000})
  await assertFinancialDesign(owner,'Cash bridge')
  await snapshot(owner,'cash-bridge-synthetic')
  console.log('PASS cash opening + receipts − expenses − debt = closing and unresolved bank certification');stages++
  await visit(maker,'/admin/procurement','Procurement & reconciliation')
  await assertFinancialDesign(maker,'Procurement')
  await snapshot(maker,'procurement')
  console.log('PASS Procurement 1440/768/360');stages++
  await visit(maker,'/admin/treasury','Treasury requests')
  stages++
  const fixtures=[
   ['UAT Operating Bank Alpha','1234','10000','LOCAL-OPEN-A-001'],
   ['UAT Procurement Bank Beta','5678','1000','LOCAL-OPEN-B-001']
  ]
  for(const x of fixtures){
   await owner.goto(base+'/super-admin/treasury',{waitUntil:'domcontentloaded'})
   await owner.locator('input[name="name"]').fill(x[0])
   await owner.locator('input[name="institution"]').fill('LOCAL SYNTHETIC BANK')
   await owner.locator('input[name="last_four"]').fill(x[1])
   await owner.locator('input[name="opening_balance"]').fill(x[2])
   await owner.locator('input[name="opening_reference"]').fill(x[3])
   await owner.getByRole('button',{name:'Create treasury account'}).click()
   await owner.getByText('Account registered and opening journal posted').waitFor({timeout:45000})
   stages++
  }
  console.log('PASS two synthetic accounts created through Server Actions')
  const A=psql("select id from public.treasury_accounts where name='UAT Operating Bank Alpha'")
  const B=psql("select id from public.treasury_accounts where name='UAT Procurement Bank Beta'")
  assert.match(A,/^[0-9a-f-]{36}$/);assert.match(B,/^[0-9a-f-]{36}$/)
  await maker.goto(base+'/admin/treasury',{waitUntil:'domcontentloaded'})
  await maker.locator('select[name="kind"]').selectOption('transfer')
  await maker.locator('select[name="source_account_id"]').selectOption(A)
  await maker.locator('select[name="target_account_id"]').selectOption(B)
  await maker.locator('input[name="amount"]').fill('125')
  await maker.locator('input[name="external_reference"]').fill('LOCAL-BANK-TRANSFER-125')
  await maker.locator('textarea[name="memo"]').fill('Synthetic procurement bank cash transfer')
  await maker.getByRole('button',{name:/Send for independent treasury approval/}).click()
  await maker.getByText('Transaction submitted for independent financial review').waitFor({timeout:45000})
  assert.equal(psql("select status from public.treasury_transactions where external_reference='LOCAL-BANK-TRANSFER-125'"),'pending')
  console.log('PASS maker submitted pending transfer');stages++
  await owner.goto(base+'/super-admin/treasury',{waitUntil:'domcontentloaded'})
  await owner.getByText('LOCAL-BANK-TRANSFER-125').first().waitFor({timeout:15000})
  await owner.getByRole('button',{name:'Approve & post'}).first().click()
  await owner.getByText('Treasury review recorded',{exact:false}).waitFor({timeout:45000})
  assert.equal(psql("select status from public.treasury_transactions where external_reference='LOCAL-BANK-TRANSFER-125'"),'posted')
  const balance="select coalesce(sum(l.debit-l.credit),0) from public.finance_journal_lines l join public.treasury_accounts a on a.ledger_code=l.account_code where a.id='"
  assert.equal(Number(psql(balance+A+"'")),9875)
  assert.equal(Number(psql(balance+B+"'")),1125)
  console.log('PASS separate owner approved transfer, balanced banks 9875 and 1125');stages++
  await maker.goto(base+'/admin/treasury',{waitUntil:'domcontentloaded'})
  await maker.locator('select[name="account_id"]').selectOption(A)
  await maker.locator('input[name="external_line_id"]').fill('LOCAL-STATEMENT-125')
  await maker.locator('input[name="signed_amount"]').fill('-125')
  await maker.locator('input[name="reference"]').fill('LOCAL-BANK-TRANSFER-125')
  await maker.locator('input[name="original_file"]').setInputFiles({name:'original-statement.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nActual synthetic browser bank statement\n%%EOF')})
  await maker.getByRole('button',{name:/Import for independent bank reconciliation/}).click()
  await maker.getByText('Statement line imported as unmatched',{exact:false}).waitFor({timeout:45000})
  console.log('PASS statement imported as UNMATCHED');stages++
  const line=psql("select id from public.treasury_statement_lines where external_line_id='LOCAL-STATEMENT-125'")
  const transfer=psql("select id from public.treasury_transactions where external_reference='LOCAL-BANK-TRANSFER-125'")
  await owner.goto(base+'/super-admin/treasury',{waitUntil:'domcontentloaded'})
  const form=owner.locator('input[name="statement_id"][value="'+line+'"]').locator('xpath=..')
  await form.locator('select[name="transaction_id"]').selectOption(transfer)
  await form.getByRole('button',{name:/Match independently/}).click()
  await owner.getByText('Statement line matched to posted ledger transaction',{exact:false}).waitFor({timeout:45000})
  assert.equal(psql("select (matched_transaction_id is not null)::text from public.treasury_statement_lines where id='"+line+"'"),'true')
  console.log('PASS independent statement matching');stages++
  // Upload real original bytes through the maker form, then void in a second browser session.
  const bill=psql("select id from public.procurement_supplier_bills where invoice_reference='QA-SUPPLIER-INV-9500'")
  const original=Buffer.from('%PDF-1.4\nSynthetic original receipt for browser UAT\n%%EOF')
  await maker.goto(base+'/admin/procurement',{waitUntil:'domcontentloaded'})
  const upload=maker.locator('input[name="document_file"]').locator('xpath=ancestor::form')
  await upload.locator('select[name="entity_type"]').selectOption('bill')
  await upload.locator('select[name="entity_id"]').selectOption(bill)
  await upload.locator('select[name="document_kind"]').selectOption('goods_receipt')
  await upload.locator('input[name="display_name"]').fill('Browser original signed synthetic receipt')
  await upload.locator('input[name="document_file"]').setInputFiles({name:'synthetic-original.pdf',mimeType:'application/pdf',buffer:original})
  await upload.getByRole('button',{name:'Save immutable evidence to record'}).click()
  await maker.getByText('Evidence attached permanently to the selected financial record').waitFor({timeout:45000})
  const attachment=psql("select id from public.finance_document_attachments where display_name='Browser original signed synthetic receipt'")
  assert.match(attachment,/^[0-9a-f-]{36}$/)
  assert.equal(psql("select evidence_sha256 from public.finance_document_attachments where id='"+attachment+"'"),createHash('sha256').update(original).digest('hex'))
  const downloaded=await maker.request.get(base+'/api/finance/attachments/'+attachment)
  assert.equal(downloaded.status(),200);assert.deepEqual(await downloaded.body(),original)
  const lifecycle=maker.locator('input[name="attachment_id"][value="'+attachment+'"]').locator('xpath=ancestor::form')
  await lifecycle.locator('select[name="document_action"]').selectOption('void')
  await lifecycle.locator('input[name="reason"]').fill('Synthetic paper document superseded in browser qualification')
  await lifecycle.getByRole('button',{name:'Request independent document review'}).click()
  await maker.getByText('Document lifecycle request submitted for independent review; original retained').waitFor({timeout:45000})
  const pending=psql("select id from public.finance_document_events where attachment_id='"+attachment+"' and stage='requested'")
  await owner.goto(base+'/admin/procurement',{waitUntil:'domcontentloaded'})
  const review=owner.locator('input[name="request_id"][value="'+pending+'"]').locator('xpath=ancestor::form')
  await review.locator('input[name="reason"]').fill('Original retained and void reason independently reviewed')
  await review.getByRole('button',{name:'Approve document action'}).click()
  await owner.getByText('Document lifecycle review recorded; original and accounting history retained').waitFor({timeout:45000})
  const retained=await owner.request.get(base+'/api/finance/attachments/'+attachment)
  assert.equal(retained.status(),200);assert.deepEqual(await retained.body(),original)
  assert.equal(psql("select count(*) from public.finance_document_events where request_id='"+pending+"' and stage='approved'"),'1')
  await snapshot(owner,'document-original-void')
  console.log('PASS original upload/hash/download, independent document void, original retained');stages++
  // New customer source is operator-registered only in this disposable DB.
  const source='f5000000-0000-4000-8000-000000000003',item='f6000000-0000-4000-8000-000000000003'
  psql(`insert into private.finance_uat_entities(entity_type,entity_id,reason) values('order','${source}','Disposable browser synthetic completed customer source');
  insert into public.orders(id,customer_id,pool_id,status,payment_status,product_subtotal,delivery_fee,total_amount,fulfillment_method,pickup_point_id,completed_at)
  values('${source}','f0000000-0000-0000-0000-000000000001','f1000000-0000-4000-8000-000000000001','completed','paid_manually',980,0,980,'pickup',(select id from public.pickup_points where community_id='11111111-1111-1111-1111-111111111111' limit 1),now());
  insert into public.order_items(id,order_id,pool_item_id,product_id,quantity,benchmark_price_snapshot,unit_price)
  values('${item}','${source}','f2000000-0000-4000-8000-000000000001','22222222-2222-2222-2222-222222222221',1,1000,980)`)
  await visit(maker,'/admin/finance-customers','Customer revenue, inventory & refunds')
  const saleForm=maker.getByRole('button',{name:'Request customer sale posting'}).locator('xpath=ancestor::form')
  await saleForm.getByLabel('Completed customer source').selectOption('order:'+source)
  await saleForm.locator('select[name="bill_id_0"]').selectOption(bill)
  await saleForm.locator('input[name="quantity_0"]').fill('1')
  await saleForm.locator('input[name="reason"]').fill('Browser actual completed customer and cost lot review')
  const saleProof=Buffer.from('%PDF-1.4\nBrowser actual completed sale original\n%%EOF')
  await saleForm.locator('input[name="original_file"]').setInputFiles({name:'sale-original.pdf',mimeType:'application/pdf',buffer:saleProof})
  await saleForm.getByRole('button',{name:'Request customer sale posting'}).click()
  await maker.getByText('Customer sale submitted for independent revenue and inventory review').waitFor({timeout:45000})
  const sale=psql(`select id from public.finance_customer_events where source_id='${source}' and kind='sale'`)
  assert.match(sale,/^[0-9a-f-]{36}$/)
  const self=await identities.get('admin').client.rpc('finance_review_customer_sale',{p_id:sale,p_approve:true,p_note:'Maker self approval must fail'})
  assert.ok(self.error)
  await visit(owner,'/admin/finance-customers','Customer revenue, inventory & refunds')
  async function approveEvent(id){
   const f=owner.locator('input[name="event_id"][value="'+id+'"]').locator('xpath=ancestor::form')
   await f.locator('input[name="reason"]').fill('Independent original source and entitlement checked')
   await f.getByRole('button',{name:'Approve customer accounting'}).click()
   await owner.getByText('Independent customer accounting review recorded').waitFor({timeout:45000})
  }
  await approveEvent(sale)
  const saleOriginal=await owner.request.get(base+'/api/finance/originals/customer_event/'+sale)
  assert.equal(saleOriginal.status(),200);assert.deepEqual(await saleOriginal.body(),saleProof)
  const register=await owner.request.get(base+'/api/finance/documents/customer_event/'+sale+'?download=1')
  assert.equal(register.status(),200);assert.equal((await register.body()).subarray(0,5).toString(),'%PDF-')
  assert.equal(psql(`select status from public.finance_customer_events where id='${sale}'`),'posted')
  console.log('PASS browser actual source sale, invoice-lot COGS, independent approval and original integrity');stages++
  async function customerCash(kind,reference){
   await visit(maker,'/admin/finance-customers','Customer revenue, inventory & refunds')
   const f=maker.getByRole('button',{name:'Request customer cash movement'}).locator('xpath=ancestor::form')
   await f.locator('select[name="sale_id"]').selectOption(sale)
   await f.locator('select[name="cash_kind"]').selectOption(kind)
   await f.locator('select[name="account_id"]').selectOption(A)
   await f.locator('input[name="amount"]').fill('980')
   await f.locator('input[name="reference"]').fill(reference)
   await f.locator('input[name="original_file"]').setInputFiles({name:kind+'.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n'+reference+'\n%%EOF')})
   await f.getByRole('button',{name:'Request customer cash movement'}).click()
   await maker.getByText('Customer cash submitted to independent Treasury approval inbox').waitFor({timeout:45000})
   const id=psql(`select id from public.treasury_transactions where external_reference='${reference}'`)
   await visit(owner,'/super-admin/treasury','Cash flow & liquidity')
   const approval=owner.locator('input[name="transaction_id"][value="'+id+'"]').locator('xpath=ancestor::form')
   await approval.locator('input[name="note"]').fill('Independent actual customer bank evidence checked')
   await approval.getByRole('button',{name:'Approve & post'}).click()
   await owner.getByText('Treasury review recorded',{exact:false}).waitFor({timeout:45000})
   assert.equal(psql(`select status from public.treasury_transactions where id='${id}'`),'posted')
  }
  await customerCash('customer_receipt','BROWSER-CUSTOMER-RECEIPT-980')
  assert.equal(Number(psql(balance+A+"'")),10855)
  console.log('PASS browser independent customer collection settles actual AR');stages++
  await visit(maker,'/admin/finance-customers','Customer revenue, inventory & refunds')
  const creditForm=maker.getByRole('button',{name:'Request customer credit note'}).locator('xpath=ancestor::form')
  await creditForm.locator('select[name="sale_id"]').selectOption(sale)
  await creditForm.locator('input[name="credit_quantity_0"]').fill('1')
  await creditForm.locator('input[name="restock"]').check()
  await creditForm.locator('input[name="reason"]').fill('Browser original physical return and credit entitlement')
  await creditForm.locator('input[name="original_file"]').setInputFiles({name:'credit.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nActual synthetic browser return\n%%EOF')})
  await creditForm.getByRole('button',{name:'Request customer credit note'}).click()
  await maker.getByText('Customer credit submitted for independent return and refund review').waitFor({timeout:45000})
  const credit=psql(`select id from public.finance_customer_events where source_id='${sale}' and kind='credit'`)
  await visit(owner,'/admin/finance-customers','Customer revenue, inventory & refunds')
  await approveEvent(credit)
  await customerCash('customer_refund','BROWSER-CUSTOMER-REFUND-980')
  assert.equal(Number(psql(balance+A+"'")),9875)
  assert.deepEqual(psql(`select private.finance_customer_balance('${sale}','1100')||':'||private.finance_customer_balance('${sale}','2300')`).split(':').map(Number),[0,0])
  console.log('PASS browser credit note, physical stock reversal and independent cash refund; no duplicated expense');stages++
  await visit(maker,'/admin/finance-attribution','Expense attribution & campaign budgets')
  const budgetForm=maker.getByRole('button',{name:'Request campaign budget'}).locator('xpath=ancestor::form')
  await budgetForm.locator('input[name="code"]').fill('BROWSER-MARKETING-BUDGET')
  await budgetForm.locator('input[name="month"]').fill(new Date().toISOString().slice(0,7))
  await budgetForm.locator('input[name="amount"]').fill('100')
  await budgetForm.locator('input[name="reason"]').fill('Synthetic browser offline campaign approval')
  await budgetForm.getByRole('button',{name:'Request campaign budget'}).click()
  await maker.getByText('Campaign budget submitted for independent review').waitFor({timeout:45000})
  const budget=psql("select id from public.finance_campaign_budgets where code='BROWSER-MARKETING-BUDGET'")
  await visit(owner,'/admin/finance-attribution','Expense attribution & campaign budgets')
  const budgetReview=owner.locator('input[name="budget_id"][value="'+budget+'"]').locator('xpath=ancestor::form')
  await budgetReview.locator('input[name="reason"]').fill('Independent offline campaign budget checked')
  await budgetReview.getByRole('button',{name:'Approve budget'}).click()
  await owner.getByText('Independent campaign budget review recorded').waitFor({timeout:45000})
  assert.equal(psql(`select status from public.finance_campaign_budgets where id='${budget}'`),'approved')
  console.log('PASS browser independent marketing budget approval');stages++
  await visit(owner,'/super-admin/finance-report','Integrated accounting report & period close')
  await snapshot(owner,'integrated-report')
  await owner.getByText('BDT 93.00',{exact:true}).waitFor({timeout:30000})
  const auditExport=await owner.request.get(base+'/api/finance/export?month='+new Date().toISOString().slice(0,7))
  assert.equal(auditExport.status(),200);const exported=await auditExport.json()
  assert.equal(Number(exported.report.profit_before_tax),93);assert.ok(exported.audit.rows.length>0)
  assert.match(exported.report.ledger_sha256,/^[a-f0-9]{64}$/)
  console.log('PASS authorized accounting and immutable audit export bound to journal fingerprint');stages++
  const closeCookie=await viewer('super_admin','close_maker'),closeContext=await browser.newContext()
  await closeContext.addCookies(closeCookie);const closeMaker=await closeContext.newPage()
  await visit(closeMaker,'/super-admin/finance-report?month=2001-01','Integrated accounting report & period close')
  const closeForm=closeMaker.getByRole('button',{name:'Request period close'}).locator('xpath=ancestor::form')
  await closeForm.locator('input[name="reason"]').fill('Browser qualified empty ended accounting month')
  await closeForm.getByRole('button',{name:'Request period close'}).click()
  await closeMaker.getByText('Independent close request recorded').waitFor({timeout:45000})
  const close=psql("select id from public.finance_period_close_requests where month_start='2001-01-01'")
  const ownClose=await identities.get('close_maker').client.rpc('finance_review_period_close',{p_id:close,p_approve:true,p_note:'Self approval must be rejected'})
  assert.ok(ownClose.error);assert.match(ownClose.error.message,/Independent maker-checker/)
  await visit(owner,'/super-admin/finance-report?month=2001-01','Integrated accounting report & period close')
  const closeReview=owner.locator('input[name="close_id"][value="'+close+'"]').locator('xpath=ancestor::form')
  await closeReview.locator('input[name="reason"]').fill('Independent unchanged source snapshot confirmed')
  await closeReview.getByRole('button',{name:'Approve period close'}).click()
  await owner.getByText('Independent close request recorded').waitFor({timeout:45000})
  assert.equal(psql("select state from public.finance_periods where month_start='2001-01-01'"),'locked')
  await closeContext.close()
  console.log('PASS browser integrated report, independent Super Admin close and self-approval denial');stages++
  const customerCookie=await viewer('customer')
  const customerContext=await browser.newContext()
  await customerContext.addCookies(customerCookie)
  const customerFile=await customerContext.request.get(base+'/api/finance/attachments/'+attachment)
  assert.notEqual(customerFile.headers()['content-type'],'application/pdf','Customer must not receive original finance evidence')
  const customer=identities.get('customer').client
  const anonymous=createClient(db,key,{auth:{persistSession:false}})
  for(const client of [customer,anonymous]){
   const report=await client.rpc('finance_inventory_source');assert.ok(report.error,'Unauthorized inventory read succeeded')
   const journals=await client.from('finance_journals').select('*');assert.ok(journals.error,'Unauthorized raw ledger read succeeded')
   const file=await client.storage.from('finance-evidence').download(psql("select evidence_path from public.finance_document_attachments where id='"+attachment+"'"));assert.ok(file.error,'Unauthorized original file access succeeded')
  }
  const originalPath=psql("select evidence_path from public.finance_document_attachments where id='"+attachment+"'")
  const overwrite=await identities.get('admin').client.storage.from('finance-evidence').update(originalPath,Buffer.from('%PDF-1.4 altered'),{contentType:'application/pdf'})
  assert.ok(overwrite.error,'Original storage file overwrite succeeded')
  const afterAttack=await owner.request.get(base+'/api/finance/attachments/'+attachment)
  assert.deepEqual(await afterAttack.body(),original,'Overwrite attack changed original bytes')
  const restoreBucket='issue57-isolated-original-restore'
  const createdBucket=await supa.storage.createBucket(restoreBucket,{public:false});assert.ok(!createdBucket.error)
  const backupBytes=await afterAttack.body(),restoredObject='restore/'+attachment+'.pdf'
  const restoreUpload=await supa.storage.from(restoreBucket).upload(restoredObject,backupBytes,{contentType:'application/pdf',upsert:false});assert.ok(!restoreUpload.error)
  const restoredBytes=await supa.storage.from(restoreBucket).download(restoredObject);assert.ok(!restoredBytes.error)
  assert.deepEqual(Buffer.from(await restoredBytes.data.arrayBuffer()),original)
  for(const client of [customer,anonymous]){const denied=await client.storage.from(restoreBucket).download(restoredObject);assert.ok(denied.error,'Restored private file became public')}
  console.log('PASS isolated original-file restore, exact byte hash and private access retained');stages++
  const ownerIdentity=identities.get('super_admin')
  psql("delete from private.finance_uat_leases where actor_id='"+ownerIdentity.id+"'")
  const locked=await ownerIdentity.client.rpc('treasury_create_account',{
   p_name:'Blocked direct API bank',p_kind:'bank',p_institution:'Synthetic',p_last_four:'0057',
   p_open_date:new Date().toISOString().slice(0,10),p_opening_balance:1,p_opening_reference:'REVOKED-LEASE',p_restricted:0,p_credit_limit:null})
  assert.ok(locked.error);assert.match(locked.error.message,/Financial writes locked/)
  console.log('PASS real authenticated/customer/anonymous RPC and storage security, overwrite attack, revoked owner lease');stages++
  await customerContext.close()
  console.log('SYNTHETIC_BROWSER_UAT_PASS '+stages+' stages, viewport 1440/768/360')
 }finally{await browser.close()}
}
await main()
