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

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(register, { timeout: 2000 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(register, 800)
    return () => window.clearTimeout(timeoutId)
  }, [])

  return null
}
