'use client'

import { useState } from 'react'

export function NotificationPreviewButton() {
  const [preview, setPreview] = useState<{title:string; message:string; audience:string; priority:string; destination:string}|null>(null)
  function openPreview(e: React.MouseEvent<HTMLButtonElement>) {
    const section = e.currentTarget.closest('section')
    if (!section) return
    const inputs = Array.from(section.querySelectorAll('input, textarea, select')) as Array<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>
    const values = inputs.map((el) => el.value)
    setPreview({ title: values[0] || 'Untitled notification', message: values[1] || 'No message entered.', audience: values[2] || 'all', priority: values[4] || 'normal', destination: values[5] || '/notifications' })
  }
  return <>
    <button className="btn-secondary" type="button" onClick={openPreview}>Preview message</button>
    {preview && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-lg shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="card-title">Message preview</div><h2 className="section-title mt-1">{preview.title}</h2></div><button type="button" className="btn-secondary" onClick={()=>setPreview(null)}>Close</button></div>
      <p className="mt-4 whitespace-pre-wrap text-sm">{preview.message}</p><div className="mt-4 grid gap-2 text-xs text-slate-500"><span>Audience: {preview.audience}</span><span>Priority: {preview.priority}</span><span>Destination: {preview.destination}</span></div>
      <div className="notice mt-4">Preview only — nothing has been sent to customers.</div></div>
    </div>}
  </>
}
