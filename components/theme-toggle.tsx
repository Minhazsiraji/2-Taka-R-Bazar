'use client'

import { useEffect, useState } from 'react'

type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = '2taka-theme'

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  localStorage.setItem(STORAGE_KEY, theme)

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#0b1018' : '#e7e2e8'
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const resolved = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    setTheme(resolved)
    setMounted(true)
  }, [])

  const nextTheme: ResolvedTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={() => {
        applyTheme(nextTheme)
        setTheme(nextTheme)
      }}
      aria-label={mounted ? `Switch to ${nextTheme} mode` : 'Toggle color theme'}
      title={mounted ? `${theme === 'dark' ? 'Dark' : 'Light'} mode` : 'Color theme'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">{mounted ? (theme === 'dark' ? '☀' : '☾') : '◐'}</span>
      <span className="theme-toggle-label">{mounted ? (theme === 'dark' ? 'Light' : 'Dark') : 'Theme'}</span>
    </button>
  )
}
