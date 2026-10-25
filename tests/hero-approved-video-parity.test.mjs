import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'

const home=readFileSync('components/mobile-marketplace-home.tsx','utf8')
const layout=readFileSync('app/layout.tsx','utf8')
const css=readFileSync('app/marketplace-hero-video.css','utf8')
const media=readFileSync('public/2TBR-hero.mp4')
const mobile=readFileSync('mobile/assets/2TBR-hero-mobile-optimized.mp4')

test('website serves the exact eight-second video bundled in the approved Expo app',()=>{
 assert.ok(media.equals(mobile),'Website and Expo hero media must remain byte-identical')
 const gitBlob=createHash('sha1').update(Buffer.from('blob '+media.length+'\0')).update(media).digest('hex')
 assert.equal(gitBlob,'d1158ec85289d610f13cd5dcbd16f9fd6a779b19')
 assert.equal(media.toString('ascii',4,8),'ftyp')
 assert.ok(media.length<250_000,'Hero stays lightweight on mobile')
})
test('the only new homepage visual layer is a silent looping full-frame background',()=>{
 assert.match(home,/<video ref=\{heroVideoRef\} className="mhome-hero-video" src="\/2TBR-hero.mp4"/)
 assert.match(home,/autoPlay muted playsInline loop preload="auto"/)
 assert.match(home,/poster="\/2tbr-app-hero.jpg"/)
 assert.match(home,/aria-hidden="true" tabIndex=\{-1\}/)
 assert.match(home,/onTimeUpdate=\{event=>/)
 assert.match(home,/time\+1<previousHeroVideoTime.current/)
 assert.match(home,/onError=\{\(\)=>\{setHeroVideoFailed\(true\)/)
 assert.match(home,/onClick=\{\(\)=>selectHeroSlide\(slide-1\)\}/)
 assert.match(home,/onClick=\{\(\)=>selectHeroSlide\(slide\+1\)\}/)
 assert.match(home,/onClick=\{\(\)=>selectHeroSlide\(i\)\}/)
 assert.match(home,/SMART SHOPPING\. REAL SAVINGS!/)
 assert.match(home,/Buy together, save together\./)
 assert.equal((home.match(/actionBn:/g)||[]).length,4,'All four bilingual slide and CTA definitions remain')
 assert.match(layout,/import '\.\/marketplace-hero-video\.css'/)
 assert.match(css,/object-fit:cover/)
 assert.match(css,/@media\(min-width:768px\)/)
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
 assert.doesNotMatch(css,/\.mhome-(savings|deal|exclusive|pool|area|footer)/,'No other homepage section should be restyled')
})
