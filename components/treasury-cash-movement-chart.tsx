'use client'

import { useState } from 'react'

export type CashMovementRow={
 month_start:string;operating_inflow?:number|string;financing_inflow:number|string;
 operating_outflow:number|string;financing_outflow:number|string;
 unallocated_card_bill:number|string;other_unallocated_interest:number|string
}
type Props={data:CashMovementRow[]}
const n=(x:unknown)=>Number(x??0)||0
const bdt=(v:number)=>'৳'+v.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})
const monthLabel=(m:string)=>new Date(m+'T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'})
const incoming=(d:CashMovementRow)=>n(d.operating_inflow)+n(d.financing_inflow)
const outgoing=(d:CashMovementRow)=>n(d.operating_outflow)+n(d.financing_outflow)+n(d.unallocated_card_bill)+n(d.other_unallocated_interest)
type Point={index:number;kind:'in'|'out';label:string;value:number;x:number;y:number}

export function TreasuryCashMovementChart({data}:Props) {
 const rows=data.slice(-6)
 const [hovered,setHovered]=useState<Point|null>(null)
 const max=Math.max(1,...rows.flatMap(v=>[incoming(v),outgoing(v)]))
 const ceiling=max*1.12
 const plotTop=31,plotHeight=168,baseline=plotTop+plotHeight
 const ticks=[1,.75,.5,.25,0]
 const points=rows.flatMap((row,i)=>{
  const month=monthLabel(row.month_start),baseX=64+i*90
  return [
   {index:i,kind:'in' as const,label:month,value:incoming(row),x:baseX,y:baseline-incoming(row)/ceiling*plotHeight},
   {index:i,kind:'out' as const,label:month,value:outgoing(row),x:baseX+25,y:baseline-outgoing(row)/ceiling*plotHeight}
  ]
 })
 const aria='Six-month book cash movements. Teal bars are inflows; indigo bars are outflows. Focus or hover each bar for exact BDT amounts.'
 return <div className="finance-chart-block">
  <div className="finance-chart-legend" aria-label="Cash movement series">
   <span><span aria-hidden="true" className="finance-chart-legend-dot finance-chart-inflow"/>Operating + financing inflows</span>
   <span><span aria-hidden="true" className="finance-chart-legend-dot finance-chart-outflow"/>Cash outflows</span>
  </div>
  {rows.length ? <div className="finance-chart-plot">
   <svg viewBox="0 0 650 270" role="group" aria-label={aria} className="finance-cash-svg" preserveAspectRatio="xMidYMid meet">
    <title>Six-month actual cash movements</title>
    {ticks.map(ratio=>{
     const y=plotTop+(1-ratio)*plotHeight
     return <g key={ratio}>
      <line x1="80" x2="615" y1={y} y2={y} stroke="#d0dfe4" strokeWidth="1" strokeDasharray={ratio===0?'0':'3 5'}/>
      <text x="73" y={y+4} textAnchor="end" fill="#34576a" fontSize="12" fontWeight="600">{ratio===0?'0':Math.round(ceiling*ratio/1000).toLocaleString('en-BD')+'k'}</text>
     </g>
    })}
    {points.map(p=>{
     const isIn=p.kind==='in',name=isIn?'Operating + financing inflows':'Cash outflows'
     const selected=hovered?.index===p.index&&hovered.kind===p.kind
     return <g key={p.index+'-'+p.kind}>
      <rect x={p.x} y={p.value? p.y : baseline-3} width="21" height={p.value?Math.max(0,baseline-p.y):3} rx="3"
       fill={isIn?'#0F8B8D':'#4F46E5'} stroke={selected?'#0b2738':'none'} strokeWidth={selected?1.5:0}
       opacity={selected?1:p.value?0.96:0.6}
       tabIndex={0} role="img" aria-label={p.label+', '+name+', '+bdt(p.value)}
       onMouseEnter={()=>setHovered(p)} onMouseLeave={()=>setHovered(null)}
       onFocus={()=>setHovered(p)} onBlur={()=>setHovered(null)}>
       <title>{p.label+' — '+name+': '+bdt(p.value)}</title>
      </rect>
     </g>
    })}
    {rows.map((r,i)=><text key={r.month_start} x={64+i*90+23} y="226"
     fill="#30495d" textAnchor="middle" fontSize="13" fontWeight="700">{monthLabel(r.month_start).split(' ')[0]}</text>)}
    <text x="615" y="250" fill="#546b7b" textAnchor="end" fontSize="11">BDT thousands (k)</text>
   </svg>
   <div className="finance-chart-popover-zone" aria-live="polite">
    {hovered?<div className="finance-chart-popover" role="status" data-testid="cash-chart-tooltip">
     <strong>{hovered.label}</strong>
     <span className={hovered.kind==='in'?'finance-chart-inflow-text':'finance-chart-outflow-text'}>
      {hovered.kind==='in'?'Operating + financing inflows':'Cash outflows'}
     </span>
     <b>{bdt(hovered.value)}</b>
    </div>:<p className="finance-chart-help">Hover or focus a bar to see the month and exact amount in BDT.</p>}
   </div>
  </div>:<div className="finance-empty-state mt-4 flex min-h-36 items-center justify-center rounded-xl px-5 py-6 text-center text-sm font-medium text-slate-600">
    No verified cash movements in this environment. Open the synthetic demo to explore example movements.
   </div>}
 </div>
}
