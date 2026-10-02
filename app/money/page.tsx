import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { SubmitButton } from '@/components/submit-button'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'
import { monthBounds, normalizeMoneyMonth, shiftMoneyMonth, summarizeMoney } from '@/lib/money.mjs'
import { createMoneyCategory, deleteMoneyBudget, deleteMoneyTransaction, saveMoneyBudget, saveMoneyTransaction } from '@/app/actions/money'

export const dynamic='force-dynamic'

type SearchParams={month?:string;error?:string;notice?:string}

function dhakaParts(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??''
  return {today:`${get('year')}-${get('month')}-${get('day')}`,month:`${get('year')}-${get('month')}`}
}
function monthLabel(month:string){
  const [year,number]=month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,number-1,1)))
}
function paymentLabel(value:string){return ({cash:'Cash',mobile_wallet:'Mobile wallet',bank:'Bank',card:'Card',other:'Other'} as Record<string,string>)[value]??value}

export default async function MoneyPage({searchParams}:{searchParams:Promise<SearchParams>}){
  const {user,profile,roles,supabase}=await requireOnboardedUser()
  const query=await searchParams; const bd=dhakaParts(); const month=normalizeMoneyMonth(query.month,bd.month); const range=monthBounds(month)

  const [{data:categories,error:categoryError},{data:transactions,error:transactionError},{data:budgets,error:budgetError},{data:savingRows}]=await Promise.all([
    supabase.from('money_categories').select('id,name,kind,icon,is_default,active,sort_order').eq('user_id',user.id).eq('active',true).order('kind').order('sort_order').order('name'),
    supabase.from('money_transactions').select('id,transaction_type,amount,category_id,transaction_date,payment_method,note,created_at,money_categories(name,icon)').eq('user_id',user.id).gte('transaction_date',range.start).lt('transaction_date',range.next).order('transaction_date',{ascending:false}).order('created_at',{ascending:false}).limit(1000),
    supabase.from('money_budgets').select('id,amount,category_id,month,money_categories(name,icon)').eq('user_id',user.id).eq('month',range.start).order('created_at'),
    supabase.from('savings_ledger').select('amount,verified_at').eq('customer_id',user.id).gte('verified_at',`${range.start}T00:00:00+06:00`).lt('verified_at',`${range.next}T00:00:00+06:00`),
  ])
  const infrastructureMissing=Boolean(categoryError||transactionError||budgetError)
  const txs=(transactions??[]) as any[]; const budgetRows=(budgets??[]) as any[]
  const summary=summarizeMoney(txs,budgetRows)
  const verifiedSavings=(savingRows??[]).reduce((sum:number,row:any)=>sum+Number(row.amount??0),0)
  const todaySpend=month===bd.month?txs.filter(row=>row.transaction_type==='expense'&&row.transaction_date===bd.today).reduce((sum,row)=>sum+Number(row.amount),0):0
  const expenseCategories=((categories??[]) as any[]).filter(row=>row.kind==='expense')
  const incomeCategories=((categories??[]) as any[]).filter(row=>row.kind==='income')
  const categorySpend=new Map<string,number>()
  txs.filter(row=>row.transaction_type==='expense').forEach(row=>categorySpend.set(row.category_id,(categorySpend.get(row.category_id)??0)+Number(row.amount)))
  const budgetCategoryIds=new Set(budgetRows.map(row=>row.category_id))
  const unbudgeted=txs.filter(row=>row.transaction_type==='expense'&&!budgetCategoryIds.has(row.category_id)).reduce((sum,row)=>sum+Number(row.amount),0)
  const topCategories=[...categorySpend.entries()].map(([id,total])=>({id,total,category:expenseCategories.find(c=>c.id===id)})).sort((a,b)=>b.total-a.total).slice(0,6)
  const maxCategory=Math.max(1,...topCategories.map(row=>row.total))
  const recent=txs.slice(0,12)
  const previous=shiftMoneyMonth(month,-1); const next=shiftMoneyMonth(month,1)

  return <AppShell roles={roles}><div className="grid min-w-0 gap-5">
    <section className="glass-panel rounded-[28px] p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-xs font-black uppercase tracking-[.16em] text-sky-700">Free everyday tool</div><h1 className="mt-1 text-3xl font-black tracking-tight">My Money</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Track your family&apos;s daily costs, monthly budget and income in one place. Your entries are private to your account.</p></div>
        <div className="flex items-center gap-2"><Link className="btn-secondary" href={`/money?month=${previous}`}>←</Link><span className="chip min-w-36 justify-center">{monthLabel(month)}</span><Link className="btn-secondary" href={`/money?month=${next}`}>→</Link></div>
      </div>
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs font-semibold leading-5 text-emerald-950">Manual money tracking only. 2-TAKA-R-BAZAR never asks for your bank password, card PIN or mobile-wallet PIN.</div>
    </section>

    {query.error&&<div className="error">{query.error}</div>}{query.notice&&<div className="success">{query.notice}</div>}
    {infrastructureMissing&&<div className="error">My Money database setup is not available in this environment yet. Your Pool, orders and existing savings features are unaffected.</div>}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="card p-4"><div className="card-title">Today&apos;s spend</div><div className="metric mt-2">{month===bd.month?taka(todaySpend):'—'}</div><p className="muted mt-1">quick daily check</p></div>
      <div className="card p-4"><div className="card-title">Month spent</div><div className="metric mt-2 text-rose-700">{taka(summary.expense)}</div><p className="muted mt-1">all recorded expenses</p></div>
      <div className="card p-4"><div className="card-title">Month income</div><div className="metric mt-2 text-emerald-700">{taka(summary.income)}</div><p className="muted mt-1">recorded income</p></div>
      <div className="card p-4"><div className="card-title">Budget left</div><div className={`metric mt-2 ${summary.budgetLeft<0?'text-rose-700':'text-sky-800'}`}>{summary.budget?taka(summary.budgetLeft):'Not set'}</div><p className="muted mt-1">budget {taka(summary.budget)}</p></div>
      <div className="card p-4"><div className="card-title">2-TAKA savings</div><div className="metric mt-2 text-emerald-700">+{taka(verifiedSavings)}</div><p className="muted mt-1">verified after collection</p></div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <form action={saveMoneyTransaction} className="card grid gap-4 p-5">
        <input type="hidden" name="month" value={month}/><div><div className="card-title">Quick entry</div><h2 className="section-title mt-1">Add today&apos;s money</h2><p className="muted mt-1">Designed to take only a few seconds.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Type</span><select className="input" name="transaction_type" defaultValue="expense"><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <label><span className="label">Amount (৳)</span><input className="input" name="amount" type="number" min="0.01" max="100000000" step="0.01" inputMode="decimal" placeholder="e.g. 450" required/></label>
          <label><span className="label">Category</span><select className="input" name="category_id" defaultValue="" required><option value="" disabled>Choose category</option><optgroup label="Expenses">{expenseCategories.map(c=><option key={c.id} value={c.id}>{c.icon??'•'} {c.name}</option>)}</optgroup><optgroup label="Income">{incomeCategories.map(c=><option key={c.id} value={c.id}>{c.icon??'•'} {c.name}</option>)}</optgroup></select></label>
          <label><span className="label">Date</span><input className="input" name="transaction_date" type="date" defaultValue={month===bd.month?bd.today:range.start} required/></label>
          <label><span className="label">Paid via</span><select className="input" name="payment_method" defaultValue="cash"><option value="cash">Cash</option><option value="mobile_wallet">Mobile wallet</option><option value="bank">Bank</option><option value="card">Card</option><option value="other">Other</option></select></label>
          <label><span className="label">Note (optional)</span><input className="input" name="note" maxLength={300} placeholder="e.g. weekly vegetables"/></label>
        </div>
        <SubmitButton>Add transaction</SubmitButton>
      </form>

      <div className="card p-5"><div className="card-title">Where the money went</div><h2 className="section-title mt-1">Top expense categories</h2>
        {topCategories.length===0?<p className="muted mt-5">Add your first expense and the category breakdown will appear here.</p>:<div className="mt-5 grid gap-4">{topCategories.map(row=><div key={row.id}><div className="flex items-center justify-between gap-3 text-sm"><b>{row.category?.icon??'•'} {row.category?.name??'Category'}</b><span className="font-black">{taka(row.total)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600" style={{width:`${Math.max(4,(row.total/maxCategory)*100)}%`}}/></div></div>)}</div>}
        {unbudgeted>0&&<div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950"><b>{taka(unbudgeted)}</b> of this month&apos;s expenses are in categories without a budget.</div>}
      </div>
    </section>

    <section className="card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="card-title">Monthly plan</div><h2 className="section-title mt-1">Category budgets</h2><p className="muted mt-1">Set only the categories you care about. You can change them any month.</p></div><div className="text-sm font-black">Total budget · {taka(summary.budget)}</div></div>
      <form action={saveMoneyBudget} className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"><input type="hidden" name="month" value={month}/><label><span className="label">Expense category</span><select className="input" name="category_id" defaultValue="" required><option value="" disabled>Choose category</option>{expenseCategories.map(c=><option key={c.id} value={c.id}>{c.icon??'•'} {c.name}</option>)}</select></label><label><span className="label">Budget (৳)</span><input className="input" name="amount" type="number" min="1" step="0.01" inputMode="decimal" placeholder="5000" required/></label><SubmitButton>Save budget</SubmitButton></form>
      {budgetRows.length===0?<p className="muted mt-5">No category budgets set for {monthLabel(month)}.</p>:<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{budgetRows.map((budget:any)=>{
        const spent=categorySpend.get(budget.category_id)??0; const amount=Number(budget.amount); const percent=amount>0?(spent/amount)*100:0; const over=spent>amount; const category=budget.money_categories
        return <div className={`rounded-2xl border p-4 ${over?'border-rose-200 bg-rose-50/60':'border-slate-200 bg-white/50'}`} key={budget.id}><div className="flex items-start justify-between gap-2"><div><b>{category?.icon??'•'} {category?.name??'Category'}</b><p className="muted mt-1">{taka(spent)} / {taka(amount)}</p></div><form action={deleteMoneyBudget}><input type="hidden" name="month" value={month}/><input type="hidden" name="id" value={budget.id}/><button className="text-xs font-bold text-rose-700" type="submit">Remove</button></form></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${over?'bg-rose-500':'bg-emerald-500'}`} style={{width:`${Math.min(100,Math.max(2,percent))}%`}}/></div><p className={`mt-2 text-xs font-bold ${over?'text-rose-700':'text-slate-600'}`}>{over?`${taka(spent-amount)} over budget`:`${taka(amount-spent)} remaining`} · {Math.round(percent)}%</p></div>
      })}</div>}
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
      <div className="card p-5"><div><div className="card-title">History</div><h2 className="section-title mt-1">Recent transactions</h2></div>{recent.length===0?<p className="muted mt-5">Nothing recorded for this month yet.</p>:<div className="mt-4 divide-y divide-slate-200">{recent.map((row:any)=>{const category=row.money_categories;const income=row.transaction_type==='income';return <div className="flex items-center gap-3 py-3" key={row.id}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">{category?.icon??'•'}</div><div className="min-w-0 flex-1"><div className="truncate font-black">{category?.name??'Category'}</div><p className="muted truncate">{row.transaction_date} · {paymentLabel(row.payment_method)}{row.note?` · ${row.note}`:''}</p></div><div className={`shrink-0 text-right font-black ${income?'text-emerald-700':'text-slate-900'}`}>{income?'+':'−'}{taka(row.amount)}</div><form action={deleteMoneyTransaction}><input type="hidden" name="month" value={month}/><input type="hidden" name="id" value={row.id}/><button type="submit" className="shrink-0 text-xs font-bold text-rose-700" aria-label="Delete transaction">Delete</button></form></div>})}</div>}</div>

      <div className="card p-5"><div className="card-title">Personalize</div><h2 className="section-title mt-1">Add a category</h2><p className="muted mt-1">Use the defaults or add something specific to your family.</p><form action={createMoneyCategory} className="mt-5 grid gap-3"><input type="hidden" name="month" value={month}/><label><span className="label">Type</span><select className="input" name="kind" defaultValue="expense"><option value="expense">Expense</option><option value="income">Income</option></select></label><label><span className="label">Category name</span><input className="input" name="name" maxLength={60} placeholder="e.g. Parents" required/></label><label><span className="label">Icon (optional)</span><input className="input" name="icon" maxLength={8} placeholder="❤️"/></label><SubmitButton>Add category</SubmitButton></form><div className="mt-5 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs leading-5 text-sky-950"><b>Free value promise:</b> My Money is part of the customer utility layer. It is not blocked by the future 1 Taka Pass.</div></div>
    </section>

    <section className="card p-5"><div className="card-title">Why this connects to BazarPool</div><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="glass-inset rounded-2xl p-4"><b>1. Record</b><p className="muted mt-1">Log what your family actually spends.</p></div><div className="glass-inset rounded-2xl p-4"><b>2. Control</b><p className="muted mt-1">See where the monthly budget is going.</p></div><div className="glass-inset rounded-2xl p-4"><b>3. Save</b><p className="muted mt-1">Compare those costs with verified 2-TAKA-R-BAZAR savings.</p></div></div><p className="muted mt-4">Household: {profile.household_name}. Your money records are visible only to your signed-in account in this first release.</p></section>
  </div></AppShell>
}
