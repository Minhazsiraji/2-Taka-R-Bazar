// Native Auth and disposable localhost only. No hosted identities or provider credentials.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {createServerClient} from '@supabase/ssr'
import {chromium} from 'playwright'

const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!endpoint || new URL(endpoint).hostname !== '127.0.0.1') throw new Error('Disposable local Auth required')
const key = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!key || !publicKey) throw new Error('Local fixture credentials required')
const admin = createClient(endpoint, key, {auth: {persistSession: false, autoRefreshToken: false}})
const headers = {apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'}
async function rows(table, id) {
  const result = await fetch(endpoint + '/rest/v1/' + table + '?select=*&' + (table === 'user_roles' ? 'user_id' : 'id') + '=eq.' + id, {headers})
  assert.ok(result.ok)
  return result.json()
}
const phone = '8801700000091'
const previousPassword = randomUUID() + 'aA1!'
const password = randomUUID() + 'aA1!'
const {data: created, error: createError} = await admin.auth.admin.createUser({phone, password: previousPassword, phone_confirm: true})
assert.equal(createError, null)
const id = created.user.id
const roleResponse = await fetch(endpoint + '/rest/v1/user_roles', {method: 'POST', headers, body: JSON.stringify({user_id: id, role: 'super_admin'})})
assert.ok(roleResponse.ok)
const browser = await chromium.launch({headless: true})
try {
  const page = await browser.newPage({viewport: {width: 393, height: 900}})
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  async function login(number, pass) {
    await page.locator('[name="phone"]').fill(number)
    await page.locator('[name="password"]').fill(pass)
    await page.getByRole('button', {name: 'Sign in with password', exact: true}).click()
  }
  async function save(pass, confirmation = pass) {
    await page.locator('[name="password"]').fill(pass)
    await page.locator('[name="confirm_password"]').fill(confirmation)
    await page.getByRole('button', {name: 'Save my password', exact: true}).click()
  }
  await page.goto('http://127.0.0.1:3000/login?next=%2Faccount%2Fsecurity', {waitUntil: 'domcontentloaded'})
  assert.equal(await page.getByRole('button', {name: 'Continue with Google', exact: true}).isDisabled(), true)
  assert.equal(await page.getByRole('button', {name: /OTP/}).count(), 0)
  await login('01700000091', previousPassword)
  await page.waitForURL(url => url.pathname === '/account/security')
  // Rejected credentials must not destroy the owner's existing ordinary session.
  await page.goto('http://127.0.0.1:3000/login', {waitUntil: 'domcontentloaded'})
  await login('01700000091', previousPassword + 'wrong')
  await page.getByRole('alert').filter({hasText: 'Mobile number or password was not accepted'}).waitFor()
  await page.goto('http://127.0.0.1:3000/account/security', {waitUntil: 'domcontentloaded'})
  await page.getByRole('button', {name: 'Save my password', exact: true}).waitFor()
  assert.equal(new URL(page.url()).pathname, '/account/security')
  await save(password, password + 'different')
  await page.getByRole('alert').filter({hasText: 'The two passwords do not match.'}).waitFor()
  await save(password)
  await page.getByRole('status').filter({hasText: 'Password saved.'}).waitFor()
  const {data: after} = await admin.auth.admin.getUserById(id)
  assert.equal(after.user.id, id)
  assert.equal(after.user.phone, phone)
  assert.ok((await rows('user_roles', id)).some(r => r.role === 'super_admin'))
  await page.goto('http://127.0.0.1:3000/super-admin/payment-setup', {waitUntil: 'domcontentloaded'})
  for (const value of ['01636-057401', '2183503557001', 'Md. Minhaz Siraji']) await page.getByText(value, {exact: true}).waitFor()
  await page.goto('http://127.0.0.1:3000/super-admin/auth-setup', {waitUntil: 'domcontentloaded'})
  await page.getByRole('heading', {name: 'Login setup', exact: true}).waitFor()
  await page.getByText('Ready', {exact: true}).waitFor()
  await page.goto('http://127.0.0.1:3000/account', {waitUntil: 'domcontentloaded'})
  await page.getByRole('heading', {name: 'My dashboard', exact: true}).waitFor()
  assert.equal(await page.getByRole('link', {name: 'Super Admin', exact: true}).getAttribute('href'), '/super-admin')
  await page.context().clearCookies()
  await page.goto('http://127.0.0.1:3000/login?next=%2Faccount%2Fsecurity', {waitUntil: 'domcontentloaded'})
  await login('01700000091', previousPassword)
  await page.getByRole('alert').filter({hasText: 'Mobile number or password was not accepted'}).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('next'), '/account/security')
  await login('01700000091', password)
  await page.waitForURL(url => url.pathname === '/account/security')
  await page.context().clearCookies()
  for (const path of ['/super-admin/auth-setup', '/super-admin/payment-setup', '/account/security', '/account', '/money']) {
    await page.goto('http://127.0.0.1:3000' + path, {waitUntil: 'domcontentloaded'})
    await page.waitForURL(url => url.pathname === '/login')
  }
  for (const suffix of ['?next=//evil.example', '?code=invalid&next=/super-admin', '?error=access_denied']) {
    await page.goto('http://127.0.0.1:3000/auth/callback' + suffix, {waitUntil: 'domcontentloaded'})
    await page.waitForURL(url => url.pathname === '/login')
    assert.equal(new URL(page.url()).origin, 'http://127.0.0.1:3000')
    await page.locator('.error[role="alert"]').waitFor()
  }
  await page.goto('http://127.0.0.1:3000/verify-otp', {waitUntil: 'domcontentloaded'})
  await page.waitForURL(url => url.pathname === '/login')
  assert.equal(await page.locator('[name="token"]').count(), 0)

  // New mobile signup uses native Supabase password Auth, not SMS or a fixture bypass.
  const customerPassword = randomUUID() + 'aA1!'
  await page.goto('http://127.0.0.1:3000/signup?next=%2Faccount%2Fsecurity&ref=SAFE123', {waitUntil: 'domcontentloaded'})
  await page.locator('[name="phone"]').fill('01700000092')
  await page.locator('[name="password"]').fill(customerPassword)
  await page.locator('[name="confirm_password"]').fill(customerPassword)
  await page.getByRole('button', {name: 'Create account with password', exact: true}).click()
  await page.waitForURL(url => url.pathname === '/onboarding')
  const signupCookies = await page.context().cookies()
  assert.ok(signupCookies.some(c => c.name === 'bp_ref_code' && c.value === 'SAFE123'))
  assert.ok(signupCookies.some(c => c.name === 'bp_post_auth_next' && decodeURIComponent(c.value) === '/account/security'))
  assert.ok(!signupCookies.some(c => c.name.startsWith('bp_otp_')))
  await page.locator('[name="full_name"]').fill('Synthetic password customer')
  await page.locator('[name="household_name"]').fill('Synthetic Auth family')
  await page.locator('[name="community_id"]').selectOption('00000000-0000-4000-8000-000000000821')
  await page.getByRole('button', {name: 'Finish setup', exact: true}).click()
  await page.waitForURL(url => url.pathname === '/account/security')
  const customerClient = createClient(endpoint, publicKey, {auth: {persistSession: false, autoRefreshToken: false}})
  const {data: customer, error: customerError} = await customerClient.auth.signInWithPassword({phone: '8801700000092', password: customerPassword})
  assert.equal(customerError, null)
  assert.deepEqual((await rows('user_roles', customer.user.id)).map(r => r.role), ['customer'])
  assert.equal((await rows('profiles', customer.user.id))[0].community_id, '00000000-0000-4000-8000-000000000821')
  const tamperedPhone = await customerClient.from('profiles').update({phone: '8801700000099'}).eq('id', customer.user.id)
  assert.match(tamperedPhone.error?.message || '', /authenticated login number/)
  for (const payload of [{community_id: randomUUID()}, {referral_code: 'TAMPER123'}, {onboarding_completed_at: '2000-01-01T00:00:00Z'}]) {
    const tampered = await customerClient.from('profiles').update(payload).eq('id', customer.user.id)
    assert.ok(tampered.error, 'Household/system fields must remain protected')
  }
  await page.context().clearCookies()

  // Exercise contact onboarding for an email-only identity using ordinary SDK auth.
  // This is not an end-to-end Google provider test, which needs a configured OAuth client.
  const emailPassword = randomUUID() + 'aA1!'
  const {data: emailFixture, error: emailError} = await admin.auth.admin.createUser({email: 'contact-auth@example.invalid', password: emailPassword, email_confirm: true})
  assert.equal(emailError, null)
  const cookieJar = new Map()
  const native = createServerClient(endpoint, publicKey, {cookies: {getAll: () => [...cookieJar].map(([name, value]) => ({name, value})), setAll: values => {for (const c of values) cookieJar.set(c.name, c.value)}}})
  const {error: nativeError} = await native.auth.signInWithPassword({email: 'contact-auth@example.invalid', password: emailPassword})
  assert.equal(nativeError, null)
  await page.context().addCookies([...cookieJar].map(([name, value]) => ({name, value, domain: '127.0.0.1', path: '/', sameSite: 'Lax'})))
  await page.goto('http://127.0.0.1:3000/onboarding', {waitUntil: 'domcontentloaded'})
  await page.locator('[name="phone"]').fill('01700000093')
  await page.locator('[name="full_name"]').fill('Synthetic email customer')
  await page.locator('[name="household_name"]').fill('Synthetic contact family')
  await page.locator('[name="community_id"]').selectOption('00000000-0000-4000-8000-000000000821')
  await page.getByRole('button', {name: 'Finish setup', exact: true}).click()
  await page.waitForURL(url => url.pathname === '/')
  await page.getByRole('heading', {name: /Smart people make smart decisions/}).waitFor()
  assert.equal((await rows('profiles', emailFixture.user.id))[0].phone, '8801700000093')
  const tamperedContact = await native.from('profiles').update({phone: '8801700000099'}).eq('id', emailFixture.user.id)
  assert.match(tamperedContact.error?.message || '', /Mobile contact is fixed/)
  await page.goto('http://127.0.0.1:3000/account/security', {waitUntil: 'domcontentloaded'})
  await page.locator('[name="phone"]').fill('01700000091')
  await save(password)
  await page.locator('.error[role="alert"]').waitFor()
  const {data: collisionCheck} = await admin.auth.admin.getUserById(emailFixture.user.id)
  assert.equal(collisionCheck.user.id, emailFixture.user.id)
  assert.ok(!collisionCheck.user.phone)
  await page.locator('[name="phone"]').fill('01700000094')
  await save(password)
  await page.getByRole('status').filter({hasText: 'Password saved.'}).waitFor()
  const {data: mobileAdded, error: mobileAddedError} = await customerClient.auth.signInWithPassword({phone: '8801700000094', password})
  assert.equal(mobileAddedError, null)
  assert.equal(mobileAdded.user.id, emailFixture.user.id)
  assert.equal((await rows('profiles', emailFixture.user.id))[0].phone, '8801700000094')
  assert.deepEqual((await rows('user_roles', emailFixture.user.id)).map(r => r.role), ['customer'])
  // Ordinary login without a return intent opens the approved shopping storefront.
  await page.context().clearCookies()
  await page.goto('http://127.0.0.1:3000/login', {waitUntil: 'domcontentloaded'})
  await login('01700000094', password)
  await page.waitForURL(url => url.pathname === '/')
  await page.getByRole('heading', {name: /Smart people make smart decisions/}).waitFor()
  // Stale signed-in bookmarks must never render the retired Home dashboard.
  await page.goto('http://127.0.0.1:3000/home', {waitUntil: 'domcontentloaded'})
  await page.waitForURL(url => url.pathname === '/')
  await page.getByRole('heading', {name: /Smart people make smart decisions/}).waitFor()
  assert.equal(await page.getByRole('heading', {name: 'Your community is buying smarter.', exact: true}).count(), 0)
  const dashboards = page.getByRole('link', {name: 'My dashboard', exact: true})
  assert.deepEqual(await dashboards.evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/account', '/account'])
  await dashboards.first().click()
  await page.waitForURL(url => url.pathname === '/account')
  await page.getByRole('heading', {name: 'My dashboard', exact: true}).waitFor()
  const moneyLink = page.getByRole('link', {name: 'Open My Money', exact: true})
  assert.equal(await moneyLink.getAttribute('href'), '/money')
  assert.equal(await page.getByRole('heading', {name: 'Staff tools', exact: true}).count(), 0)
  assert.equal(await page.getByText('Purchases are awaiting release qualification.', {exact: true}).count(), 0)
  assert.equal(await page.locator('.market-flat-header').count(), 1)
  assert.equal(await page.locator('.market-storefront-dock a[aria-current="page"]').getAttribute('href'), '/account')
  for (const width of [360, 393, 768, 1440]) {
    await page.setViewportSize({width, height: 900})
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await page.evaluate(() => {
      const brand = document.querySelector('.account-dashboard .market-brand-copy strong')
      const actions = document.querySelector('.account-dashboard .market-header-actions')
      const range = document.createRange(); range.selectNodeContents(brand)
      return range.getBoundingClientRect().right <= actions.getBoundingClientRect().left
    }), true, 'Dashboard brand must not overlap header controls')
    assert.equal(await page.locator('.market-storefront-dock').isVisible(), width < 768)
  }
  await page.screenshot({path: '/tmp/2tbr-account-desktop.png', fullPage: true})
  await page.getByRole('button', {name: 'Switch to dark mode', exact: true}).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.setViewportSize({width: 393, height: 900})
  await page.screenshot({path: '/tmp/2tbr-account-mobile-dark.png', fullPage: true})
  await page.setViewportSize({width: 1440, height: 900})
  await page.getByRole('button', {name: 'Switch to light mode', exact: true}).click()
  await page.locator('.market-single-language').click()
  await page.getByRole('heading', {name: 'আমার ড্যাশবোর্ড', exact: true}).waitFor()
  await page.reload({waitUntil: 'domcontentloaded'})
  await page.getByRole('heading', {name: 'আমার ড্যাশবোর্ড', exact: true}).waitFor()
  await page.locator('.market-single-language').click()
  await page.getByRole('heading', {name: 'My dashboard', exact: true}).waitFor()
  await page.getByRole('link', {name: 'Open My Money', exact: true}).click()
  await page.waitForURL(url => url.pathname === '/money')
  await page.getByRole('heading', {name: 'My Money Dashboard', exact: true}).waitFor()
  console.log('Account dashboard UAT passed: storefront design, responsive language/theme controls, role visibility and native My Money navigation.')
  // An old saved login return URL is canonicalized before redirecting.
  await page.context().clearCookies()
  await page.goto('http://127.0.0.1:3000/login?next=%2Fhome', {waitUntil: 'domcontentloaded'})
  await login('01700000094', password)
  await page.waitForURL(url => url.pathname === '/')
  await page.getByRole('heading', {name: /Smart people make smart decisions/}).waitFor()
  console.log('Retired Home UAT passed: signed-in bookmark and old login intent reach storefront; My dashboard opens Account.')
  // A returning password member who has not completed setup must still finish it.
  const unfinishedPassword = randomUUID() + 'aA1!'
  const unfinished = createClient(endpoint, publicKey, {auth: {persistSession: false, autoRefreshToken: false}})
  const {error: unfinishedSignupError} = await unfinished.auth.signUp({phone: '8801700000095', password: unfinishedPassword})
  assert.equal(unfinishedSignupError, null)
  await page.context().clearCookies()
  await page.goto('http://127.0.0.1:3000/login', {waitUntil: 'domcontentloaded'})
  await login('01700000095', unfinishedPassword)
  await page.waitForURL(url => url.pathname === '/onboarding')
  await page.locator('[name="full_name"]').fill('Synthetic returning customer')
  await page.locator('[name="household_name"]').fill('Synthetic returning family')
  await page.locator('[name="community_id"]').selectOption('00000000-0000-4000-8000-000000000821')
  await page.getByRole('button', {name: 'Finish setup', exact: true}).click()
  await page.waitForURL(url => url.pathname === '/')
  await page.getByRole('heading', {name: /Smart people make smart decisions/}).waitFor()
  assert.deepEqual(errors, [])
  console.log('No-SMS Auth UAT passed: password change and login preserve owner identity/roles; old password rejected; native customer signup/referral/onboarding; email-only contact onboarding and mobile linking; phone collision/guest access/invalid OAuth callbacks rejected.')
} finally {await browser.close()}
