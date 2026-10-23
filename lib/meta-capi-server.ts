/**
 * Server-side Meta CAPI transport for audited, paid, real orders ONLY.
 *
 * No public API route invokes this module. A future finance settlement worker
 * must supply a durable, atomic outbox implementation and evidence from an
 * authoritative DB record, including the consent snapshot. Never send from a
 * quote, a Pool commitment, checkout click, receipt draft or demo fixture.
 *
 * META_CAPI_ENABLED defaults off. Tokens are server-only Vercel secrets.
 */
import { SITE_URL } from '@/lib/site'

export type ConfirmedPurchaseEvidence = Readonly<{
  orderId: string
  state: 'paid_confirmed'
  source: 'authoritative_finance_settlement'
  isDemo: false
  marketingConsentRecorded: true
  paidAmountBdt: number
  confirmedAtUnix: number
  items: ReadonlyArray<Readonly<{ sku: string; quantity: number; paidUnitPriceBdt: number }>>
  // Collected only from an already-consented user session, if available.
  fbp?: string
  fbc?: string
}>

type MetaPurchasePayload = {
  event_name: 'Purchase'
  event_time: number
  event_id: string
  action_source: 'website'
  event_source_url: string
  user_data: { fbp?: string; fbc?: string }
  custom_data: {
    currency: 'BDT'
    value: number
    contents: { id: string; quantity: number; item_price: number }[]
    order_id: string
  }
}

type MetaOutbox = {
  /** Atomic, durable claim on event_id; must be concurrency-safe across workers. */
  claim(eventId: string): Promise<boolean>
  markDelivered(eventId: string): Promise<void>
  markRetryable(eventId: string): Promise<void>
}
type SendResult = 'disabled' | 'ineligible' | 'already_claimed' | 'accepted' | 'retryable'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SKU = /^[a-z0-9][a-z0-9_-]{0,95}$/i
const COOKIE = /^fb\.[0-9]+\.[0-9]+\.[a-zA-Z0-9]+$/

function positiveMoney(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 10000000
}

/** Validated event identity MUST be identical for Pixel eventID and CAPI event_id. */
export function buildVerifiedMetaPurchase(input: unknown): MetaPurchasePayload | null {
  if (!input || typeof input !== 'object') return null
  const e = input as Partial<ConfirmedPurchaseEvidence>
  if (e.source !== 'authoritative_finance_settlement' || e.state !== 'paid_confirmed' ||
    e.isDemo !== false || e.marketingConsentRecorded !== true ||
    typeof e.orderId !== 'string' || !UUID.test(e.orderId) || !positiveMoney(e.paidAmountBdt) ||
    typeof e.confirmedAtUnix !== 'number' || !Number.isInteger(e.confirmedAtUnix) || e.confirmedAtUnix <= 0 ||
    (e.confirmedAtUnix ?? 0) > Math.floor(Date.now() / 1000) + 60 ||
    (e.confirmedAtUnix ?? 0) < Math.floor(Date.now() / 1000) - 6 * 86400 ||
    !Array.isArray(e.items) || e.items.length === 0 || e.items.length > 100) return null

  const contents: { id: string; quantity: number; item_price: number }[] = []
  let sum = 0
  for (const item of e.items) {
    if (typeof item.sku !== 'string' || !SKU.test(item.sku) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000 ||
      !positiveMoney(item.paidUnitPriceBdt)) return null
    sum += item.quantity * item.paidUnitPriceBdt
    contents.push({ id: item.sku, quantity: item.quantity, item_price: item.paidUnitPriceBdt })
  }
  // Allow an actual paid delivery fee/adjustment, but reject a large mismatch.
  if (sum > e.paidAmountBdt + 0.01 || e.paidAmountBdt - sum > 10000) return null

  const user_data: { fbp?: string; fbc?: string } = {}
  if (typeof e.fbp === 'string' && COOKIE.test(e.fbp)) user_data.fbp = e.fbp
  if (typeof e.fbc === 'string' && COOKIE.test(e.fbc)) user_data.fbc = e.fbc
  // Never send a matchless event, email/phone/GPS/payment field or unconsented ID.
  if (!user_data.fbp && !user_data.fbc) return null
  return {
    event_name: 'Purchase',
    event_time: e.confirmedAtUnix!,
    event_id: '2tbr:paid:' + e.orderId,
    action_source: 'website',
    event_source_url: SITE_URL + '/',
    user_data,
    custom_data: {
      currency: 'BDT', value: e.paidAmountBdt,
      contents,
      order_id: e.orderId,
    },
  }
}

/**
 * Disabled unless explicitly enabled and server secrets exist.
 * Durable outbox supplied by future verified finance worker; no RPC or route
 * can invoke this directly from user input.
 */
export async function sendVerifiedMetaPurchase(
  evidence: unknown,
  outbox: MetaOutbox,
  transport?: typeof fetch,
): Promise<SendResult> {
  if (process.env.META_CAPI_ENABLED !== 'true') return 'disabled'
  const pixel = process.env.META_CAPI_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN
  const version = process.env.META_GRAPH_API_VERSION ?? 'v24.0'
  if (!pixel || !/^[0-9]{10,20}$/.test(pixel) || !token || !/^v[0-9]{1,2}\.[0-9]+$/.test(version)) return 'disabled'
  const data = buildVerifiedMetaPurchase(evidence)
  if (!data) return 'ineligible'
  if (!await outbox.claim(data.event_id)) return 'already_claimed'
  try {
    const response = await (transport ?? fetch)('https://graph.facebook.com/' + version + '/' + pixel + '/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [data], access_token: token }),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!response.ok) {
      await outbox.markRetryable(data.event_id)
      return 'retryable'
    }
    await outbox.markDelivered(data.event_id)
    // "accepted" means HTTP success, not proven Meta attribution/deduplication.
    return 'accepted'
  } catch {
    await outbox.markRetryable(data.event_id)
    return 'retryable'
  }
}
