import Link from 'next/link'
import { SuperAdminShell } from '@/components/super-admin-shell'
import { requireSuperAdmin } from '@/lib/auth'
import { taka } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Q = { month?: string }
type CategoryRow = { name:string; icon?:string|null; amount:number; transactions:number; families:number; share_pct:number }
type TrendRow = { month:string; active_families:number; transaction_count:number; expense_total:number|null; income_total:number|null; privacy_limited:boolean }
type FamilyUsage = { family_key:string; community_name:string; transaction_count:number; expense_entries:number; income_entries:number; budget_count:number; recurring_count:number; top_category:string|null; last_activity:string|null }
type FamilyFinancial = { family_key:string; family_label:string; community_name:string; income_total:number; expense_total:number; savings_total:number; transaction_count:number; top_categories:Array<{name:string;amount:number;entries:number}>; last_activity:string|null }
type Analytics = {
  month:string
  privacy_min_families:number
  privacy_limited:boolean
  registered_families:number
  money_users_lifetime:number
  active_families:number
  expense_families:number
  budget_users_lifetime:number
  recurring_users_lifetime:number
  transaction_count:number
  expense_transaction_count:number
  expense_total:number|null
  income_total:number|null
  average_expense_per_expense_family:number|null
  average_expense_transaction:number|null
  top_categories:CategoryRow[]
  trend:TrendRow[]
}

const n=(value:unknown)=>Number(value??0)||0
const pct=(part:number,total:number)=>total>0?Math.round(part/total*100):0
const validMonth=(value:string|undefined)=>/^\d{4}-\d{2}$/.test(value??'')
const monthLabel=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}-01T00:00:00Z`))

export default async function MoneyAnalyticsPage({searchParams}:{searchParams:Promise<Q>}){
  const {supabase}=await requireSuperAdmin()
  const q=await searchParams
  const month=validMonth(q.month)?q.month!:new Date().toISOString().slice(0,7)
  const [{data,error},{data:familyData,error:familyError},{data:financialData,error:financialError}]=await Promise.all([
    supabase.rpc('super_admin_money_analytics',{p_month:`${month}-01`}),
    supabase.rpc('super_admin_money_family_usage',{p_month:`${month}-01`}),
    supabase.rpc('super_admin_money_family_financials',{p_month:`${month}-01`}),
  ])
  if(error) throw new Error(`Unable to load My Money analytics: ${error.message}`)
  if(familyError) throw new Error(`Unable to load family usage analytics: ${familyError.message}`)
  if(financialError) throw new Error(`Unable to load private family financials: ${financialError.message}`)
  const a=(data??{}) as Analytics
  const categories=(a.top_categories??[]) as CategoryRow[]
  const trend=(a.trend??[]) as TrendRow[]
  const families=(familyData??[]) as FamilyUsage[]
  const financials=(financialData??[]) as FamilyFinancial[]
  const maxCategory=Math.max(1,...categories.map(row=>n(row.amount)))
  const adoption=pct(n(a.money_users_lifetime),n(a.registered_families))
  const monthlyActivation=pct(n(a.active_families),n(a.money_users_lifetime))

  return <SuperAdminShell><div className="grid min-w-0 gap-5">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">My Money · product analytics</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Family money insights</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Aggregate platform analytics plus Super-Admin-only, read-only monthly family summaries. Account balances, credentials and transaction descriptions are never exposed.</p></div>
      <Link href="/super-admin" className="btn-secondary">Executive dashboard</Link>
    </section>

    <form method="get" className="card flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="w-full max-w-xs"><span className="label">Report month</span><input className="input" type="month" name="month" defaultValue={month}/></label><button className="btn-primary" type="submit">View month</button></form>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Families using My Money',n(a.money_users_lifetime),`${adoption}% of onboarded families`],
      ['Active families · month',n(a.active_families),`${monthlyActivation}% of My Money users`],
      ['Tracked transactions · month',n(a.transaction_count),`${n(a.expense_transaction_count)} expense entries`],
      ['Families using budgets',n(a.budget_users_lifetime),`${n(a.recurring_users_lifetime)} use recurring entries`],
    ].map(([label,value,sub])=><div className="card" key={String(label)}><div className="card-title">{label}</div><div className="metric text-2xl">{value}</div><p className="muted mt-2">{sub}</p></div>)}</section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="card"><div className="card-title">Monthly expense tracked</div><div className="metric text-2xl">{a.expense_total==null?'Private cohort':taka(a.expense_total)}</div><p className="muted mt-2">{a.expense_total==null?`Shown after ${a.privacy_min_families} active families use My Money in the same month.`:`Across ${n(a.expense_families)} spending families.`}</p></div>
      <div className="card"><div className="card-title">Average expense / family</div><div className="metric text-2xl">{a.average_expense_per_expense_family==null?'—':taka(a.average_expense_per_expense_family)}</div><p className="muted mt-2">Average among families recording expenses in {monthLabel(month)}.</p></div>
      <div className="card"><div className="card-title">Average expense entry</div><div className="metric text-2xl">{a.average_expense_transaction==null?'—':taka(a.average_expense_transaction)}</div><p className="muted mt-2">Useful for understanding tracking depth and transaction size.</p></div>
      <div className="card"><div className="card-title">Monthly income tracked</div><div className="metric text-2xl">{a.income_total==null?'Private cohort':taka(a.income_total)}</div><p className="muted mt-2">Aggregate only; never a household-level income report.</p></div>
    </section>

    {a.privacy_limited&&<section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Privacy threshold active.</strong> Financial amounts are hidden until at least {a.privacy_min_families} families are active in the selected month. Usage counts remain visible so you can still measure adoption.</section>}

    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="card min-w-0"><div className="flex items-start justify-between gap-3"><div><div className="card-title">Where families spend most</div><h2 className="mt-1 text-xl font-black">Top expense categories</h2><p className="muted mt-1">Only categories used by at least {a.privacy_min_families} different families are included.</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{monthLabel(month)}</span></div><div className="mt-5 grid gap-4">{categories.length?categories.map((row,index)=><div key={`${row.name}-${index}`}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><div className="min-w-0 font-bold"><span className="mr-2">{row.icon||'•'}</span>{row.name}</div><div className="shrink-0 text-right"><span className="font-black">{taka(row.amount)}</span><span className="ml-2 text-xs text-slate-500">{n(row.share_pct).toFixed(1)}%</span></div></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{width:`${Math.max(4,Math.round(n(row.amount)/maxCategory*100))}%`}}/></div><div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{n(row.transactions)} transactions</span><span>{n(row.families)} families</span></div></div>):<div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No category has enough aggregate usage to display yet.</div>}</div></div>
      <div className="card"><div className="card-title">Interpretation</div><h2 className="mt-1 text-xl font-black">What this tells you</h2><div className="mt-4 grid gap-3 text-sm text-slate-600"><p><strong className="text-slate-900">Adoption:</strong> how many onboarded families have actually recorded money activity.</p><p><strong className="text-slate-900">Activation:</strong> how many existing My Money users returned and tracked something this month.</p><p><strong className="text-slate-900">Expense categories:</strong> which household needs dominate spending across the user base. This can inform BazarPool assortment without targeting an identifiable household.</p><p><strong className="text-slate-900">Budget / recurring use:</strong> whether My Money is becoming a repeat finance habit.</p></div></div>
    </section>

    <section className="card min-w-0 overflow-hidden"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="card-title">Private · Super Admin only · read only</div><h2 className="mt-1 text-xl font-black">Private family financials</h2><p className="muted mt-1">Only households with monthly summary sharing ON appear here. Sharing is ON by default and each household can turn it off. No account balances, credentials, PINs or transaction descriptions are included.</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{monthLabel(month)}</span></div><div className="mt-4 overflow-x-auto"><table className="min-w-[1500px] w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Family</th><th className="py-3 pr-4">Community</th><th className="py-3 pr-4">Income</th><th className="py-3 pr-4">Expense</th><th className="py-3 pr-4">Net savings</th>{[1,2,3,4,5].map(i=><th key={i} className="py-3 pr-4">Top {i}</th>)}<th className="py-3 pr-4">Transactions</th><th className="py-3">Last activity</th></tr></thead><tbody>{financials.map(row=>{const cats=Array.isArray(row.top_categories)?row.top_categories:[];return <tr key={row.family_key} className="border-b border-slate-100 align-top last:border-0"><td className="py-3 pr-4"><div className="font-black">{row.family_label}</div><div className="text-[11px] text-slate-400">{row.family_key}</div></td><td className="py-3 pr-4">{row.community_name}</td><td className="py-3 pr-4 font-bold text-emerald-700">{taka(n(row.income_total))}</td><td className="py-3 pr-4 font-bold text-rose-700">{taka(n(row.expense_total))}</td><td className={`py-3 pr-4 font-black ${n(row.savings_total)<0?'text-rose-700':'text-sky-800'}`}>{taka(n(row.savings_total))}</td>{[0,1,2,3,4].map(i=>{const c=cats[i];return <td key={i} className="py-3 pr-4">{c?<><div className="font-bold">{c.name}</div><div>{taka(n(c.amount))}</div><div className="text-[11px] text-slate-500">{n(c.entries)} entries</div></>:'—'}</td>})}<td className="py-3 pr-4">{n(row.transaction_count)}</td><td className="py-3">{row.last_activity??'—'}</td></tr>})}</tbody></table>{financials.length===0&&<div className="p-6 text-center text-sm text-slate-500">No shared family summaries for this month yet.</div>}</div></section>

    <section className="card min-w-0 overflow-hidden"><div><div className="card-title">Family-wise usage</div><h2 className="mt-1 text-xl font-black">Household activity by anonymized family</h2><p className="muted mt-1">Useful for adoption/support analysis. Financial amounts and account balances are intentionally excluded.</p></div><div className="mt-4 overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Family</th><th className="py-3 pr-4">Community</th><th className="py-3 pr-4">Transactions</th><th className="py-3 pr-4">Expense entries</th><th className="py-3 pr-4">Income entries</th><th className="py-3 pr-4">Budgets</th><th className="py-3 pr-4">Recurring</th><th className="py-3 pr-4">Top category</th><th className="py-3">Last activity</th></tr></thead><tbody>{families.map(row=><tr key={row.family_key} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-4 font-black">{row.family_key}</td><td className="py-3 pr-4">{row.community_name}</td><td className="py-3 pr-4">{n(row.transaction_count)}</td><td className="py-3 pr-4">{n(row.expense_entries)}</td><td className="py-3 pr-4">{n(row.income_entries)}</td><td className="py-3 pr-4">{n(row.budget_count)}</td><td className="py-3 pr-4">{n(row.recurring_count)}</td><td className="py-3 pr-4">{row.top_category??'—'}</td><td className="py-3">{row.last_activity??'—'}</td></tr>)}</tbody></table></div></section>

    <section className="card min-w-0 overflow-hidden"><div><div className="card-title">6-month trend</div><h2 className="mt-1 text-xl font-black">Usage and tracked money</h2></div><div className="mt-4 overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Month</th><th className="py-3 pr-4">Active families</th><th className="py-3 pr-4">Transactions</th><th className="py-3 pr-4">Expense</th><th className="py-3">Income</th></tr></thead><tbody>{trend.map(row=><tr key={row.month} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-4 font-bold">{monthLabel(row.month)}</td><td className="py-3 pr-4">{n(row.active_families)}</td><td className="py-3 pr-4">{n(row.transaction_count)}</td><td className="py-3 pr-4">{row.expense_total==null?'Private cohort':taka(row.expense_total)}</td><td className="py-3">{row.income_total==null?'Private cohort':taka(row.income_total)}</td></tr>)}</tbody></table></div></section>
  </div></SuperAdminShell>
}
