import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { MoneyNav } from '@/components/money-nav'
import { MoneyDonut, MoneyTrend } from '@/components/money-charts'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'
import { accountBalances, categoryTotals, monthBounds, monthlySeries, personTotals, savingsRate } from '@/lib/money.mjs'
import { dhakaToday, loadMoneyReference } from '@/lib/money-server'
import { setMoneySummarySharing } from '@/app/actions/money'

export const dynamic='force-dynamic'
type SearchParams={error?:string;notice?:string}

export default async function MoneyDashboard({searchParams}:{searchParams:Promise<SearchParams>}){
  const {user,profile,roles,supabase}=await requireOnboardedUser();const query=await searchParams;const bd=dhakaToday();const range=monthBounds(bd.month)
  const referencePromise=loadMoneyReference(supabase,user.id)
  const [{data:allTransactions},{data:transfers},{data:savingRows},reference]=await Promise.all([
    supabase.from('money_transactions').select('id,transaction_type,amount,category_id,account_id,person_id,transaction_date,payment_method,description,note,created_at').eq('user_id',user.id).order('transaction_date',{ascending:false}).order('created_at',{ascending:false}).limit(5000),
    supabase.from('money_transfers').select('from_account_id,to_account_id,amount,transfer_date').eq('user_id',user.id).limit(5000),
    supabase.from('savings_ledger').select('amount,verified_at').eq('customer_id',user.id).gte('verified_at',`${range.start}T00:00:00+06:00`).lt('verified_at',`${range.next}T00:00:00+06:00`),referencePromise,
  ])
  const txs=(allTransactions??[]) as any[];const monthTx=txs.filter(row=>row.transaction_date>=range.start&&row.transaction_date<range.next)
  const income=monthTx.filter(row=>row.transaction_type==='income').reduce((sum,row)=>sum+Number(row.amount),0);const expense=monthTx.filter(row=>row.transaction_type==='expense').reduce((sum,row)=>sum+Number(row.amount),0)
  const verified=(savingRows??[]).reduce((sum:number,row:any)=>sum+Number(row.amount??0),0);const accountRows=accountBalances(reference.accounts as any[],txs,(transfers??[]) as any[])
  const categoryMap=categoryTotals(monthTx);const personMap=personTotals(monthTx)
  const categoryRows=[...categoryMap.entries()].map(([id,amount])=>({label:(reference.categories as any[]).find(row=>row.id===id)?.name??'Category',amount})).sort((a,b)=>b.amount-a.amount)
  const personRows=[...personMap.entries()].map(([id,amount])=>({label:(reference.people as any[]).find(row=>row.id===id)?.name??'Person',amount})).sort((a,b)=>b.amount-a.amount)
  const trend=monthlySeries(txs,bd.month,12);const recent=monthTx.slice(0,6);const creditDue=accountRows.filter((row:any)=>row.account_type==='credit_card'&&Number(row.balance)<0).reduce((sum:number,row:any)=>sum+Math.abs(Number(row.balance)),0)
  const summarySharing=(profile as any).money_summary_sharing!==false
  return <AppShell roles={roles}><div className="grid gap-5">
    <MoneyNav/>
    <section className="glass-panel rounded-[28px] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[.16em] text-violet-700">Overview</div><h1 className="mt-1 text-3xl font-black">My Money Dashboard</h1><p className="mt-2 text-sm text-slate-600">{profile.household_name} · BDT · private to your account</p></div><Link href="/money/transactions" className="btn-primary">+ Add transaction</Link></div><div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs font-semibold text-emerald-950">Free household money tracking. We never ask for a bank password, card PIN or mobile-wallet PIN.</div></section>
    {query.error&&<div className="error">{query.error}</div>}{query.notice&&<div className="success">{query.notice}</div>}
    <section className="card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="card-title">Privacy & sharing</div><h2 className="mt-1 text-lg font-black">Monthly summary sharing is {summarySharing?'ON':'OFF'}</h2><p className="muted mt-1 max-w-3xl">Enabled by default. When on, Super Admin can read only your monthly income, expense, net savings and top 5 expense categories. Bank credentials, PINs, account balances and transaction descriptions are never included.</p></div><form action={setMoneySummarySharing}><input type="hidden" name="return_to" value="/money"/><input type="hidden" name="enabled" value={summarySharing?'false':'true'}/><button className={summarySharing?'btn-secondary':'btn-primary'} type="submit">{summarySharing?'Turn sharing off':'Turn sharing on'}</button></form></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="card p-4"><div className="card-title">Total income</div><div className="metric mt-2 text-emerald-700">{taka(income)}</div></div>
      <div className="card p-4"><div className="card-title">Total expenses</div><div className="metric mt-2 text-rose-700">{taka(expense)}</div></div>
      <div className="card p-4"><div className="card-title">Net cash flow</div><div className={`metric mt-2 ${income-expense<0?'text-rose-700':'text-sky-800'}`}>{taka(income-expense)}</div></div>
      <div className="card p-4"><div className="card-title">Savings rate</div><div className="metric mt-2 text-amber-600">{savingsRate(income,expense).toFixed(1)}%</div></div>
      <div className="card p-4"><div className="card-title">2-TAKA savings</div><div className="metric mt-2 text-emerald-700">+{taka(verified)}</div></div>
    </section>
    {creditDue>0&&<section className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4"><div className="flex items-center justify-between gap-4"><div><b>Credit card due</b><p className="muted mt-1">Calculated from your credit-card account balance.</p></div><div className="text-xl font-black text-rose-700">{taka(creditDue)}</div></div></section>}
    <section className="card p-5"><div className="card-title">Income vs Expense · last 12 months</div><div className="mt-4"><MoneyTrend series={trend as any}/></div></section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5"><div className="card-title">Expenses by Category</div><div className="mt-5"><MoneyDonut rows={categoryRows}/></div></div>
      <div className="card p-5"><div className="card-title">Spending by Person</div>{personRows.length===0?<p className="muted mt-5">No spending recorded this month.</p>:<div className="mt-5 grid gap-3">{personRows.map(row=>{const max=personRows[0]?.amount||1;const percent=Math.max(3,Math.min(100,row.amount/max*100));return <div key={row.label} className="money-person-row rounded-xl border border-slate-200 bg-white/50 p-3"><div className="flex justify-between gap-3 text-sm"><b>{row.label}</b><b>{taka(row.amount)}</b></div><div className="money-person-progress-track mt-2 h-2 overflow-hidden" style={{borderRadius:'9999px',background:'rgba(71,85,105,.34)'}} role="progressbar" aria-label={`${row.label} share of person spending`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><div className="money-person-progress-fill h-full" style={{width:`${percent}%`,borderRadius:'9999px',background:'linear-gradient(90deg,#13cfc8,#0b8995)',boxShadow:'0 0 10px rgba(19,207,200,.24)'}}/></div></div>})}</div>}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5"><div className="flex items-center justify-between gap-3"><div className="card-title">Account Balances</div><Link href="/money/accounts" className="text-xs font-black text-sky-700">Manage →</Link></div><div className="mt-4 grid gap-2">{accountRows.length===0?<p className="muted">Add your first account.</p>:accountRows.map((row:any)=><div key={row.id} className="money-account-row flex items-center justify-between rounded-xl border border-slate-200 bg-white/60 p-3"><div><b>{row.name}</b><p className="muted capitalize">{String(row.account_type).replace('_',' ')}</p></div><b className={Number(row.balance)<0?'text-rose-700':'text-slate-950'}>{taka(row.balance)}</b></div>)}</div></div>
      <div className="card p-5"><div className="flex items-center justify-between gap-3"><div className="card-title">Recent Transactions</div><Link href="/money/transactions" className="text-xs font-black text-sky-700">View all →</Link></div>{recent.length===0?<p className="muted mt-5">No transactions this month.</p>:<div className="mt-4 divide-y divide-slate-200">{recent.map((row:any)=>{const category=(reference.categories as any[]).find(c=>c.id===row.category_id);const person=(reference.people as any[]).find(p=>p.id===row.person_id);return <div key={row.id} className="flex items-center gap-3 py-3"><div className="text-lg">{category?.icon??'•'}</div><div className="min-w-0 flex-1"><b className="block truncate">{row.description||category?.name||'Transaction'}</b><p className="muted truncate">{row.transaction_date} · {category?.name} · {person?.name}</p></div><b className={row.transaction_type==='income'?'text-emerald-700':'text-slate-950'}>{row.transaction_type==='income'?'+':'−'}{taka(row.amount)}</b></div>})}</div>}</div>
    </section>
    <section className="glass-panel rounded-[24px] p-5"><div className="grid gap-3 sm:grid-cols-4">{[['Transactions','/money/transactions'],['Budgets','/money/budgets'],['Recurring','/money/recurring'],['Reports','/money/reports']].map(([label,href])=><Link key={href} href={href} className="glass-inset rounded-xl p-4 text-center font-black hover:bg-white/80">{label} →</Link>)}</div></section>
  </div></AppShell>
}
