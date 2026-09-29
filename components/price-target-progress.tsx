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
      <div className="text-sm font-bold text-teal-800">
        {remaining} more unit{remaining===1?'':'s'} → unlock {taka(nextPrice)}
      </div>
    </div>

    <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/90 bg-white/45 shadow-inner" aria-label={`${currentQuantity} of ${nextThreshold} units committed`}>
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-teal-300 to-teal-500 transition-[width] duration-500" style={{width:`${progress}%`}} />
    </div>

    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
      <span>Market retail <b className="text-slate-900">{taka(benchmarkPrice)}</b></span>
      <span>Target price <b className="text-teal-800">{taka(nextPrice)}</b></span>
      <span>Target saving <b className="text-emerald-700">{taka(saving)}/unit</b></span>
    </div>
  </div>
}
