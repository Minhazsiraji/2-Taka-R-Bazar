import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const styles=read('app/marketplace-story.css')
const page=read('components/public-marketplace-lower.tsx')
const browser=read('tests/storefront-browser-uat.mjs')

test('customer experiences copy stacks full-width under trust label on phones and tablets',()=>{
 assert.match(styles,/@media\(max-width:767px\)/)
 assert.match(styles,/\.market-story #customer-experiences \.market-review-pending\{\s*display:grid/)
 assert.match(styles,/grid-template-columns:minmax\(0,1fr\)/)
 assert.match(styles,/\.market-story #customer-experiences \.market-review-pending>div:nth-child\(2\)\{[\s\S]*?grid-row:2;[\s\S]*?min-width:0;[\s\S]*?width:100%/)
 assert.match(styles,/\.market-story #customer-experiences \.market-review-note\{[\s\S]*?grid-row:1;[\s\S]*?justify-self:end;[\s\S]*?margin:0/)
 assert.match(styles,/overflow-wrap:break-word/)
})
test('reviews retain meaningful honest copy, accessible language and glass branding',()=>{
 assert.match(page,/id="customer-experiences"/)
 assert.match(page,/market-review-pending/)
 assert.match(page,/Verified purchases only/)
 assert.match(page,/No borrowed quotes, invented customers, fabricated ratings or unverified savings/)
 assert.match(page,/lang=\{language\}/)
 assert.match(styles,/market-review-mark\{[\s\S]*?color:var\(--theme-accent/)
 assert.match(read('app/marketplace-unified.css'),/\.market-story \.market-review-pending/)
})
test('real browser verifies the section at small widths in EN/BN and dark mode',()=>{
 assert.match(browser,/async function assertReviewLayout/)
 assert.match(browser,/width<=767/)
 assert.match(browser,/copyWidth>=geometry\.cardWidth\*\.72/)
 assert.match(browser,/copyTop>=geometry\.noteBottom-1/)
 assert.match(browser,/await assertReviewLayout\(page,width\)/)
 assert.match(browser,/Bengali: ensure the review copy stays full width/)
});
