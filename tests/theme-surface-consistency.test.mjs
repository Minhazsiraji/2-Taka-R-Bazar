import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('final surface harmonization loads after other theme layers',()=>{
  const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8')
  const marker="import './site-theme-surface-fix.css'"
  assert.match(layout,/site-theme-surface-fix\.css/)
  assert.ok(layout.indexOf(marker)>layout.indexOf("import './site-theme-admin.css'"))
})

test('home and money glass surfaces avoid the duplicate grey theme layer',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  assert.match(css,/\.home-liquid-route \{\s*background: transparent !important;/)
  assert.match(css,/\.glass-panel\.glass-panel\.glass-panel\.glass-panel\.glass-panel/)
  assert.match(css,/background: var\(--glass-panel\) !important/)
  assert.match(css,/html\[data-theme="dark"\][\s\S]*rgba\(24,34,50,\.78\)/)
  assert.match(css,/\.glass-inset\.glass-inset\.glass-inset\.glass-inset\.glass-inset/)
  assert.match(css,/content: none !important/)
})
