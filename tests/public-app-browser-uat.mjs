// Runs against a local Next production build and a disposable read-only HTTP fixture.
// It cannot contact the hosted database or place an order. No credentials are used.
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const {chromium}=require('playwright')
const out='artifacts/public-app'
await mkdir(out,{recursive:true})
const fixture=createServer((req,res)=>{
 res.setHeader('content-type','application/json')
 if(req.url==='/auth/v1/settings')return res.end(JSON.stringify({external:{google:true}}))
 if(req.url?.startsWith('/auth/')){res.statusCode=401;return res.end('{"message":"No local fixture session"}')}
 // Narrow public RPCs are intentionally empty: existing DEMO UI must label its fixtures.
 res.end('[]')
})
await new Promise(resolve=>fixture.listen(54410,'127.0.0.1',resolve))
const port=3040
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
 env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54410',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture',VERCEL_ENV:'preview'},stdio:['ignore','pipe','pipe']
})
let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x)
let browser
const results=[]
try{
 for(let attempt=0;attempt<40;attempt++){
  try{if((await fetch(`http://127.0.0.1:${port}/login`)).ok)break}catch{}
  if(attempt===39)throw Error('Next server did not start: '+logs)
  await new Promise(r=>setTimeout(r,500))
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 const widths=process.env.UAT_WIDTHS?process.env.UAT_WIDTHS.split(',').map(Number):[320,360,390,412,768,820,1024,1280,1440,1920]
 async function checkWidth(width){for(const theme of (process.env.UAT_DEBUG?['dark']:['light','dark']))for(const language of (process.env.UAT_DEBUG?['bn']:['en','bn'])){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce',serviceWorkers:'block'})
  await context.addInitScript(({theme,language})=>{
   localStorage.setItem('2taka-theme',theme)
   localStorage.setItem('2tbr-storefront-language-v1',language)
  },{theme,language})
  await context.addCookies([{name:'2tbr_storefront_language',value:language,url:`http://127.0.0.1:${port}`}])
  const page=await context.newPage()
  for(const route of (process.env.UAT_DEBUG?['/']:['/','/login','/signup','/products','/about','/faq','/privacy','/terms','/return-policy','/refund-policy','/cart','/group-deals','/pool','/account','/money'])){
   const response=await page.goto(`http://127.0.0.1:${port}${route}`,{waitUntil:'networkidle'})
   assert.ok(response?.status()<400,`${route} returned ${response?.status()}`)
   await page.locator('.market-header-search input').waitFor()
   await page.evaluate(()=>document.fonts.ready)
   const geometry=await page.evaluate(()=>{
    const shell=document.querySelector('main.public-marketplace-flat')
    const header=document.querySelector('header.market-flat-header')
    const brand=header.querySelector('.market-brand-lockup').getBoundingClientRect()
    const actions=header.querySelector('.market-header-actions').getBoundingClientRect()
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,bg:getComputedStyle(shell).backgroundColor,
     homeBg:document.querySelector('.mhome')?getComputedStyle(document.querySelector('.mhome')).backgroundColor:null,
     headerHeight:header.getBoundingClientRect().height,overlap:brand.right>actions.left+1,
     fonts:document.fonts.check('14px Inter'),bengaliFont:document.fonts.check('14px \"Hind Siliguri\"','বাংলা'),language:header.lang,
     navCount:[...document.querySelectorAll('nav.app-mobile-nav')].filter(n=>getComputedStyle(n).display!=='none').length,
     dockBottom:document.querySelector('nav.app-mobile-nav')?.getBoundingClientRect().bottom,
     secondNav:Boolean(document.querySelector('.market-desktop-nav')),
     wrongBengaliFont:[...shell.querySelectorAll('span,p,button,a,label')].filter(n=>/[\u0980-\u09ff]/.test([...n.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join(''))&&!getComputedStyle(n).fontFamily.includes('Hind Siliguri')).map(n=>({text:n.textContent,font:getComputedStyle(n).fontFamily})).slice(0,5)}
   })
   if(process.env.UAT_DEBUG){
    const rules=await page.evaluate(()=>{const n=document.querySelector('main.public-marketplace-flat');const found=[];function scan(rules,url){for(const r of rules){if(r.cssRules)scan(r.cssRules,url);else if(r.selectorText&&n.matches(r.selectorText)&&r.style.background)found.push({url,selector:r.selectorText,bg:r.style.background,priority:r.style.getPropertyPriority('background')})}}for(const sheet of document.styleSheets){try{scan(sheet.cssRules,sheet.href)}catch{}}return {vars:getComputedStyle(n).getPropertyValue('--public-bg'),rules:found}});console.log(JSON.stringify(rules,null,2));await page.screenshot({path:out+'/debug-dark.png',fullPage:true})
   }
   assert.ok(geometry.scroll<=width+1,`${route} overflow at ${width}/${theme}/${language}: ${JSON.stringify(geometry)}`)
   assert.ok(!geometry.overlap,`${route} brand overlaps controls at ${width}`)
   assert.equal(geometry.bg,theme==='dark'?'rgb(13, 20, 36)':'rgb(244, 241, 246)',`${route}/${width}/${theme}/${language} background`)
   assert.deepEqual(geometry.wrongBengaliFont,[],'Bengali copy must use the approved fallback')
   assert.equal(geometry.fonts,true,'Self-hosted Inter failed to load')
   assert.equal(geometry.bengaliFont,true,'Self-hosted Hind Siliguri failed to load')
   assert.equal(geometry.secondNav,false)
   assert.equal(geometry.navCount,width<768?1:0)
   if(width<768)assert.ok(Math.abs(geometry.dockBottom-950)<2,'Dock is not anchored at viewport bottom')
   if(width>=768)assert.ok(geometry.headerHeight<100,`Header too tall: ${geometry.headerHeight}`)
   if(route==='/login'){
    await page.getByText(language==='bn'?'পুলে যোগ দিন':'Join the pool',{exact:true}).first().waitFor()
    assert.equal(await page.getByRole('button',{name:'Continue with Google',exact:true}).isEnabled(),true)
    assert.equal(await page.locator('input[name="password"]').count(),1)
   }
   if(route==='/'){
    assert.equal(geometry.homeBg,'rgba(0, 0, 0, 0)','Home background must match the shared shell')
    assert.equal(await page.locator('.public-login-join').count(),0)
    if(width>=1024){
     assert.equal(await page.locator('.mhome-exclusive-grid').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),4)
     assert.equal(await page.locator('.mhome-deal-list').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3)
    }
    await page.getByLabel(language==='bn'?'পরের ব্যানার':'Next banner',{exact:true}).click()
    assert.equal(await page.locator('.mhome-dots button[aria-current="true"]').getAttribute('aria-label'),language==='bn'?'ব্যানার 2':'Banner 2')
    // Live search filters product and Group Deal cards rather than a hidden legacy section.
    await page.locator('#market-header-product-search').fill('no-such-product-123')
    assert.equal(await page.locator('.mhome-deal-card,.mhome-exclusive-card').count(),0)
    await page.locator('#market-header-product-search').fill('')
    await page.locator('.public-account-trigger').click()
    await page.locator('.public-account-panel a[href="/login"]').waitFor()
    assert.equal(await page.locator('.public-account-panel a[href="/money"]').count(),0)
    await page.locator('.public-account-trigger').press('Escape')
    assert.equal(await page.locator('.public-account-menu').getAttribute('open'),null)
    if(width<768){
     await page.locator('#mhome-community').selectOption({index:1})
     assert.notEqual(await page.locator('#mhome-community').evaluate(n=>n.value), '')
     await page.locator('#mhome-community').selectOption('')
    }else{
     await page.locator('.mhome-area-picker summary').click()
     await page.locator('.mhome-area-menu button').nth(1).click()
     assert.equal(await page.locator('.mhome-area-picker').getAttribute('open'),null)
     await page.locator('.mhome-area-picker summary').click()
     await page.locator('.mhome-area-menu button').first().click()
    }
   }
   if([320,390,820,1440].includes(width)&&['/','/login','/products','/privacy'].includes(route)){
    await page.screenshot({path:`${out}/${route==='/'?'home':route.slice(1)}-${width}-${theme}-${language}.png`,fullPage:true})
   }
   results.push({route,width,theme,language,...geometry})
  }
  // Theme and language buttons must work on the real shared public header.
  await page.getByRole('button',{name:theme==='dark'?'Switch to light mode':'Switch to dark mode',exact:true}).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme==='dark'?'light':'dark')
  await page.getByRole('button',{name:language==='bn'?'Switch to English':'বাংলায় পরিবর্তন করুন',exact:true}).click()
  await page.waitForLoadState('networkidle')
  assert.equal(await page.locator('header.market-flat-header').getAttribute('lang'),language==='bn'?'en':'bn')
  if(width===320&&theme==='light'&&language==='en'){
   await page.goto(`http://127.0.0.1:${port}/login`,{waitUntil:'networkidle'})
   await page.locator('#market-header-product-search').fill('rice')
   await page.locator('#market-header-product-search').press('Enter')
   await page.waitForURL('**/?q=rice',{waitUntil:'networkidle'})
   assert.equal(await page.locator('#market-header-product-search').evaluate(n=>n.value),'rice')
   const repeated=await page.goto(`http://127.0.0.1:${port}/?q=rice&q=oil`,{waitUntil:'networkidle'})
   assert.equal(repeated.status(),200,'Repeated query parameters must not crash Home')
  }
  await context.close()
 }
 console.log(`PASS width ${width}: all themes, languages and public routes`)
 }
 const pending=[...widths]
 await Promise.all(Array.from({length:Math.min(3,widths.length)},async()=>{while(pending.length){const width=pending.shift();await checkWidth(width)}}))
 await writeFile(`${out}/results.json`,JSON.stringify({checks:results.length,results},null,2))
 console.log(`PASS: ${results.length} public route/width/theme/language combinations plus search, hero, guest Account, theme and language interactions.`)
}finally{
 await writeFile(`${out}/server.log`,logs)
 await browser?.close()
 child.kill('SIGTERM')
 fixture.close()
}
