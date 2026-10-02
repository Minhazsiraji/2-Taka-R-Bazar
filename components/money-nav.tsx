'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items=[['/money','Dashboard','▦'],['/money/transactions','Transactions','↕'],['/money/accounts','Accounts','▣'],['/money/transfers','Transfers','⇄'],['/money/budgets','Budgets','◎'],['/money/categories','Categories','◇'],['/money/recurring','Recurring','↻'],['/money/reports','Reports','▥']]

export function MoneyNav(){
  const pathname=usePathname()
  return <nav className="glass-panel rounded-[22px] p-2" aria-label="My Money navigation"><div className="flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">{items.map(([href,label,icon])=>{const active=pathname===href;return <Link key={href} href={href} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-black transition ${active?'bg-slate-950 text-white shadow-sm':'text-slate-700 hover:bg-white/70'}`}><span aria-hidden="true">{icon}</span>{label}</Link>})}</div></nav>
}
