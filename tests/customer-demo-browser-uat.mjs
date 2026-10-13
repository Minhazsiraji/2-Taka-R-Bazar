// Preview presentation QA. No database mutations or authentication accounts.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const base=process.env.CUSTOMER_UI_BASE_URL??'http://127.0.0.1:3000';
if(new URL(base).hostname!=='127.0.0.1')throw new Error('Local synthetic Preview required');
const browser=await chromium.launch({headless:true}),errors=[],results=[];
await mkdir('artifacts',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:393,height:900}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 assert.equal(await page.locator('#deals .market-product-card').count(),9);
 assert.equal(await page.getByRole('button',{name:'Select community',exact:true}).count(),9);
 const language=page.locator('.market-flat-header .market-single-language');
 assert.equal(await language.innerText(),'BAN');
 await page.locator('#market-area-select').click();
 const radios=page.locator('input[name="browsing-community"]');
 const area=await radios.nth(1).getAttribute('value');
 const areaName=await radios.nth(1).locator('..').innerText();
 await radios.nth(1).check();await page.locator('.market-community-done').click();
 assert.equal(await page.locator('#deals .market-product-card').count(),3);
 for(const name of await page.locator('#deals .market-product-community').allInnerTexts())assert.equal(name.trim(),areaName.trim());
 await language.click();await page.reload({waitUntil:'networkidle'});
 assert.equal(await language.innerText(),'EN');
 assert.equal(await page.locator('#deals .market-product-card').count(),3);
 results.push('PASS nine first-visit demo products -> three selected-community products; BAN and area persist after reload');
 await page.goto(base+'/demo-pool/monthly?area='+area,{waitUntil:'networkidle'});
 assert.equal(await page.locator('.market-single-language').innerText(),'EN');
 assert.equal(await page.locator('.market-pool-detail-item').count(),3);
 await page.getByRole('button',{name:'পরিমাণ বাড়ান',exact:true}).first().click();
 await page.getByRole('button',{name:'নির্বাচিত পণ্য ডেমো কার্টে যোগ করুন',exact:true}).click();
 assert.equal(await page.locator('.market-demo-cart-preview').count(),1);
 assert.equal(await page.getByRole('button',{name:'যোগ দিন / কিনুন · ডেমোতে বন্ধ',exact:true}).isDisabled(),true);
 await page.locator('.market-single-language').click();await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('.market-single-language').innerText(),'BAN');
 results.push('PASS selected-community Pool package, quantities, clearly synthetic basket, disabled purchase and persistent EN/BAN');
 for(const width of [360,393,768,1440,1920]){
  await page.setViewportSize({width,height:900});
  for(const theme of ['light','dark']){
   const current=await page.locator('html').getAttribute('data-theme');
   if((current??'light')!==theme)await page.getByRole('button',{name:theme==='dark'?'Switch to dark mode':'Switch to light mode'}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`artifacts/commerce-demo-pool-${width}-${theme}.png`,fullPage:true});
  }
 }
 results.push('PASS Pool detail at five widths in light/dark without overflow');
 assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();await writeFile('artifacts/commerce-demo-ui-report.txt',results.join('\n')+'\n');console.log(results.join('\n'))}
