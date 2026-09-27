'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js?v=20260927-notify-logo', { updateViaCache: 'none' })
        .then(registration => registration.update())
        .catch(() => undefined)
    }
  }, [])
  return null
}
