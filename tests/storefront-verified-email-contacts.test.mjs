import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const config=read('lib/site.ts')
const home=read('app/page.tsx')
const footer=read('components/storefront-footer.tsx')
const developerFooter=read('components/site-footer.tsx')
test('verified business and support emails are centrally defined without secrets',()=>{
 assert.ok(config.includes("BUSINESS_CONTACT_EMAIL = 'business@2takarbazar.com'"))
 assert.ok(config.includes("SUPPORT_CONTACT_EMAIL = 'support@2takarbazar.com'"))
 assert.ok(config.includes('PUBLIC_CONTACT_EMAIL = SUPPORT_CONTACT_EMAIL'))
 assert.ok(!config.includes('smtp-relay.brevo.com'))
})
test('storefront footer uses customer support and business mailto links',()=>{
 assert.ok(footer.includes('mailto:${BUSINESS_CONTACT_EMAIL}'))
 assert.ok(footer.includes('mailto:${SUPPORT_CONTACT_EMAIL}'))
 assert.ok(footer.includes('For business and supplier enquiries'))
 assert.ok(footer.includes('For customer support'))
})
test('structured data separates business identity and customer support',()=>{
 assert.ok(home.includes('email:BUSINESS_CONTACT_EMAIL'))
 assert.ok(home.includes("contactType:'customer service',email:SUPPORT_CONTACT_EMAIL"))
})
test('AgentSiraji developer contact and both permanent brand taglines remain unchanged',()=>{
 assert.ok(footer.includes('business@agentsiraji.com'))
 assert.ok(developerFooter.includes('business@agentsiraji.com'))
 assert.ok(config.includes('Smart shopping. Real savings!'))
 assert.ok(config.includes('একসাথে কিনি, কম দামে পাই!'))
})
