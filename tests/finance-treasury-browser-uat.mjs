// Browser UAT refuses hosted Supabase and uses synthetic accounts in disposable local DB.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
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
async function viewer(role){
 const email='uat-'+role+'-'+Date.now()+'@example.invalid'
 const password='LOCAL-ONLY-Synthetic!349'
 const {data,error}=await supa.auth.admin.createUser({email,password,email_confirm:true})
 if(error||!data?.user?.id)throw new Error('Synthetic user failed '+error?.message)
 const id=data.user.id
 assert.match(id,/^[0-9a-f-]{36}$/i)
 assert.ok(['admin','super_admin'].includes(role))
 psql("insert into public.user_roles(user_id,role) values('"+id+"','"+role+"') on conflict do nothing")
 const jar=new Map()
 const client=createServerClient(db,key,{cookies:{
  getAll:()=>[...jar.values()].map(c=>({name:c.name,value:c.value})),
  setAll:cookies=>{for(const cookie of cookies)jar.set(cookie.name,cookie)}
 }})
 const login=await client.auth.signInWithPassword({email,password})
 if(login.error||!login.data.user)throw new Error('Local synthetic login failed '+login.error?.message)
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
async function snapshot(page,label){
 for(const width of [1440,768,360]){
  await page.setViewportSize({width,height:900})
  await page.screenshot({path:'artifacts/'+label+'-'+width+'.png',fullPage:true,timeout:60000})
 }
 await page.setViewportSize({width:1440,height:900})
}
async function main(){
 await mkdir('artifacts',{recursive:true})
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
  await snapshot(owner,'finance')
  console.log('PASS Finance Control 1440/768/360');stages++
  await visit(owner,'/super-admin/treasury','Cash flow & liquidity')
  await snapshot(owner,'treasury')
  console.log('PASS Treasury 1440/768/360');stages++
  await visit(maker,'/admin/procurement','Procurement & reconciliation')
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
  console.log('SYNTHETIC_BROWSER_UAT_PASS '+stages+' stages, viewport 1440/768/360')
 }finally{await browser.close()}
}
await main()
