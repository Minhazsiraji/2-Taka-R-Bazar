import assert from 'node:assert/strict'
import {assertCustomerPageHeader} from './header-layout-assertions.mjs'
import {assertMobileDock} from './mobile-dock-assertions.mjs'

export async function assertCustomerChrome(page,width){
 const header=page.locator('header.market-flat-header')
 const footer=page.locator('footer.market-information-footer')
 await header.waitFor()
 await footer.waitFor()
 assert.equal(await page.locator('header').count(),1,'One shared customer header: '+page.url())
 assert.equal(await page.locator('footer').count(),1,'One shared customer footer: '+page.url())
 await assertCustomerPageHeader(page,width)
 assert.equal(await header.locator('.customer-notification-bell').count(),1)
 assert.equal(await header.locator('.market-single-language').count(),1)
 const geometry=await page.evaluate(()=>{
  const elements=[document.querySelector('header.market-flat-header'),document.querySelector('footer.market-information-footer')]
  return elements.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth}})
 })
 for(const r of geometry){assert.ok(Math.abs(r.left)<1&&Math.abs(r.right-r.viewport)<1,'Full-width customer chrome: '+page.url())}
 const brand=await footer.locator('.market-footer-brand').innerText()
 for(const text of ['2-TAKA-R-BAZAR','Smart shopping. Real savings!','একসাথে কিনি, কম দামে পাই!'])assert.ok(brand.includes(text),'Complete footer brand: '+text)
 for(const [href,count] of [['/about',2],['/faq',2],['/privacy',1],['/terms',1],['/return-policy',1],['/refund-policy',1]])assert.equal(await footer.locator('a[href="'+href+'"]').count(),count,'Approved footer destinations')
 const contacts=await footer.locator('a[href^="mailto:"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')))
 assert.deepEqual(contacts,['mailto:business@2takarbazar.com','mailto:support@2takarbazar.com','mailto:business@2takarbazar.com','mailto:business@agentsiraji.com'])
 assert.equal(await footer.locator('a[href="/#your-community"]').count(),1,'Keep the owner-locked community destination')
 await assertMobileDock(page,width)
}
