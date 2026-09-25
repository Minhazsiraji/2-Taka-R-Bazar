export function taka(value: number | string | null | undefined) {
  const n = Number(value ?? 0)
  return `৳${Number.isFinite(n) ? n.toLocaleString('en-BD', { maximumFractionDigits: 2 }) : '0'}`
}

export function shortDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(new Date(value))
}

export function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
