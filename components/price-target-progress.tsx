import { taka } from '@/lib/format'

type Props = {
  currentQuantity: number
  households: number
  nextThreshold: number
  nextPrice: number
  benchmarkPrice: number
}

export function PriceTargetProgress({ currentQuantity, households, nextThreshold, nextPrice, benchmarkPrice }: Props) {
  if (!(nextThreshold > 0) || !(nextPrice > 0)) return null

  const remaining = Math.max(nextThreshold - currentQuantity, 0)
  const progress = Math.max(0, Math.min(100, (currentQuantity / nextThreshold) * 100))
  const saving = Math.max(0, benchmarkPrice - nextPrice)

  return <div className="price-target-progress mt-3 rounded-2xl border border-white/80 bg-white/20 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="card-title">Community price target</div>
        <div className="mt-1 text-base font-bold text-slate-900">
          {households} famil{households===1?'y':'ies'} joined · {currentQuantity} / {nextThreshold} units committed
        </div>
      </div>
      <div className="price-target-unlock text-sm font-bold">
        {remaining} more unit{remaining===1?'':'s'} → unlock {taka(nextPrice)}
      </div>
    </div>

    <div className="price-target-track mt-3 h-3 overflow-hidden" role="progressbar" aria-label={`${currentQuantity} of ${nextThreshold} units committed`} aria-valuemin={0} aria-valuemax={nextThreshold} aria-valuenow={Math.min(currentQuantity,nextThreshold)}>
      <div className="price-target-fill h-full transition-[width] duration-500" style={{width:`${progress}%`}} />
    </div>

    <div className="price-target-meta mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <span>Market retail <b className="text-slate-900">{taka(benchmarkPrice)}</b></span>
      <span>Target price <b className="price-target-value">{taka(nextPrice)}</b></span>
      <span>Target saving <b className="text-emerald-700">{taka(saving)}/unit</b></span>
    </div>
  </div>
}
