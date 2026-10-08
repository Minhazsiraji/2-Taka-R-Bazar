import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { loadSource } from './helpers/load-tsx.mjs'
const link = ({ children, ...props }) => createElement('a', props, children)

test('opportunity cards render accessible active and inactive states', async () => {
  const { OpportunityCard } = await loadSource('components/opportunity-card.tsx', { 'next/link': link })
  for (const [title, href] of [['Pools', '/pool'], ['Group Deals', '/group-deals']]) {
    const active = renderToStaticMarkup(createElement(OpportunityCard, { title, href, count: 2 }))
    assert.match(active, /2 Active/)
    assert.match(active, /Click to open/)
    assert.match(active, /cx-signal is-live/)
    assert.match(active, /Live now/)
    assert.ok(active.includes(`href="${href}"`))
    const inactive = renderToStaticMarkup(createElement(OpportunityCard, { title, href, count: 0 }))
    assert.match(inactive, /0 Active/)
    assert.match(inactive, /No live opportunity/)
    assert.doesNotMatch(inactive, /is-live/)
  }
})

test('Pool progress continues toward the next tier after a price unlock', async () => {
  const { PriceTargetProgress } = await loadSource('components/price-target-progress.tsx', { '@/lib/format': { taka: n => '৳' + n } })
  const html = renderToStaticMarkup(createElement(PriceTargetProgress, { currentQuantity: 10, households: 1, unlockedThreshold: 10, unlockedPrice: 985, nextThreshold: 50, nextPrice: 970, benchmarkPrice: 1000 }))
  assert.match(html, /985 unlocked/)
  assert.match(html, /10\/50 units/)
  assert.match(html, /40 more/)
  assert.match(html, /970/)
  assert.match(html, /aria-valuemax="50"/)
  assert.match(html, /aria-valuenow="10"/)
})

test('Preview demo is hard-gated to Vercel Preview and contains no auth bypass',()=> {
  const page = readFileSync(new URL('../app/preview-demo/page.tsx', import.meta.url),'utf8')
  assert.match(page,/process\.env\.VERCEL_ENV!=='preview'/)
  assert.match(page,/redirect\('\/login\?error=Preview\+demo\+is\+available\+only\+on\+Preview\+deployments'\)/)
  assert.doesNotMatch(page,/signInAnonymously/)
  assert.doesNotMatch(page,/requestLoginOtp/)
  assert.doesNotMatch(page,/service_role/i)
})

test('Preview demo is synthetic and covers all customer UAT sections without SMS',()=> {
  const page = readFileSync(new URL('../app/preview-demo/page.tsx', import.meta.url),'utf8')
  for (const label of ['Home','Pools','Group Deals','Orders','Savings']) assert.match(page,new RegExp(label))
  assert.match(page,/Preview-only synthetic UAT/)
  assert.match(page,/no SMS\/OTP used/)
  assert.match(page,/no Production customer data shown/)
  assert.match(page,/Amin Model Town/)
  assert.match(page,/Rupchanda Soybean Oil 5L/)
  assert.match(page,/Pusti Atta 2kg/)
})
