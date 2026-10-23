/**
 * Approved browser analytics events for 2TBR.
 * A commitment, reservation or provisional price is NEVER a paid Purchase.
 * No arbitrary event names or personal/customer identifiers may enter this boundary.
 */
export type PublicMarketingEventName =
  | 'view_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'pool_commitment_submit'
  | 'deal_commitment_submit'
  | 'final_price_confirmed'

export type PublicMarketingEvent = {
  name: PublicMarketingEventName
  item_id: string
  currency?: 'BDT'
  value?: number
  quantity?: number
}

export const MARKETING_EVENT_CHANNEL = '2tbr:marketing-event'
const APPROVED_EVENTS = new Set<PublicMarketingEventName>([
  'view_item', 'add_to_cart', 'begin_checkout',
  'pool_commitment_submit', 'deal_commitment_submit', 'final_price_confirmed',
])

/** Private, demo and customer-specific pages may never send browser marketing events. */
const PRIVATE_PREFIXES = [
  '/admin', '/super-admin', '/account', '/auth', '/login', '/signup',
  '/home', '/cart', '/checkout', '/orders', '/profile', '/money',
  '/savings', '/launch-orders', '/notifications', '/community',
  '/preview-demo', '/preview-live', '/commerce-uat', '/finance-uat',
  '/supplier', '/pickup', '/onboarding', '/verify-otp', '/qr',
]

export function mayTrackPublicPath(pathname: string): boolean {
  if (!pathname.startsWith('/') || pathname.includes('//')) return false
  return !PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export function normalizeMarketingEvent(input: unknown): PublicMarketingEvent | null {
  if (!input || typeof input !== 'object') return null
  const e = input as Partial<PublicMarketingEvent>
  if (typeof e.name !== 'string' || !APPROVED_EVENTS.has(e.name as PublicMarketingEventName)) return null
  if (typeof e.item_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(e.item_id)) return null
  if (e.currency !== undefined && e.currency !== 'BDT') return null
  if (e.value !== undefined && (!Number.isFinite(e.value) || e.value! < 0 || e.value! > 10000000)) return null
  if (e.quantity !== undefined && (!Number.isInteger(e.quantity) || e.quantity! < 1 || e.quantity! > 10000)) return null
  // Exact allowlist: silently strip any injected email, phone, GPS, order or user fields.
  return {
    name: e.name as PublicMarketingEventName,
    item_id: e.item_id,
    ...(e.currency === 'BDT' ? {currency: 'BDT' as const} : {}),
    ...(typeof e.value === 'number' ? { value: e.value } : {}),
    ...(typeof e.quantity === 'number' ? { quantity: e.quantity } : {}),
  }
}

export function emitPublicMarketingEvent(event: PublicMarketingEvent): void {
  if (typeof window === 'undefined' || !mayTrackPublicPath(window.location.pathname)) return
  const normalized = normalizeMarketingEvent(event)
  if (!normalized) return
  window.dispatchEvent(new CustomEvent(MARKETING_EVENT_CHANNEL, { detail: normalized }))
}
