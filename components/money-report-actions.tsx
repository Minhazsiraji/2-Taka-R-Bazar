'use client'

export function MoneyReportActions({range}:{range:string}){
  return <div className="flex flex-wrap gap-2"><a className="btn-secondary" href={`/money/reports/export?range=${encodeURIComponent(range)}&format=csv`}>CSV</a><a className="btn-secondary" href={`/money/reports/export?range=${encodeURIComponent(range)}&format=xls`}>Excel</a><button className="btn-secondary" type="button" onClick={()=>window.print()}>Print / PDF</button></div>
}
