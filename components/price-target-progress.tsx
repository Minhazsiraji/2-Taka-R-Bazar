import { taka } from '@/lib/format'

type Props = {
  currentQuantity: number
  households: number
  unlockedThreshold: number
  unlockedPrice: number
  nextThreshold: number
  nextPrice: number
  benchmarkPrice: number
}

export function PriceTargetProgress({
  currentQuantity,
  households,
  unlockedThreshold,
  unlockedPrice,
  nextThreshold,
  nextPrice,
  benchmarkPrice,
}: Props) {
  if (!(nextThreshold > 0) || !(nextPrice > 0)) return null

  const remaining = Math.max(nextThreshold - currentQuantity, 0)
  const progress = Math.max(0, Math.min(100, (currentQuantity / nextThreshold) * 100))
  const saving = Math.max(0, benchmarkPrice - nextPrice)
  const hasUnlockedTier = unlockedThreshold > 0 && unlockedPrice > 0

  return <div className="price-target-progress mt-3 rounded-xl border border-white/80 bg-white/20 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[.12em] text-slate-500">{hasUnlockedTier?'Next price tier':'First price tier'}</div>
        <div className="mt-1 text-sm font-black">
          {hasUnlockedTier?taka(unlockedPrice)+' unlocked · ':''}{currentQuantity}/{nextThreshold} units
        </div>
        <div className="muted mt-1 text-[11px]">{households} household{households===1?'':'s'} joined</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-black text-emerald-700">{remaining} more → {taka(nextPrice)}</div>
        <div className="muted mt-1 text-[10px]">save {taka(saving)}/unit</div>
      </div>
    </div>

    <div
      className="price-target-track mt-2 h-2 overflow-hidden"
      role="progressbar"
      aria-label={String(currentQuantity)+' of '+String(nextThreshold)+' units committed toward the next price tier'}
      aria-valuemin={0}
      aria-valuemax={nextThreshold}
      aria-valuenow={Math.min(currentQuantity,nextThreshold)}
    >
      <div className="price-target-fill h-full transition-[width] duration-500" style={{width:String(progress)+'%'}} />
    </div>
  </div>
}
