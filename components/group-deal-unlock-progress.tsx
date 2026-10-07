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
    return <div className="price-target-progress mt-3 rounded-2xl border border-white/80 bg-white/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="card-title">Community price target</div>
          <div className="mt-1 text-base font-bold text-slate-900">Best listed price tier reached</div>
        </div>
        <div className="price-target-unlock text-sm font-bold">Maximum community buying power unlocked</div>
      </div>
      <div className="price-target-track mt-3 h-3 overflow-hidden" role="progressbar" aria-label="Best listed Group Deal tier reached" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}>
        <div className="price-target-fill h-full w-full transition-[width] duration-500"/>
      </div>
    </div>
  }

  const beforeFirstUnlock=qualifiedBuyers===0
  const progressBuyers=beforeFirstUnlock&&joined
    ? Math.min(circleMembers,nextThreshold)
    : Math.min(qualifiedBuyers,nextThreshold)
  const remaining=Math.max(nextThreshold-progressBuyers,0)
  const progress=Math.max(0,Math.min(100,(progressBuyers/nextThreshold)*100))
  const saving=Math.max(0,marketPrice-nextPrice)

  return <div className="price-target-progress mt-3 rounded-2xl border border-white/80 bg-white/20 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="card-title">{beforeFirstUnlock?'First price unlock':'Next community price unlock'}</div>
        <div className="mt-1 text-base font-bold text-slate-900">
          {progressBuyers} / {nextThreshold} buyer{nextThreshold===1?'':'s'}
        </div>
      </div>
      <div className="price-target-unlock text-sm font-bold">
        {remaining>0
          ? remaining+' more buyer'+(remaining===1?'':'s')+' needed → '+taka(nextPrice)
          : 'Unlocking '+taka(nextPrice)}
      </div>
    </div>

    <div
      className="price-target-track mt-3 h-3 overflow-hidden"
      role="progressbar"
      aria-label={progressBuyers+' of '+nextThreshold+' buyers toward the next Group Deal price'}
      aria-valuemin={0}
      aria-valuemax={nextThreshold}
      aria-valuenow={progressBuyers}
    >
      <div className="price-target-fill h-full transition-[width] duration-500" style={{width:String(progress)+'%'}}/>
    </div>

    <div className="price-target-meta mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <span>Target price <b className="price-target-value">{taka(nextPrice)}</b></span>
      <span>Target saving <b className="text-emerald-700">{taka(saving)}/unit</b></span>
      {beforeFirstUnlock&&joined
        ? <span><b className="text-slate-900">{circleMembers}</b> active in your nearby forming circle</span>
        : <span><b className="text-slate-900">{qualifiedBuyers}</b> qualified community buyers</span>}
    </div>

    <p className="muted mt-2 text-xs">Each verified person counts once toward the buyer target, regardless of how many units they commit.</p>
  </div>
}
