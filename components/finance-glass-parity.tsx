'use client'
import { useEffect } from 'react'

/**
 * Finance, Treasury and Procurement major glass surfaces adopt the exact
 * computed header backdrop value. Historic site CSS has broad important
 * backdrop-filter suppression for nested rounded components. Design/material
 * is otherwise defined by site-finance-clarity.css; this narrowly scoped
 * compatibility mechanism never affects customer pages.
 */
export function FinanceGlassParity() {
  useEffect(() => {
    const surfaces = 'main .finance-ops-surface :is(.finance-ops-hero,.finance-panel,.finance-glass-gate,.finance-gate-notice,.finance-protection-notice)'
    let scheduled = 0
    function apply() {
      scheduled = 0
      const header = document.querySelector('.app-shell-header-bar')
      if (!header) return
      const style = window.getComputedStyle(header)
      const blur = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter')
      if (!blur || blur === 'none') return
      document.querySelectorAll<HTMLElement>(surfaces).forEach((element) => {
        element.style.setProperty('backdrop-filter', blur, 'important')
        element.style.setProperty('-webkit-backdrop-filter', blur, 'important')
      })
    }
    function request() {
      if (scheduled) return
      scheduled = window.requestAnimationFrame(apply)
    }
    request()
    window.addEventListener('resize', request, { passive: true })
    const modeChanges = new MutationObserver(request)
    modeChanges.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const content = document.querySelector('main')
    const viewChanges = content ? new MutationObserver(request) : null
    if (content) viewChanges?.observe(content, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('resize', request)
      modeChanges.disconnect()
      viewChanges?.disconnect()
      if (scheduled) window.cancelAnimationFrame(scheduled)
    }
  }, [])
  return null
}
