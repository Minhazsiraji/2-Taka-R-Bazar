import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const actions=read('app/actions/product-wizard.ts')
const wizard=read('components/admin-product-create-wizard.tsx')
const picker=read('components/product-image-input.tsx')
const config=read('next.config.ts')
const sop=read('docs/product-upload-seo-aeo-geo-sop.md')
const browser=read('tests/account-security-browser-uat.mjs')

test('each optional media slot accepts a PC file or URL, including entirely empty rows',()=>{
 assert.match(wizard,/inputName=\{kind\+'_file_'\+i\}/)
 assert.match(wizard,/supplementary/)
 assert.match(wizard,/Or approved HTTPS URL \(optional\)/)
 assert.match(wizard,/All extra images and posters are optional/)
 assert.match(actions,/if\(!url&&!file&&!alt_en&&!alt_bn\)continue/)
 assert.match(actions,/if\(url&&file\)invalid/)
 assert.match(actions,/if\(!file&&!url\)invalid/)
 assert.match(actions,/if\(url&&!publicShowcaseImageUrl\(url\)\)/)
})
test('PC uploads validate genuine images with strict aggregate limits and transactional cleanup',()=>{
 assert.match(actions,/validateProductImage/)
 assert.match(actions,/5\*1024\*1024/)
 assert.match(actions,/objectPaths.push\(objectPath\)/)
 assert.match(actions,/const cleanup=async/)
 assert.match(actions,/if\(objectPaths.length\)await supabase.storage/)
 assert.match(actions,/await cleanup\(\)/)
 assert.match(actions,/admin_create_product_with_seo/)
 assert.match(config,/bodySizeLimit: '6mb'/)
 assert.match(actions,/if\(uploaded.error\)invalid/)
})
test('supplementary product files preserve all poster artwork and client page drafts',()=>{
 assert.match(picker,/MARKETING_TARGET_BYTES:MEDIA_TARGET_BYTES\):TARGET_BYTES,supplementary/)
 assert.match(picker,/preserveFullFrame/)
 assert.match(picker,/Never trim advertising\/poster borders/)
 assert.match(wizard,/sessionStorage\.setItem/)
 assert.match(wizard,/element\.type==='file'\)continue/)
 assert.match(wizard,/reselect the main or supplementary images/)
 // The current one-step product form exercises the master PC image independently.
 // The optional supplementary media contract remains covered above in the
 // legacy enrichment wizard and action tests.
 assert.match(browser,/quick-product-upload/)
 assert.match(browser,/input\[name="image_file"\]/)
 assert.match(sop,/No link required for a PC upload/)
})
