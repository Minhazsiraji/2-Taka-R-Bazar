'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js?v=20260927-notify-logo', { updateViaCache: 'none' })
        .catch(() => undefined)
    }

    const idleApi = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (typeof idleApi.requestIdleCallback === 'function') {
      const idleId = idleApi.requestIdleCallback(register, { timeout: 2000 })
      return () => idleApi.cancelIdleCallback?.(idleId)
    }

    const timeoutId = setTimeout(register, 800)
    return () => clearTimeout(timeoutId)
  }, [])

  return null
}
