export function verifiedSaving(benchmark, finalPrice, quantity) {
  const b = Number(benchmark)
  const p = Number(finalPrice)
  const q = Number(quantity)
  if (![b, p, q].every(Number.isFinite) || q <= 0) return 0
  return Math.max(0, (b - p) * q)
}

export function median(values) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return null
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2
}
