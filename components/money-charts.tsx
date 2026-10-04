import { taka } from '@/lib/format'

type Series={month:string;income:number;expense:number}
type Slice={label:string;amount:number}

const INCOME_COLOR='#059669'
const EXPENSE_COLOR='#e11d48'
const BAR_RADIUS='6px 6px 0 0'

export function MoneyTrend({series}:{series:Series[]}){
  const max=Math.max(1,...series.flatMap(row=>[row.income,row.expense]))
  return <div className="grid gap-3"><div className="flex h-44 items-end gap-2 border-b border-slate-200 px-1">{series.map(row=><div key={row.month} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1" title={`${row.month}: Income ${taka(row.income)}, Expense ${taka(row.expense)}`}><div className="w-[42%]" style={{height:`${Math.max(row.income?4:0,(row.income/max)*100)}%`,backgroundColor:INCOME_COLOR,borderRadius:BAR_RADIUS,boxShadow:'none',backdropFilter:'none'}}/><div className="w-[42%]" style={{height:`${Math.max(row.expense?4:0,(row.expense/max)*100)}%`,backgroundColor:EXPENSE_COLOR,borderRadius:BAR_RADIUS,boxShadow:'none',backdropFilter:'none'}}/></div>)}</div><div className="flex justify-between text-[9px] font-semibold text-slate-500">{series.map((row,index)=><span key={row.month} className={index%2?'hidden sm:block':''}>{row.month.slice(5)}</span>)}</div><div className="flex gap-4 text-xs font-bold"><span style={{color:INCOME_COLOR}}>● Income</span><span style={{color:EXPENSE_COLOR}}>● Expense</span></div></div>
}

const palette=['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#84cc16','#f97316']
export function MoneyDonut({rows,empty='No expense data yet'}:{rows:Slice[];empty?:string}){
  const total=rows.reduce((sum,row)=>sum+Number(row.amount||0),0)
  if(!total)return <div className="muted py-10 text-center">{empty}</div>
  let cursor=0;const stops=rows.map((row,index)=>{const start=cursor;cursor+=row.amount/total*100;return `${palette[index%palette.length]} ${start}% ${cursor}%`}).join(',')
  return <div className="grid gap-5 sm:grid-cols-[150px_1fr] sm:items-center"><div className="mx-auto h-36 w-36 rounded-full p-7" style={{background:`conic-gradient(${stops})`}}><div className="flex h-full w-full items-center justify-center rounded-full bg-white text-center text-xs font-black">{taka(total)}<br/>total</div></div><div className="grid gap-2">{rows.slice(0,8).map((row,index)=><div key={row.label} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-bold"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{background:palette[index%palette.length]}}/>{row.label}</span><span className="shrink-0 font-black">{taka(row.amount)}</span></div>)}</div></div>
}
