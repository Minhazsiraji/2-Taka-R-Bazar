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
  await context.route('https://images.unsplash.com/**',route=>route.abort()) // Exercise local placeholders deterministically.
  const page=await context.newPage()
  for(const route of (process.env.UAT_DEBUG?['/']:['/','/login','/signup','/products','/about','/faq','/privacy','/terms','/return-policy','/refund-policy','/cart','/group-deals','/pool','/account','/account/savings','/money','/demo-product/butter','/demo-product/ghee','/demo-product/rice','/demo-product/eggs','/demo-product/rice?kind=deal','/demo-product/butter?kind=deal','/demo-product/00000000-0000-4000-8000-000000000101'])){
   const response=await page.goto(`http://127.0.0.1:${port}${route}`,{waitUntil:'load'})
   assert.ok(response?.status()<400,`${route} returned ${response?.status()}`)
   await page.locator('.market-header-search input').waitFor()
   await page.evaluate(()=>document.fonts.ready)
   const geometry=await page.evaluate(()=>{
    const shell=document.querySelector('main.public-marketplace-flat')
    const header=document.querySelector('header.market-flat-header')
    const brand=header.querySelector('.market-brand-lockup').getBoundingClientRect()
    const actions=header.querySelector('.market-header-actions').getBoundingClientRect()
    const visible=n=>getComputedStyle(n).display!=='none'
    const actionNodes=[...header.querySelectorAll('.market-header-actions > *')].filter(visible)
    const actionOrder=actionNodes.map(n=>n.classList.contains('market-header-quick-cart')?'cart':n.classList.contains('market-language-toggle')?'language':n.classList.contains('theme-toggle')?'theme':n.classList.contains('customer-notification-bell')?'notifications':n.classList.contains('public-account-menu')?'account':'menu')
    const controlBounds=actionNodes.map(n=>(n.matches('details')?n.querySelector('summary'):n.matches('.market-language-toggle')?n.querySelector('button'):n).getBoundingClientRect()).map(r=>({left:r.left,right:r.right,top:r.top,width:r.width,height:r.height}))
    const searchPieces=[...header.querySelectorAll('.market-search-icon,.public-search-submit,#market-header-product-search')].map(n=>{const c=getComputedStyle(n);return {background:c.backgroundColor,image:c.backgroundImage,border:c.borderWidth,shadow:c.boxShadow}})
    const surfaceNodes=[...shell.querySelectorAll('.card,.glass-panel,.market-product-card,.mhome-savings-panel,.mhome-savings-card,.mhome-deal-card,.mhome-exclusive-card,.mhome-pool-card')]
    const surfaces=surfaceNodes.map(n=>{
     const c=getComputedStyle(n)
     const layers=[];for(let p=n;p;p=p.parentElement)layers.push(getComputedStyle(p).backgroundColor)
     const fill=layers.reverse().reduce((below,color)=>{const parts=color.match(/[\d.]+/g)?.map(Number);if(!parts)return below;const alpha=parts[3]??1;return below.map((v,i)=>parts[i]*alpha+v*(1-alpha))},[255,255,255])
     return {class:n.className,bg:c.backgroundColor,border:c.borderTopColor,width:c.borderTopWidth,shadow:c.boxShadow,rimSeparation:Math.min(...fill.map(v=>255-v))}
    })
    const rimNodes=[...shell.querySelectorAll('.market-flat-header,.market-header-search,.market-header-quick-link,.public-account-trigger,.theme-toggle,.customer-notification-bell,.market-mobile-menu-button,.market-single-language,.mhome-geo-button,.mhome-area-picker summary,.mhome-native-area,.mhome-hero,.mhome-hero-copy>a,.mhome-card-pill,.mhome-pool-status,.btn-primary,.btn-secondary,.mhome-details-btn,.mhome-deal-actions>a:first-child,.mhome-join-deal,.border.rounded-full,form.border.rounded-xl')].filter(n=>n.getClientRects().length)
    const rims=rimNodes.map(n=>({class:n.className,shadow:getComputedStyle(n).boxShadow}))
    const footerPanels=[...shell.querySelectorAll('.market-footer-brand,.market-footer-information>nav,.market-footer-contact')].map(n=>{const c=getComputedStyle(n);return {bg:c.backgroundColor,image:c.backgroundImage,border:c.borderWidth,shadow:c.boxShadow}})
    const poolActions=[...shell.querySelectorAll('.mhome-pool-link')].map(n=>{const r=n.getBoundingClientRect();const p=n.parentElement.getBoundingClientRect();return {preview:Boolean(n.closest('[data-preview-cards]')),left:r.left,right:r.right,parentLeft:p.left,parentRight:p.right,width:r.width,scroll:n.scrollWidth,client:n.clientWidth}})
    const picker=shell.querySelector('.mhome-area-picker')
    const hero=shell.querySelector('.mhome-hero')
    const bodySample=shell.querySelector('.auth-page-content .card > p,section.rounded-2xl p')
    const bodyTextColor=bodySample?getComputedStyle(bodySample).color:null
    const joinButtons=[...shell.querySelectorAll('.mhome-join-deal')].map(n=>{const r=n.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(n);const c=getComputedStyle(n);return {text:n.textContent.trim(),nowrap:c.whiteSpace,width:r.width,contentWidth:n.scrollWidth,clientWidth:n.clientWidth,rects:[...range.getClientRects()].map(r=>({top:r.top,bottom:r.bottom})),color:c.color}})
    return {bodyTextColor,actionOrder,controlBounds,searchPieces,surfaces,rims,joinButtons,footerPanels,poolActions,pickerRight:picker?.getBoundingClientRect().right,heroRight:hero?.getBoundingClientRect().right,width:innerWidth,scroll:document.documentElement.scrollWidth,bg:getComputedStyle(shell).backgroundColor,
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
   assert.deepEqual(geometry.actionOrder,width<768?['language','theme','notifications','account','menu']:['cart','language','theme','notifications','account','menu'])
   const expectedSize=width<768?31:width<1024?34:40
   for(const [i,control] of geometry.controlBounds.entries()){
    assert.ok(Math.abs(control.width-expectedSize)<1,`Header width mismatch: ${JSON.stringify(control)}`)
    assert.ok(Math.abs(control.top-geometry.controlBounds[0].top)<1,'Controls are not vertically aligned')
    if(i)assert.ok(control.left>=geometry.controlBounds[i-1].right,'Header controls overlap')
   }
   for(const part of geometry.searchPieces){
    assert.equal(part.background,'rgba(0, 0, 0, 0)','Search icon/arrow has a separate background')
    assert.equal(part.image,'none')
    assert.equal(part.border,'0px')
    assert.equal(part.shadow,'none')
   }
   for(const surface of geometry.surfaces){
    assert.match(surface.bg,/rgba\(.+, 0\.[0-9]+\)/,`Surface is opaque: ${JSON.stringify(surface)}`)
    assert.match(surface.border,/rgba?\(255, 255, 255/,`Glossy white rim is missing: ${route}/${width}/${theme}/${language} ${JSON.stringify(surface)}`)
    assert.equal(surface.width,'1px')
    assert.notEqual(surface.shadow,'none')
    assert.ok(Number(surface.border.match(/[\d.]+(?=\)$)/)?.[0])>=(theme==='dark'?.85:.97),'White rim must remain bright in both themes')
    if(theme==='light')assert.ok(surface.rimSeparation>=12,`White edge is washed into the pane: ${JSON.stringify(surface)}`)
   }
   for(const rim of geometry.rims){
    assert.match(rim.shadow,/rgba\(255, 255, 255, /,`Missing white edge highlight: ${JSON.stringify(rim)}`)
    assert.match(rim.shadow,/inset/,`Missing inner reflection: ${JSON.stringify(rim)}`)
    assert.match(rim.shadow,/0px 0px 5px 0px/,`Missing restrained rim halo: ${JSON.stringify(rim)}`)
   }
   assert.equal(geometry.footerPanels.length,4,'Keep all four footer information groups')
   for(const panel of geometry.footerPanels){assert.equal(panel.bg,'rgba(0, 0, 0, 0)');assert.equal(panel.image,'none');assert.equal(panel.border,'0px');assert.equal(panel.shadow,'none')}
   for(const action of geometry.poolActions){if(action.preview){assert.ok(Math.abs(action.right-action.parentRight)<1,'Preview Pool action must align lower right');assert.ok(action.left>=action.parentLeft-1)}else{assert.ok(Math.abs(action.left-action.parentLeft)<1&&Math.abs(action.right-action.parentRight)<1,`Pool action must fill its content column: ${JSON.stringify(action)}`)}assert.ok(action.scroll<=action.client+1,'Pool action label clips')}
   if(geometry.bodyTextColor)assert.equal(geometry.bodyTextColor,theme==='dark'?'rgb(190, 201, 217)':'rgb(91, 105, 128)',`Public body text must follow the readable theme palette: ${route}/${width}/${theme}`)
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
    assert.ok(Math.abs(geometry.pickerRight-geometry.heroRight)<2,`Community selector is not at the hero right edge: ${JSON.stringify(geometry)}`)
    await page.locator('#market-header-product-search').click()
    const focusedSearch=await page.locator('.market-header-search').evaluate(form=>{
     const input=form.querySelector('input');const c=getComputedStyle(input);const frame=getComputedStyle(form)
     return {outline:c.outlineStyle,border:c.borderWidth,shadow:c.boxShadow,frameOutline:frame.outlineColor,frameWidth:frame.outlineWidth}
    })
    assert.equal(focusedSearch.outline,'none','Focused search must not gain an inner rectangle')
    assert.equal(focusedSearch.border,'0px')
    assert.equal(focusedSearch.shadow,'none')
    assert.match(focusedSearch.frameOutline,/rgba?\(255, 255, 255/,'Search focus must use the white outer frame')
    assert.equal(focusedSearch.frameWidth,'1px')
    if([320,390,820,1440].includes(width))await page.screenshot({path:`${out}/search-focused-${width}-${theme}-${language}.png`})
    await page.locator('#market-header-product-search').press('Tab')
    assert.equal(await page.locator('.public-search-submit').evaluate(n=>n===document.activeElement),true,'Submit remains keyboard accessible')
    for(const button of geometry.joinButtons){
     assert.equal(button.text,language==='bn'?'ডিলে যোগ দিন →':'Join Deal →')
     assert.equal(button.nowrap,'nowrap')
     assert.ok(button.contentWidth<=button.clientWidth+1,`Join button clips: ${JSON.stringify(button)}`)
     assert.ok(Math.max(...button.rects.map(r=>r.top))-Math.min(...button.rects.map(r=>r.top))<8,'Join label wraps')
    }
    // Local-only layout probe: eligibility is independently covered by rendered tests.
    // Measure the short join label in a real card's allocated action width, then
    // restore its original restricted control before interactions or screenshots.
    if(await page.locator('.mhome-deal-actions').count()){
    const joinProbe=await page.locator('.mhome-deal-actions').first().evaluate((actions,label)=>{
     const original=actions.children[1]
     const probe=document.createElement('a');probe.className='mhome-join-deal';probe.href='#'
     const arrow=document.createElement('span');arrow.textContent='→';arrow.setAttribute('aria-hidden','true')
     probe.append(document.createTextNode(label+' '),arrow)
     original.replaceWith(probe)
     const css=getComputedStyle(probe)
     const measured={nowrap:css.whiteSpace,scroll:probe.scrollWidth,client:probe.clientWidth,font:css.fontSize,padding:css.padding,grid:getComputedStyle(actions).gridTemplateColumns}
     probe.replaceWith(original)
     return measured
    },language==='bn'?'ডিলে যোগ দিন':'Join Deal')
    assert.equal(joinProbe.nowrap,'nowrap')
    assert.ok(joinProbe.scroll<=joinProbe.client+1,`Short join label clips at ${width}/${theme}/${language}: ${JSON.stringify(joinProbe)}`)
    }
    assert.equal(geometry.homeBg,'rgba(0, 0, 0, 0)','Home background must match the shared shell')
    assert.equal(await page.locator('.public-login-join').count(),0)
    if(width>=1024){
     assert.equal(await page.locator('.mhome-exclusive-grid').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),4)
     assert.equal(await page.locator('.mhome-deal-list').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3)
    }
    await page.getByLabel(language==='bn'?'পরের ব্যানার':'Next banner',{exact:true}).click()
    assert.equal(await page.locator('.mhome-dots button[aria-current="true"]').getAttribute('aria-label'),language==='bn'?'ব্যানার 2':'Banner 2')
    // Owner-requested card parity: fixtures remain a read-only presentation.
    assert.equal(await page.locator('[data-preview-cards="deals"] article').count(),2)
    assert.equal(await page.locator('[data-preview-cards="exclusive"] article').count(),4)
    assert.equal(await page.locator('[data-preview-cards="pools"] article').count(),2)
    const rice=page.locator('[data-preview-cards="deals"] article').first()
    for(const text of ['৳135','৳165','৳30','4/5 joined','Ends in 2 days'])assert.ok((await rice.innerText()).includes(text),text)
    assert.equal(await rice.locator('.app-card-preview-actions > :is(a,button)').count(),2)
    assert.equal(await rice.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'4')
    for(const [index,price,old,stock] of [[0,'৳1,160','৳1,240','32'],[1,'৳680','৳780','20'],[2,'৳145','৳165','45'],[3,'৳145','৳165','24']]){
     const card=page.locator('[data-preview-cards="exclusive"] article').nth(index)
     for(const text of [price,old,stock])assert.ok((await card.innerText()).includes(text),text)
     assert.equal(await card.locator('.app-card-preview-actions > :is(a,button)').count(),2,'Exactly two Exclusive actions')
     assert.equal(await card.locator('form').count(),0,'Demo cannot submit a real cart action')
    }
    for(const card of await page.locator('[data-preview-cards="pools"] article').all()){
     assert.equal(await card.locator('img').count(),3)
     assert.ok((await card.innerText()).includes('ACTIVE'))
     const photos=await card.evaluate(card=>{
      const box=card.querySelector('.app-card-preview-pool-photos').getBoundingClientRect()
      const copy=card.querySelector('.app-card-preview-copy').getBoundingClientRect()
      return {top:box.top,bottom:box.bottom,height:box.height,copyTop:copy.top,copyBottom:copy.bottom,frames:[...card.querySelectorAll('.app-card-preview-pool-photos>div')].map(frame=>{
       const r=frame.getBoundingClientRect();const image=frame.querySelector('img');const i=image.getBoundingClientRect()
       return {top:r.top,bottom:r.bottom,height:r.height,imageHeight:i.height,fit:getComputedStyle(image).objectFit,fallback:image.classList.contains('app-card-preview-placeholder')}
      })}
     })
     assert.ok(Math.abs(photos.top-photos.copyTop)<1&&Math.abs(photos.bottom-photos.copyBottom)<1,'Pool photos must fill the full content height: '+JSON.stringify(photos))
     for(const frame of photos.frames){
      assert.ok(Math.abs(frame.height-photos.height)<1,'Each Pool thumbnail must fill the image strip height')
      assert.ok(Math.abs(frame.imageHeight-(frame.height-2))<2,'Pool image must fill its bordered frame')
      assert.equal(frame.fit,frame.fallback?'contain':'cover','Pool images preserve proportions')
     }
    }
    const cardBoxes=await page.locator('[data-preview-cards] article').evaluateAll(nodes=>nodes.map(card=>{
     const r=card.getBoundingClientRect()
     return {width:r.width,scroll:card.scrollWidth,client:card.clientWidth,children:[...card.querySelectorAll('.app-card-preview-copy,.app-card-preview-actions,button,.app-card-preview-actions>a')].map(n=>{const b=n.getBoundingClientRect();return {left:b.left-r.left,right:b.right-r.left,scroll:n.scrollWidth,client:n.clientWidth}})}
    }))
    for(const box of cardBoxes){assert.ok(box.scroll<=box.client+1,'Preview card overflows');for(const child of box.children){assert.ok(child.left>=-1&&child.right<=box.width+1,'Preview control escapes card');assert.ok(child.scroll<=child.client+1,'Preview copy/button clips')}}
    if([320,390,820,1440].includes(width)){
     for(const section of ['deals','exclusive','pools'])await page.locator('#mobile-'+section).screenshot({path:`${out}/cards-${section}-${width}-${theme}-${language}.png`})
    }
    if(width===390){
     const mutations=[]
     const watch=request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))mutations.push(request.method()+' '+request.url())}
     page.on('request',watch)
     for(const [index,id,price] of [[0,'butter','৳1,160'],[1,'ghee','৳680'],[2,'rice','৳145'],[3,'eggs','৳145']]){
      await page.locator('[data-preview-cards="exclusive"] article').nth(index).getByRole('link').click()
      await page.waitForURL('**/demo-product/'+id,{waitUntil:'networkidle'})
      assert.equal(await page.getByRole('dialog').count(),0,'Details must navigate rather than open a popup')
      assert.ok((await page.locator('.home-preview-product-price').innerText()).includes(price))
      await page.goBack({waitUntil:'networkidle'})
      await page.locator('[data-preview-cards="exclusive"]').waitFor()
     }
     await rice.getByRole('link').click()
     await page.waitForURL('**/demo-product/rice?kind=deal',{waitUntil:'networkidle'})
     assert.equal(await page.getByRole('dialog').count(),0)
     assert.ok((await page.locator('.home-preview-product-price').innerText()).includes('৳135'))
     await page.getByRole('link',{name:language==='bn'?'← বাজারে ফিরুন':'← Back to shopping',exact:true}).click()
     await page.locator('[data-preview-cards="exclusive"]').waitFor()
     await page.locator('[data-preview-cards="exclusive"] article').first().getByRole('button').click()
     await page.locator('.app-card-preview-notice[role="status"]').waitFor()
     assert.ok((await page.locator('.app-card-preview-notice[role="status"]').innerText()).includes(language==='bn'?'ডেমো':'preview'))
     await rice.getByRole('button').click()
     await page.getByRole('dialog').waitFor()
     await page.getByRole('dialog').press('Escape')
     await page.locator('[data-preview-cards="pools"] article').first().locator('button').click()
     await page.getByRole('dialog').waitFor()
     assert.ok((await page.getByRole('dialog').innerText()).includes('875'))
     await page.getByRole('dialog').press('Escape')
     assert.equal(await page.getByRole('dialog').count(),0)
     assert.deepEqual(mutations,[],'Preview controls must not send write requests')
     page.off('request',watch)
    }
    // Live search filters product and Group Deal cards rather than a hidden legacy section.
    await page.locator('#market-header-product-search').fill('no-such-product-123')
    assert.equal(await page.locator('.mhome-deal-card,.mhome-exclusive-card').count(),0)
    await page.locator('#market-header-product-search').fill('')
    await page.locator('.public-account-trigger').click()
    await page.locator('.public-account-panel a[href="/login"]').waitFor()
    assert.equal(await page.locator('.public-account-panel a[href="/money"]').count(),0)
    await page.locator('.public-account-trigger').press('Escape')
    assert.equal(await page.locator('.public-account-menu').getAttribute('open'),null)
    assert.equal(await page.locator('#mhome-community').isVisible(),false,'Use the contained picker instead of an overflowing OS menu')
    await page.locator('.mhome-area-picker summary').click()
    const areaMenu=await page.locator('.mhome-area-menu').evaluate(n=>{const r=n.getBoundingClientRect();const h=document.querySelector('.mhome-hero').getBoundingClientRect();return {left:r.left,right:r.right,heroLeft:h.left,heroRight:h.right,bottom:r.bottom,viewport:innerHeight,items:[...n.querySelectorAll('button')].map(b=>({height:b.getBoundingClientRect().height,scroll:b.scrollWidth,client:b.clientWidth,shadow:getComputedStyle(b).boxShadow,border:getComputedStyle(b).borderWidth}))}})
    assert.ok(areaMenu.left>=areaMenu.heroLeft-1&&areaMenu.right<=areaMenu.heroRight+1,`Area menu escapes its content frame: ${JSON.stringify(areaMenu)}`)
    assert.ok(areaMenu.bottom<=areaMenu.viewport,'Area menu extends below the viewport')
    for(const item of areaMenu.items){assert.ok(item.height>=44);assert.ok(item.scroll<=item.client+1,'Area name overflows');assert.equal(item.shadow,'none');assert.equal(item.border,'0px')}
    if([320,390,820,1440].includes(width))await page.screenshot({path:`${out}/area-open-${width}-${theme}-${language}.png`})
    await page.locator('.mhome-area-menu button').nth(1).click()
    assert.equal(await page.locator('.mhome-area-picker').getAttribute('open'),null)
    assert.notEqual(await page.locator('#mhome-community').evaluate(n=>n.value),'')
    await page.locator('.mhome-area-picker summary').click()
    await page.locator('.mhome-area-menu button').first().click()
    await page.locator('.mhome-area-picker summary').click()
    await page.locator('.mhome-area-picker summary').press('Escape')
    assert.equal(await page.locator('.mhome-area-picker').getAttribute('open'),null)
   }
   if(route.startsWith('/demo-product/')&&!route.includes('00000000')){
    const id=route.split('/').pop().split('?')[0]
    const expected={butter:{name:'Premium Butter',bn:'প্রিমিয়াম বাটার',price:'৳1,160'},ghee:{name:'Pure Cow Ghee',bn:'খাঁটি গরুর ঘি',price:'৳680'},rice:{name:'Chinigura Rice',bn:'চিনিগুড়া চাল',price:'৳145'},eggs:{name:'Farm Fresh Eggs',bn:'তাজা ডিম',price:'৳145'}}[id]
    assert.equal(await page.getByRole('heading',{level:1}).innerText(),language==='bn'?expected.bn:expected.name)
    assert.ok((await page.locator('.home-preview-product-price').innerText()).includes(route.includes('kind=deal')?(id==='rice'?'৳135':'৳1,075'):expected.price))
    assert.equal(await page.getByRole('dialog').count(),0)
    const image=page.locator('.market-demo-detail-image img')
    await image.waitFor()
    await page.waitForFunction(()=>{const image=document.querySelector('.market-demo-detail-image img');return image?.getAttribute('src')==='/preview-app-product-placeholder.svg'&&image.complete&&image.naturalWidth>0})
    if([320,390,820,1440].includes(width)&&['/demo-product/butter','/demo-product/rice?kind=deal'].includes(route))await page.screenshot({path:`${out}/product-detail-${id}${route.includes('?')?'-deal':''}-${width}-${theme}-${language}.png`,fullPage:true})
   }
   if([320,390,820,1440].includes(width)&&['/','/login','/products','/privacy'].includes(route)){
    await page.screenshot({path:`${out}/${route==='/'?'home':route.slice(1)}-${width}-${theme}-${language}.png`,fullPage:true})
   }
   if(route==='/'&&[320,390,820,1440].includes(width)){
    await page.locator('.market-information-footer').scrollIntoViewIfNeeded()
    await page.screenshot({path:`${out}/footer-pool-${width}-${theme}-${language}.png`})
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
   await page.locator('.public-search-submit').click()
   await page.waitForURL('**/?q=rice',{waitUntil:'networkidle'})
   assert.equal(await page.locator('#market-header-product-search').evaluate(n=>n.value),'rice')
   await page.goto(`http://127.0.0.1:${port}/login`,{waitUntil:'networkidle'})
   await page.locator('#market-header-product-search').fill('oil')
   await page.locator('#market-header-product-search').press('Enter')
   await page.waitForURL('**/?q=oil',{waitUntil:'networkidle'})
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
}catch(error){
 console.error('Next server diagnostic tail:\n'+logs.slice(-6000))
 throw error
}finally{
 await writeFile(`${out}/server.log`,logs)
 await browser?.close()
 child.kill('SIGTERM')
 fixture.close()
}
