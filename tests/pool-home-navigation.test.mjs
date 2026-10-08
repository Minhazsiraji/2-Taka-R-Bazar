import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('Home pool cards show participation and current saving potential',()=>{
  const home=read('app/home/page.tsx')
  assert.match(home,/get_pool_participation/)
  assert.match(home,/get_pool_price_unlocks/)
  assert.match(home,/benchmark_price_snapshot/)
  assert.match(home,/households/)
  assert.match(home,/current saving/)
  assert.match(home,/savingPotential/)
  assert.match(home,/Best next saving move/)
})

test('Open pool targets only the selected pool while View all remains available',()=>{
  const home=read('app/home/page.tsx')
  const layout=read('app/pool/layout.tsx')
  const css=read('app/pool/pool-images.css')
  assert.match(home,/href=\{'\/pool#pool-'\+pool\.id\}/)
  assert.match(home,/href="\/pool"/)
  assert.match(layout,/pool-view/)
  assert.match(css,/:has\(section\[id\^="pool-"\]:target\)/)
  assert.match(css,/section\[id\^="pool-"\]:not\(:target\)/)
})

test('Pool detail uses shared responsive customer layout without legacy grid overrides',()=>{
  const localCss=read('app/pool/pool-images.css')
  const customerCss=read('app/site-customer-experience.css')
  const image=read('components/product-image.tsx')
  assert.doesNotMatch(localCss,/grid-template-columns/)
  assert.match(customerCss,/\.cx-product-layout/)
  assert.match(customerCss,/@media \(max-width:767px\)/)
  assert.match(customerCss,/grid-template-columns:minmax\(0,1fr\)/)
  assert.match(image,/object-contain/)
})

test('paused pools are not advertised as available on customer Home',()=>{
  const home=read('app/home/page.tsx')
  assert.match(home,/status,is_paused,pickup_at/)
  assert.match(home,/filter\(\(pool:any\)=>!pool\.is_paused\)/)
})

test('paused pools stay visible only to customers with an existing commitment and never show Open status',()=>{
  const pool=read('app/pool/page.tsx')
  assert.match(pool,/const visiblePools=\(pools\?\?\[\]\)\.filter/)
  assert.match(pool,/if\(!pool\.is_paused\)return true/)
  assert.match(pool,/commitments\.has\(item\.id\)/)
  assert.match(pool,/StatusPill status=\{pool\.is_paused\?'paused':pool\.status\}/)
  assert.match(pool,/!visiblePools\.length/)
  assert.match(pool,/visiblePools\.map/)
})
