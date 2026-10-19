import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const home=read('components/mobile-marketplace-home.tsx')
const header=read('components/public-header.tsx')
const css=read('app/marketplace-expo-parity.css')
test('compact native-style website header keeps real Cart, My Money and search',()=>{
 assert.match(header,/className="market-header-quick-link market-header-quick-cart"/)
 assert.match(header,/href="\/money" className="market-header-quick-link market-header-quick-money"/)
 assert.match(header,/market-header-search/)
 assert.match(css,/@media\(min-width:1100px\)/)
 assert.match(css,/grid-template-columns:minmax\(195px,1fr\) minmax\(230px,400px\) auto!important/)
})
test('right-side area picker is rounded, functional and retains the native selector',()=>{
 assert.match(home,/className="mhome-native-area"/)
 assert.match(home,/className="mhome-area-picker"/)
 assert.match(home,/className="mhome-area-menu"/)
 assert.match(css,/border-radius:14px;box-shadow:0 15px 35px/)
 assert.match(home,/onChooseArea\(a.community_id\)/)
})
test('six genuine Group Deals and 4 desktop Exclusive cards; no Ask for Price',()=>{
 assert.match(home,/GROUP_DEAL'\)\.slice\(0,6\)/)
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/)
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/)
 assert.doesNotMatch(home,/Ask for Price/)
 assert.match(home,/t\('View details','বিস্তারিত দেখুন'\)/)
 assert.match(home,/money\(p.price\)\?\?t\('Price not published'/)
 assert.match(home,/const canCart=!p.demo/)
})
test('Pool retains real images, participation and native app font pairing',()=>{
 assert.match(home,/const photoOffers=chosen.length\?chosen:p.bundle.slice\(0,3\)/)
 assert.match(home,/role="progressbar"/)
 assert.match(home,/aria-valuenow=\{Math.min\(p.sampleHouseholds,target\)\}/)
 assert.match(css,/Hind Siliguri/)
 assert.match(css,/Inter/)
 assert.match(css,/\.mhome-pool-bottom/)
})
