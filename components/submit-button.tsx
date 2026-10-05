'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ children, className = 'btn-primary', confirmMessage }: { children: React.ReactNode; className?: string; confirmMessage?: string }) {
  const { pending } = useFormStatus()
  return <button className={className} disabled={pending} onClick={confirmMessage ? (event) => { if (!window.confirm(confirmMessage)) event.preventDefault() } : undefined}>{pending ? 'Working…' : children}</button>
}
