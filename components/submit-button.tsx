'use client'

import {useFormStatus} from 'react-dom'
import type {ButtonHTMLAttributes} from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {confirmMessage?: string}
export function SubmitButton({children, className = 'btn-primary', confirmMessage, disabled, onClick, ...props}: Props) {
  const {pending} = useFormStatus()
  return <button type="submit" {...props} className={className} disabled={pending || disabled} onClick={event => {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault()
    if (!event.defaultPrevented) onClick?.(event)
  }}>{pending ? 'Working…' : children}</button>
}
