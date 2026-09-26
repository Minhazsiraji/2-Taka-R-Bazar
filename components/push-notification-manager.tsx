'use client'

import { useEffect, useMemo, useState } from 'react'
import { disablePushSubscription, savePushSubscription } from '@/app/actions/notifications'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function PushNotificationManager({ publicKey, serverHasSubscription }: { publicKey: string | null; serverHasSubscription: boolean }) {
  const supported = useMemo(() => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, [])
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(supported ? Notification.permission : 'unsupported')
  const [enabled, setEnabled] = useState(serverHasSubscription)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function persistSubscription(subscription: PushSubscription) {
    const json = subscription.toJSON()
    const result = await savePushSubscription({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      userAgent: navigator.userAgent,
    })
    if (!result.ok) throw new Error(result.error)
    setEnabled(true)
  }

  useEffect(() => {
    if (!supported || !publicKey || Notification.permission !== 'granted') return
    let cancelled = false
    ;(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          })
        }
        if (!cancelled) await persistSubscription(subscription)
      } catch {
        // Keep in-app notifications active even when device push setup fails.
      }
    })()
    return () => { cancelled = true }
  }, [publicKey, supported])

  async function enablePush() {
    if (!supported || !publicKey) {
      setMessage('Push notifications are not supported on this browser. In-app notifications will still work.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') {
        setMessage(result === 'denied' ? 'Browser notifications are blocked. You can re-enable them in browser/site settings.' : 'Permission was not granted.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }
      await persistSubscription(subscription)
      setMessage('Device notifications are enabled for this browser.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not enable device notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function disablePush() {
    setBusy(true)
    setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await disablePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setEnabled(false)
      setMessage('Device notifications disabled on this browser. In-app notifications remain active.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not disable device notifications.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Device alerts</p>
          <h2 className="mt-1 text-xl font-black">Pool reminders on this device</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">In-app notifications are always active. Enable browser/PWA notifications to receive important pool, confirmation, pickup and review reminders even when the app is not open.</p>
        </div>
        {enabled && permission === 'granted' ? (
          <button type="button" onClick={disablePush} disabled={busy} className="btn-secondary shrink-0">{busy ? 'Working…' : 'Disable on this device'}</button>
        ) : (
          <button type="button" onClick={enablePush} disabled={busy || permission === 'denied'} className="btn-primary shrink-0">{busy ? 'Enabling…' : permission === 'denied' ? 'Blocked by browser' : 'Enable notifications'}</button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="chip">In-app: Always on</span>
        <span className="chip">Browser permission: {permission}</span>
        <span className="chip">This device: {enabled ? 'Subscribed' : 'Not subscribed'}</span>
      </div>
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </section>
  )
}
