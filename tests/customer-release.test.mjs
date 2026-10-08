import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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

test('production, development and unset environments reject demo before touching authentication', async () => {
  for (const VERCEL_ENV of ['production', 'development', undefined]) {
    const { GET } = await loadSource('app/preview-demo/route.ts', {
      'next/server': { NextResponse: { redirect: url => ({ url: String(url) }) } },
      '@/lib/supabase/server': { createClient: () => { throw new Error('Authentication must not run') } },
    }, { VERCEL_ENV })
    for (const host of ['2takarbazar.com', 'www.2takarbazar.com']) {
      const response = await GET({ url: `https://${host}/preview-demo` })
      assert.ok(response.url.startsWith(`https://${host}/login?error=`))
    }
  }
})

test('preview demo uses anonymous auth and the E2E community without SMS or privileged clients', async () => {
  const calls = []
  const chain = table => {
    const q = {
      select() { return q }, eq(key, value) { calls.push([table, key, value]); return q },
      order() { return q }, limit() { return q },
      update(value) { calls.push([table, 'update', value]); return q },
      maybeSingle: async () => ({ data: { id: table === 'communities' ? 'synthetic-community' : 'synthetic-pickup' } }),
    }
    return q
  }
  const { GET } = await loadSource('app/preview-demo/route.ts', {
    'next/server': { NextResponse: { redirect: url => ({ url: String(url) }) } },
    '@/lib/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: {} }), signInAnonymously: async () => ({ data: { user: { id: '00000000-0000-0000-0000-000000000001' } } }) },
      from: chain,
    }) },
  }, { VERCEL_ENV: 'preview' })
  const result = await GET({ url: 'https://example.vercel.app/preview-demo' })
  assert.equal(result.url, 'https://example.vercel.app/home')
  assert.ok(calls.some(c => c[0] === 'communities' && c[1] === 'slug' && c[2] === 'e2e-uat-community'))
  const update = calls.find(c => c[1] === 'update')[2]
  assert.equal(update.community_id, 'synthetic-community')
  assert.equal(update.full_name, 'Preview Demo Customer')
  assert.ok(calls.every(c => !['user_roles', 'supplier_users'].includes(c[0])))
})
