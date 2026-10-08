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


test('named admin and pool surfaces keep dedicated theme contracts',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  for(const name of ['data-snapshot-card','quick-decisions-panel','quick-decision-link','product-image-surface','pool-price-metrics','price-target-track','price-target-fill','price-target-unlock']) assert.match(css,new RegExp(name))
  assert.match(css,/product-image-surface[\s\S]*background:#fff !important/)
  assert.match(css,/price-target-fill[\s\S]*#67e8f9/)
})


test('legacy dark rounded rule stays on the shell surface and exempts special surfaces',()=>{
  const css=readFileSync(new URL('../app/site-theme.css',import.meta.url),'utf8')
  assert.match(css,/background: rgba\(7,13,22,\.90\) !important/)
  for(const name of ['product-image-surface','notice','success','error','pool-price-note']) assert.match(css,new RegExp(':not\\(\\.'+name+'\\)'))
  assert.doesNotMatch(css,/linear-gradient\(145deg,rgba\(23,33,49,\.74\),rgba\(13,21,33,\.58\)\)/)
})


test('remaining money admin and pool surfaces have exact named dark contracts',()=>{
  const money=readFileSync(new URL('../app/money/page.tsx',import.meta.url),'utf8')
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  assert.match(money,/money-person-row/)
  assert.match(money,/money-account-row/)
  for(const name of ['money-person-row','money-account-row','data-snapshot-card','quick-decisions-panel','product-image-surface']) assert.match(css,new RegExp(name))
  assert.match(css,/main \.product-image-surface[\s\S]*background:#fff !important/)
  assert.match(css,/money-account-row[\s\S]*background:rgba\(7,13,22,\.90\) !important/)
})

test('brand glow covers buttons links and progress rims without reviving legacy image paint',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  const pool=readFileSync(new URL('../app/pool/page.tsx',import.meta.url),'utf8')
  const image=readFileSync(new URL('../components/product-image.tsx',import.meta.url),'utf8')
  for(const token of ['--brand-rim','--brand-glow-strong','super-admin-nav-link','role="progressbar"']) assert.ok(css.includes(token))
  assert.match(css,/translateY\(-1px\)/)
  assert.match(pool,/ProductImage/)
  assert.doesNotMatch(pool,/product-image-surface/)
  assert.match(image,/bg-white/)
  assert.match(image,/object-contain/)
})

test('final glow contract covers marked cards and compact Pool images stay inside their mobile column',()=>{
  const css=readFileSync(new URL('../app/site-theme-surface-fix.css',import.meta.url),'utf8')
  const pool=readFileSync(new URL('../app/pool/page.tsx',import.meta.url),'utf8')
  const image=readFileSync(new URL('../components/product-image.tsx',import.meta.url),'utf8')
  assert.match(css,/\.card,.data-snapshot-card,.money-person-row,.money-account-row,.quick-decisions-panel,.price-target-progress/)
  assert.match(css,/\.app-shell-header a\[class\*="rounded-"\]/)
  assert.match(css,/nav\[aria-label="My Money navigation"\] a\[class\*="rounded-"\]/)
  assert.match(pool,/grid min-w-0 grid-cols-\[80px_minmax\(0,1fr\)\]/)
  assert.match(pool,/variant="thumb"/)
  assert.match(image,/overflow-hidden/)
  assert.match(image,/object-contain/)
})
