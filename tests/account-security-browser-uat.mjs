// Ordinary phone OTP and password Auth against disposable localhost only.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {chromium} from 'playwright'

const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL
if(!endpoint||new URL(endpoint).hostname!=='127.0.0.1')throw new Error('Disposable local Auth required')
const key=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
if(!key)throw new Error('Local fixture credential required')
const admin=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}})
const phone='8801700000091'
const password=randomUUID()+'aA1!'
const {data:created,error:createError}=await admin.auth.admin.createUser({phone,phone_confirm:true})
assert.equal(createError,null)
const id=created.user.id
const roleResponse=await fetch(endpoint+'/rest/v1/user_roles',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({user_id:id,role:'super_admin'})})
assert.ok(roleResponse.ok)
const browser=await chromium.launch({headless:true})
try{
  const page=await browser.newPage({viewport:{width:393,height:900}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:3000/login',{waitUntil:'networkidle'})
  await page.getByRole('link',{name:'Verify mobile and set a password'}).click()
  assert.ok(page.url().includes('method=otp'))
  await page.locator('[name="phone"]').fill('01700000091')
  await page.getByRole('button',{name:'Send OTP',exact:true}).click()
  await page.waitForURL(url=>url.pathname==='/verify-otp')
  await page.locator('[name="token"]').fill('876543')
  await page.getByRole('button',{name:/Verify|Confirm/i}).click()
  await page.waitForURL(url=>url.pathname==='/account/security')
  await page.locator('[name="password"]').fill(password)
  await page.locator('[name="confirm_password"]').fill(password+'different')
  await page.getByRole('button',{name:'Save my password'}).click()
  await page.getByRole('alert').filter({hasText:'The two passwords do not match.'}).waitFor()
  await page.locator('[name="password"]').fill(password)
  await page.locator('[name="confirm_password"]').fill(password)
  await page.getByRole('button',{name:'Save my password'}).click()
  await page.getByRole('status').filter({hasText:'Password saved.'}).waitFor()
  const {data:after}=await admin.auth.admin.getUserById(id)
  assert.equal(after.user.id,id)
  assert.equal(after.user.phone,phone)
  const roles=await fetch(endpoint+'/rest/v1/user_roles?select=role&user_id=eq.'+id,{headers:{apikey:key,Authorization:'Bearer '+key}})
  assert.ok((await roles.json()).some(r=>r.role==='super_admin'))
  await page.context().clearCookies()
  await page.goto('http://127.0.0.1:3000/login?next=%2Faccount%2Fsecurity',{waitUntil:'networkidle'})
  await page.locator('[name="phone"]').fill('01700000091')
  await page.locator('[name="password"]').fill(password+'wrong')
  await page.getByRole('button',{name:'Sign in with password'}).click()
  await page.getByText('Mobile number or password was not accepted',{exact:true}).waitFor()
  await page.locator('[name="phone"]').fill('01700000091')
  await page.locator('[name="password"]').fill(password)
  await page.getByRole('button',{name:'Sign in with password'}).click()
  await page.waitForURL(url=>url.pathname==='/account/security')
  await page.goto('http://127.0.0.1:3000/super-admin/payment-setup',{waitUntil:'networkidle'})
  await page.getByText('01636-057401',{exact:true}).waitFor()
  await page.getByText('2183503557001',{exact:true}).waitFor()
  await page.getByText('Md. Minhaz Siraji',{exact:true}).waitFor()
  await page.context().clearCookies()
  await page.goto('http://127.0.0.1:3000/super-admin/payment-setup',{waitUntil:'networkidle'})
  await page.waitForURL(url=>url.pathname==='/login')
  // Compare identity using ordinary Auth, never forged claims or Auth SQL.
  const {data:signed,error:signError}=await admin.auth.signInWithPassword({phone,password})
  assert.equal(signError,null)
  assert.equal(signed.user.id,id)
  assert.deepEqual(errors,[])
  console.log('Account security UAT passed: existing OTP identity → password setup → phone/password login; original identity and Super Admin role preserved; wrong password rejected.')
}finally{await browser.close()}
