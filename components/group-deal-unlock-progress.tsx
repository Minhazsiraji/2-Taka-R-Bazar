import { taka } from '@/lib/format'

type Props={
  qualifiedBuyers:number
  circleMembers:number
  nextThreshold:number
  nextPrice:number
  marketPrice:number
  joined:boolean
}

export function GroupDealUnlockProgress({
  qualifiedBuyers,
  circleMembers,
  nextThreshold,
  nextPrice,
  marketPrice,
  joined,
}:Props){
  if(!(nextThreshold>0)||!(nextPrice>0)){
    return <div className="price-target-progress mt-3 rounded-xl border border-emerald-100 bg-emerald-50/45 p-3">
      <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Community price</div><b className="mt-1 block text-sm">Best listed tier reached</b></div><span className="chip text-emerald-700">Unlocked ✓</span></div>
    </div>
  }

  const beforeFirstUnlock=qualifiedBuyers===0
  const progressBuyers=beforeFirstUnlock&&joined
    ? Math.min(circleMembers,nextThreshold)
    : Math.min(qualifiedBuyers,nextThreshold)
  const remaining=Math.max(nextThreshold-progressBuyers,0)
  const progress=Math.max(0,Math.min(100,(progressBuyers/nextThreshold)*100))
  const saving=Math.max(0,marketPrice-nextPrice)

  return <div className="price-target-progress mt-3 rounded-xl border border-white/80 bg-white/20 p-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[9px] font-black uppercase tracking-[.12em] text-slate-500">{beforeFirstUnlock?'First unlock':'Next price tier'}</div>
        <div className="mt-1 text-sm font-black">{progressBuyers}/{nextThreshold} verified buyers</div>
        <div className="muted mt-1 text-[11px]">{beforeFirstUnlock&&joined?circleMembers+' active in your circle':qualifiedBuyers+' qualified community buyers'}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-black text-emerald-700">{remaining} more → {taka(nextPrice)}</div>
        <div className="muted mt-1 text-[10px]">save {taka(saving)}/unit</div>
      </div>
    </div>

    <div
      className="price-target-track mt-2 h-2 overflow-hidden"
      role="progressbar"
      aria-label={progressBuyers+' of '+nextThreshold+' buyers toward the next Group Deal price'}
      aria-valuemin={0}
      aria-valuemax={nextThreshold}
      aria-valuenow={progressBuyers}
    >
      <div className="price-target-fill h-full transition-[width] duration-500" style={{width:String(progress)+'%'}}/>
    </div>

    <p className="muted mt-2 text-[10px]">Each verified person counts once, regardless of quantity.</p>
  </div>
}
