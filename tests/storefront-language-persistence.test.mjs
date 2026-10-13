import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {languageFromPreference,isValidLanguagePreference,chooseText,STOREFRONT_LANGUAGE_COOKIE,DEFAULT_STOREFRONT_LANGUAGE} from '../lib/storefront-language.ts'
const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('first visit defaults EN; explicit BAN and EN cookies are recognized',()=>{
 assert.equal(DEFAULT_STOREFRONT_LANGUAGE,'en')
 assert.equal(languageFromPreference(undefined),'en')
 assert.equal(languageFromPreference('garbage'),'en')
 assert.equal(languageFromPreference('bn'),'bn')
 assert.equal(languageFromPreference('en'),'en')
 assert.equal(isValidLanguagePreference('bn'),true)
 assert.equal(isValidLanguagePreference('EN'),false)
 assert.equal(chooseText('bn','English','বাংলা'),'বাংলা')
 assert.equal(chooseText('en','English','বাংলা'),'English')
})
test('server passes the same cookie-selected language on initial rendering and demo pages',()=>{
 const index=source('app/page.tsx')
 assert.match(index,/cookies\(\)/)
 assert.match(index,/languageFromPreference\(storedLanguage\)/)
 assert.match(index,/initialLanguage=\{initialLanguage\}/)
 for(const route of ['app/demo-product/[id]/page.tsx','app/demo-pool/[slug]/page.tsx']){
  const code=source(route)
  assert.match(code,/cookies\(\)/)
  assert.match(code,/initialLanguage=\{languageFromPreference\(storedLanguage\)\}/)
 }
 assert.equal(STOREFRONT_LANGUAGE_COOKIE,'2tbr_storefront_language')
})
test('language changes persist across refresh, do not reset the browsing area, and do not touch auth',()=>{
 const hook=source('lib/use-storefront-language.ts')
 const market=source('components/public-marketplace.tsx')
 assert.match(hook,/document\.cookie=/)
 assert.match(hook,/localStorage\.setItem\(STOREFRONT_LANGUAGE_STORAGE,next\)/)
 assert.match(hook,/Max-Age=34560000/)
 assert.match(hook,/SameSite=Lax/)
 assert.match(hook,/localStorage\.getItem\(STOREFRONT_LANGUAGE_STORAGE\)/)
 assert.match(hook,/addEventListener\('storage',onStorage\)/)
 assert.match(market,/useStorefrontLanguage\(initialLanguage,hasLanguageCookie\)/)
 assert.match(market,/language=\{language\} onLanguageChange=\{setLanguage\}/)
 assert.match(market,/pickStoredBrowsingArea/)
 assert.doesNotMatch(hook,/supabase|signOut|localStorage\.clear\(\)/i)
})
test('customer can switch language from product or pool pages too',()=>{
 for(const comp of ['components/demo-product-details.tsx','components/demo-pool-detail.tsx']){
  const code=source(comp)
  assert.match(code,/useStorefrontLanguage\(initialLanguage,hasLanguageCookie\)/)
  assert.match(code,/onClick=\{\(\)=>setL(?:anguage|ang)\(/)
 }
})
