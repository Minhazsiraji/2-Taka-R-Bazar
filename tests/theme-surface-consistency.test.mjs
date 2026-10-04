import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('final surface harmonization loads after every theme layer',()=>{
  const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8')
  const marker="import './site-theme-surface-fix.css'"
  assert.match(layout,/site-theme-surface-fix\.css/)
  assert.ok(layout.indexOf(marker)>layout.indexOf("import './site-theme-admin.css'"))
})

test('surface contract applies across customer money operations and super admin pages',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  assert.match(css,/\.app-shell-header-bar/)
  assert.match(css,/main \.card/)
  assert.match(css,/main \.table-wrap/)
  assert.match(css,/main \.glass-panel/)
  assert.match(css,/aside\[class\*="rounded-"\]/)
  assert.match(css,/details\[class\*="rounded-"\]/)
  assert.match(css,/\[class\*="bg-white"\]/)
  assert.match(css,/\[class\*="bg-slate-"\]/)
})

test('light and dark surfaces remove duplicate decorative layers',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  assert.match(css,/--app-surface-primary: var\(--glass-panel\)/)
  assert.match(css,/html\[data-theme="dark"\][\s\S]*--app-surface-primary: linear-gradient/)
  assert.match(css,/main :is\(\.card,\.table-wrap,\.glass-panel\)::before/)
  assert.match(css,/content: none !important/)
  assert.match(css,/\.home-liquid-route \{ background: transparent !important; \}/)
})
