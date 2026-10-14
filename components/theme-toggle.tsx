'use client'

import { useEffect, useState } from 'react'

type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = '2taka-theme'
const THEME_EVENT = '2tbr-theme-changed'

function applyTheme(theme: ResolvedTheme, persist = true) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* Theme still works without storage. */ }
  }

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#0b1018' : '#e7e2e8'
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const synchronize = () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
      setMounted(true)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) applyTheme(event.newValue, false)
    }
    synchronize()
    window.addEventListener(THEME_EVENT, synchronize)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(THEME_EVENT, synchronize)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const nextTheme: ResolvedTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={() => {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
      }}
      aria-label={mounted ? `Switch to ${nextTheme} mode` : 'Toggle color theme'}
      title={mounted ? `${theme === 'dark' ? 'Dark' : 'Light'} mode` : 'Color theme'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">{mounted ? (theme === 'dark' ? '☀' : '☾') : '◐'}</span>
      <span className="theme-toggle-label">{mounted ? (theme === 'dark' ? 'Light' : 'Dark') : 'Theme'}</span>
    </button>
  )
}
