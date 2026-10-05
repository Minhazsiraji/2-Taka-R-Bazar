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
})

test('dark primary surfaces use the same deep family instead of a grey slab',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  assert.match(css,/--app-surface-primary: rgba\(7,13,22,\.90\)/)
  assert.match(css,/body\.site-glass-root main :is\(\.card,\.table-wrap,\.glass-panel\)/)
  assert.match(css,/background-image:none !important/)
  assert.match(css,/content:none !important/)
})

test('named glass panels outrank the legacy rounded-element dark rule',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  assert.match(css,/body\.site-glass-root main :is\(section,article,form,div,blockquote,aside,details\)\.glass-panel\[class\*="rounded-"\]/)
  assert.match(css,/\.glass-subpanel\[class\*="rounded-"\]/)
  assert.match(css,/\.glass-inset\[class\*="rounded-"\]/)
  assert.match(css,/html\[data-theme="light"\]/)
})

test('interactive glass inset controls keep explicit text contrast',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  assert.match(css,/:is\(a,button\)\.glass-inset/)
  assert.match(css,/--app-control-text: #e7eef9/)
  assert.match(css,/color:#e7eef9 !important/)
  assert.doesNotMatch(css,/main :is\(\.glass-subpanel,\.glass-inset,\.glass-icon\)/)
})

test('spending by person uses a dedicated progress fill outside rounded background utilities',()=>{
  const page=readFileSync(new URL('../app/money/page.tsx',import.meta.url),'utf8')
  assert.match(page,/money-person-progress-track/)
  assert.match(page,/money-person-progress-fill/)
  assert.match(page,/Math\.max\(3,Math\.min\(100,row\.amount\/max\*100\)\)/)
  assert.match(page,/linear-gradient\(90deg,#13cfc8,#0b8995\)/)
  assert.match(page,/role="progressbar"/)
})
