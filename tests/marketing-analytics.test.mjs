import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

test('tracking is disabled until an explicit feature flag, valid ID and opt-in', () => {
  const src = read('components/consent-aware-analytics.tsx')
  assert.match(src, /NEXT_PUBLIC_MARKETING_TRACKING_ENABLED === 'true'/)
  assert.match(src, /const CAN_RUN = TRACKING_ENABLED && \(GA_VALID \|\| META_VALID\)/)
  assert.match(src, /if \(!CAN_RUN \|\| !ready\) return null/)
  assert.match(src, /localStorage\.getItem\(KEY\)/)
  assert.match(src, /if \(!CAN_RUN \|\| !ready \|\| !consent \|\| consent === 'none'\) return/)
  assert.match(src, /choose\('none'\)/)
  assert.match(src, /choose\('analytics'\)/)
  assert.match(src, /choose\('all'\)/)
  assert.match(src, /location\.reload\(\)/) // remove previously loaded tags on revocation
})

test('browser measurement excludes customer/admin URLs and never emits Purchase', () => {
  const src = read('lib/marketing-events.ts')
  const component = read('components/consent-aware-analytics.tsx')
  assert.match(src, /'\/admin'/)
  assert.match(src, /'\/checkout'/)
  assert.match(src, /'\/orders'/)
  assert.match(src, /'\/preview-demo'/)
  assert.match(src, /pool_commitment_submit/)
  assert.match(src, /deal_commitment_submit/)
  assert.match(component, /trackCustom/)
  assert.doesNotMatch(component, /fbq\?\.\('track', 'Purchase'/)
  assert.doesNotMatch(src, /['"]purchase['"]\s*[,|]/)
})

test('safe item payload allowlists identifiers, BDT, quantity, and excludes PII', () => {
  const src = read('lib/marketing-events.ts')
  assert.match(src, /currency !== 'BDT'/)
  assert.match(src, /Number\.isFinite/)
  assert.match(src, /Number\.isInteger/)
  assert.match(src, /Exact allowlist/)
  assert.doesNotMatch(src, /e\.email/)
  assert.doesNotMatch(src, /e\.phone/)
  assert.doesNotMatch(src, /e\.latitude/)
})

test('pageview and published SEO product view are emitted only from browser after consent', () => {
  const component = read('components/consent-aware-analytics.tsx')
  const layout = read('app/layout.tsx')
  const product = read('components/public-seo-product-page.tsx')
  assert.match(read('components/pwa-register.tsx'), /<ConsentAwareAnalytics \/>/)
  assert.match(layout, /<PwaRegister \/>/)
  assert.match(component, /send_page_view: false/)
  assert.match(component, /mayTrackPublicPath\(pathname\)/)
  assert.match(component, /data-analytics-item-id/)
  assert.match(component, /metaPage\.current !== pathname/)
  assert.match(product, /data-analytics-item-id=\{p\.sku\}/)
  assert.doesNotMatch(layout, /googletagmanager\.com/)
  assert.doesNotMatch(layout, /connect\.facebook\.net/)
})

test('privacy policy discloses bilingual granular opt-in and withdrawal', () => {
  const privacy = read('app/privacy/page.tsx')
  assert.match(privacy, /Optional analytics and advertising measurement/)
  assert.match(privacy, /ঐচ্ছিক অ্যানালিটিক্স/)
  assert.match(privacy, /Privacy choices/)
})
