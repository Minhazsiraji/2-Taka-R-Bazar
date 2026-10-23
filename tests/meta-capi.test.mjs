import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadSource } from './helpers/load-tsx.mjs'

const src = readFileSync('lib/meta-capi-server.ts', 'utf8')
const { buildVerifiedMetaPurchase, sendVerifiedMetaPurchase } = await loadSource(
  'lib/meta-capi-server.ts',
  { '@/lib/site': { SITE_URL: 'https://2takarbazar.com' } },
  { META_CAPI_ENABLED: 'false' },
)
const now = Math.floor(Date.now() / 1000)
const receipt = {
  orderId: 'a8f23c10-9e7b-46d0-bad2-248ac7ef70b1',
  state: 'paid_confirmed',
  source: 'authoritative_finance_settlement',
  isDemo: false,
  marketingConsentRecorded: true,
  paidAmountBdt: 1350,
  confirmedAtUnix: now,
  items: [{ sku: 'GHEE-1KG-UNB-002', quantity: 1, paidUnitPriceBdt: 1300 }],
  fbp: 'fb.1.1792740000.100200300',
}
test('confirmed real BDT payment creates stable Meta id and bounded event payload', () => {
  const data = buildVerifiedMetaPurchase(receipt)
  assert.ok(data)
  assert.equal(data.event_name, 'Purchase')
  assert.equal(data.event_id, '2tbr:paid:' + receipt.orderId)
  assert.equal(data.custom_data.currency, 'BDT')
  assert.equal(data.custom_data.value, 1350)
  assert.deepEqual(data.custom_data.contents.map(x=>x.id), ['GHEE-1KG-UNB-002'])
  assert.equal(data.user_data.fbp, receipt.fbp)
})
test('no fake purchases from demo, unpaid, no consent, no matching cookie, price mismatch', () => {
  const cases = [
    { state: 'pending' }, { isDemo: true }, { marketingConsentRecorded: false },
    { fbp: '', fbc: '' }, { paidAmountBdt: 100 }, { confirmedAtUnix: now - 10 * 86400 },
    { items: [{ sku: 'bad sku/PII', quantity: 1, paidUnitPriceBdt: 1300 }] },
  ]
  for (const change of cases) {
    assert.equal(buildVerifiedMetaPurchase({ ...receipt, ...change }), null)
  }
})
test('CAPI dispatch has no client endpoint and is disabled without owner release flag', async () => {
  assert.doesNotMatch(src, /NEXT_PUBLIC_META_CAPI_ACCESS_TOKEN/)
  assert.match(src, /process\.env\.META_CAPI_ENABLED !== 'true'/)
  assert.match(src, /await outbox\.claim\(data\.event_id\)/)
  assert.match(src, /await outbox\.markRetryable\(data\.event_id\)/)
  const result = await sendVerifiedMetaPurchase(receipt, {
    claim: async()=>{ throw new Error('Outbox should not be called when disabled') },
    markDelivered: async()=>{}, markRetryable: async()=>{},
  })
  assert.equal(result, 'disabled')
})
