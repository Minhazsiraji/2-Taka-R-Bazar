import type { ReactNode } from 'react'

export function PriceComparison({ market, current, saving, currentLabel = 'Current max', savingLabel = 'You save', note = 'per unit' }: {
  market: ReactNode; current: ReactNode; saving: ReactNode; currentLabel?: string; savingLabel?: string; note?: ReactNode
}) {
  return <div className="cx-price-grid mt-3">
    <div className="cx-price-cell"><div className="cx-price-label">Market</div><div className="cx-price-value">{market}</div></div>
    <div className="cx-price-cell"><div className="cx-price-label">{currentLabel}</div><div className="cx-price-value">{current}</div></div>
    <div className="cx-price-cell"><div className="cx-price-label">{savingLabel}</div><div className="cx-price-value is-saving">{saving}</div><div className="cx-price-note">{note}</div></div>
  </div>
}
