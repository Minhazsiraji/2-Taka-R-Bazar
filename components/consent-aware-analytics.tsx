'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  MARKETING_EVENT_CHANNEL, mayTrackPublicPath, normalizeMarketingEvent,
  type PublicMarketingEvent,
} from '@/lib/marketing-events'

type Consent = 'all' | 'analytics' | 'none'
type TrackerWindow = Window & {
  dataLayer?: unknown[][]
  gtag?: (...args: unknown[]) => void
  fbq?: PixelFunction
}
type PixelFunction = ((...args: unknown[]) => void) & { queue?: unknown[][]; loaded?: boolean; version?: string }

const KEY = '2tbr-optional-tracking-consent-v1'
const TRACKING_ENABLED = process.env.NEXT_PUBLIC_MARKETING_TRACKING_ENABLED === 'true'
const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? ''
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''
const GA_VALID = /^G-[A-Z0-9]{5,16}$/.test(GA_ID)
const META_VALID = /^[0-9]{10,20}$/.test(PIXEL_ID)
const CAN_RUN = TRACKING_ENABLED && (GA_VALID || META_VALID)

function googleTag(consent: Consent) {
  if (!GA_VALID || consent === 'none') return
  const w = window as TrackerWindow
  if (!w.gtag) {
    w.dataLayer = w.dataLayer || []
    w.gtag = (...args: unknown[]) => { w.dataLayer!.push(args) }
    w.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: consent === 'all' ? 'granted' : 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    w.gtag('js', new Date())
    w.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true })
  }
  if (!document.getElementById('2tbr-ga4-tag')) {
    const tag = document.createElement('script')
    tag.id = '2tbr-ga4-tag'
    tag.async = true
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID)
    document.head.appendChild(tag)
  }
}

function metaPixel() {
  if (!META_VALID) return
  const w = window as TrackerWindow
  if (!w.fbq) {
    const fn = ((...args: unknown[]) => { fn.queue!.push(args) }) as PixelFunction
    fn.queue = []
    fn.loaded = true
    fn.version = '2.0'
    w.fbq = fn
    w.fbq('init', PIXEL_ID)
  }
  if (!document.getElementById('2tbr-meta-pixel-tag')) {
    const tag = document.createElement('script')
    tag.id = '2tbr-meta-pixel-tag'
    tag.async = true
    tag.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(tag)
  }
}

function trackPageView(pathname: string, ga: boolean, meta: boolean) {
  if (!mayTrackPublicPath(pathname)) return
  const w = window as TrackerWindow
  if (ga) w.gtag?.('event', 'page_view', { page_location: location.origin + pathname, page_path: pathname })
  if (meta) w.fbq?.('track', 'PageView')
}

function trackProductEvent(e: PublicMarketingEvent, ga: boolean, meta: boolean) {
  const w = window as TrackerWindow
  if (ga) {
    const params = {
      currency: 'BDT',
      ...(e.value !== undefined ? { value: e.value } : {}),
      items: [{ item_id: e.item_id, ...(e.quantity ? { quantity: e.quantity } : {}) }],
    }
    w.gtag?.('event', e.name, params)
  }
  if (meta) {
    const params = {
      currency: 'BDT',
      ...(e.value !== undefined ? { value: e.value } : {}),
      content_ids: [e.item_id],
      content_type: 'product',
      ...(e.quantity ? { num_items: e.quantity } : {}),
    }
    const standard = ({ view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout' } as Record<string, string>)[e.name]
    if (standard) w.fbq?.('track', standard, params)
    else w.fbq?.('trackCustom', e.name, params)
  }
}

/**
 * This is opt-in and does not load ANY third-party analytics script unless:
 * - build-time feature flag is enabled; and
 * - a validated account-owned measurement ID is configured; and
 * - the visitor opted in.
 *
 * No purchase event exists here: only authoritative server settlement is allowed
 * to create purchase attribution in a future audited integration.
 */
export function ConsentAwareAnalytics() {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [consent, setConsent] = useState<Consent | null>(null)
  const [choicesOpen, setChoicesOpen] = useState(false)
  const gaPage = useRef<string | null>(null)
  const metaPage = useRef<string | null>(null)

  useEffect(() => {
    if (!CAN_RUN) return
    try {
      const saved = localStorage.getItem(KEY)
      if (saved === 'all' || saved === 'analytics' || saved === 'none') setConsent(saved)
    } catch { /* Private browsing: show choices per visit. */ }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!CAN_RUN || !ready || !consent || consent === 'none') return
    const hasGa = GA_VALID && (consent === 'all' || consent === 'analytics')
    const hasMeta = META_VALID && consent === 'all'
    if (hasGa) googleTag(consent)
    if (hasMeta) metaPixel()
    if (!mayTrackPublicPath(pathname)) return
    if (hasGa && gaPage.current !== pathname) {
      trackPageView(pathname, true, false)
      gaPage.current = pathname
    }
    if (hasMeta && metaPage.current !== pathname) {
      trackPageView(pathname, false, true)
      metaPage.current = pathname
    }
  }, [consent, pathname, ready])

  useEffect(() => {
    if (!CAN_RUN || !ready || !consent || consent === 'none') return
    const handler = (incoming: Event) => {
      if (!mayTrackPublicPath(window.location.pathname)) return
      const e = normalizeMarketingEvent((incoming as CustomEvent<unknown>).detail)
      if (!e) return
      trackProductEvent(e, GA_VALID, META_VALID && consent === 'all')
    }
    window.addEventListener(MARKETING_EVENT_CHANNEL, handler)
    return () => window.removeEventListener(MARKETING_EVENT_CHANNEL, handler)
  }, [consent, ready])

  if (!CAN_RUN || !ready) return null

  function choose(value: Consent) {
    try { localStorage.setItem(KEY, value) } catch { /* Consent still applies to this session. */ }
    setChoicesOpen(false)
    // The only reliable way to unload existing third-party scripts on revocation.
    if (consent && consent !== 'none' && value !== consent) {
      location.reload()
      return
    }
    setConsent(value)
  }

  return (
    <>
      {(consent === null || choicesOpen) && (
        <section aria-label="Optional analytics and marketing choices" role="dialog" aria-modal="false"
          className="fixed left-3 right-3 z-[100] mx-auto max-w-lg rounded-2xl border border-white/45 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-xl"
          style={{ bottom: 'max(5rem, env(safe-area-inset-bottom))' }}>
          <p className="text-sm font-semibold">Privacy choices · আপনার গোপনীয়তা</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-100">
            Optional analytics help us improve shopping; marketing measurement helps us understand ads.
            Nothing optional loads until you choose. You can change your choice anytime.
          </p>
          <p lang="bn" className="mt-1 text-xs leading-relaxed text-slate-200">
            অনুমতি না দেওয়া পর্যন্ত ঐচ্ছিক ট্র্যাকিং চালু হয় না। পরে পছন্দ পরিবর্তন করতে পারবেন।
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => choose('all')} className="rounded-full border border-teal-300 bg-teal-600 px-3 py-2 text-xs font-semibold text-white">Allow analytics + marketing</button>
            <button type="button" onClick={() => choose('analytics')} className="rounded-full border border-white/70 px-3 py-2 text-xs font-semibold text-white">Analytics only</button>
            <button type="button" onClick={() => choose('none')} className="rounded-full border border-white/70 px-3 py-2 text-xs font-semibold text-white">Reject optional tracking</button>
          </div>
          <a href="/privacy" className="mt-3 inline-block text-xs underline underline-offset-2">Privacy policy / গোপনীয়তা নীতি</a>
        </section>
      )}
      {consent !== null && !choicesOpen && (
        <button type="button" onClick={() => setChoicesOpen(true)}
          className="fixed bottom-20 left-2 z-[90] rounded-full border border-slate-400/60 bg-slate-900/90 px-2 py-1 text-[10px] text-white shadow-lg"
          aria-label="Change optional tracking choices">Privacy choices</button>
      )}
    </>
  )
}
