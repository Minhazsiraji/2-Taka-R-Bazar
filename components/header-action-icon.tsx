type HeaderActionIconKind = 'wallet' | 'bell' | 'profile'

export function HeaderActionIcon({kind}: {kind: HeaderActionIconKind}) {
  return <svg className="header-action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'wallet' && <><path d="M20 8V5H5a3 3 0 0 0 0 6h16v9H5a3 3 0 0 1-3-3V8"/><path d="M21 11h-5v5h5"/><path d="M18 13.5h.01"/></>}
    {kind === 'bell' && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>}
    {kind === 'profile' && <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>}
  </svg>
}
