import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const cases=[
 ['app/admin/products/page.tsx','/admin/products','Active catalog','Archived products'],
 ['app/admin/own-products/page.tsx','/admin/own-products','Active own products','Archived own products'],
]

test('Admin catalog defaults to active products with a separate, explicit archived view',()=>{
 for(const [file,route,activeLabel,archiveLabel] of cases){
  const source=readFileSync(file,'utf8')
  assert.match(source,/const archived=sp\.view==='archived'/,file)
  assert.match(source,/\.eq\('active',!archived\)/,file)
  assert.ok(source.includes('href="'+route+'"'),file+' active navigation')
  assert.ok(source.includes('href="'+route+'?view=archived"'),file+' archived navigation')
  assert.ok(source.includes(activeLabel),file+' active label')
  assert.ok(source.includes(archiveLabel),file+' archived label')
  assert.ok(source.includes('aria-current={archived?'),file+' current view indicator')
  assert.match(source,/await requireAdmin\(\)/,file)
  assert.doesNotMatch(source,/\.delete\(|\.truncate\(|from\('orders'\).*delete/,file)
 }
})
