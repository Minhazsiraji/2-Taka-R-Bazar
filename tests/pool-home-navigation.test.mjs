import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('Home pool cards show participation and current saving potential',()=>{
  const home=read('app/home/page.tsx')
  assert.match(home,/get_pool_participation/)
  assert.match(home,/get_pool_price_unlocks/)
  assert.match(home,/benchmark_price_snapshot/)
  assert.match(home,/Families joined/)
  assert.match(home,/Saving potential/)
  assert.match(home,/savingPotential/)
})

test('Open pool targets only the selected pool while View all remains available',()=>{
  const home=read('app/home/page.tsx')
  const layout=read('app/pool/layout.tsx')
  const css=read('app/pool/pool-images.css')
  assert.match(home,/href=\{`\/pool#pool-\$\{pool\.id\}`\}/)
  assert.match(home,/href="\/pool"/)
  assert.match(layout,/pool-view/)
  assert.match(css,/:has\(section\[id\^="pool-"\]:target\)/)
  assert.match(css,/section\[id\^="pool-"\]:not\(:target\)/)
})

test('Pool detail stays compact on mobile without dropping information',()=>{
  const css=read('app/pool/pool-images.css')
  assert.match(css,/@media \(max-width: 639px\)/)
  assert.match(css,/grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css,/height: 13rem/)
  assert.match(css,/object-fit: contain/)
})
