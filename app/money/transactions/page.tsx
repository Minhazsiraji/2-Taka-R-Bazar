import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { MoneyNav } from '@/components/money-nav'
import { MoneyEntryForm } from '@/components/money-entry-form'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'
import { dhakaToday, loadMoneyReference } from '@/lib/money-server'
import { deleteMoneyTransaction } from '@/app/actions/money'

export const dynamic='force-dynamic'
type Q={type?:string;category?:string;account?:string;person?:string;q?:string;error?:string;notice?:string}

export default async function TransactionsPage({searchParams}:{searchParams:Promise<Q>}){
  const {user,roles,supabase}=await requireOnboardedUser();const q=await searchParams;const bd=dhakaToday();const ref=await loadMoneyReference(supabase,user.id)
  let query=supabase.from('money_transactions').select('id,transaction_type,amount,category_id,account_id,person_id,transaction_date,payment_method,description,note,created_at').eq('user_id',user.id).order('transaction_date',{ascending:false}).order('created_at',{ascending:false}).limit(1000)
  if(q.type==='income'||q.type==='expense')query=query.eq('transaction_type',q.type);if(q.category)query=query.eq('category_id',q.category);if(q.account)query=query.eq('account_id',q.account);if(q.person)query=query.eq('person_id',q.person)
  const {data}=await query;let rows=(data??[]) as any[];const term=String(q.q??'').trim().toLowerCase();if(term)rows=rows.filter(r=>`${r.description??''} ${r.note??''}`.toLowerCase().includes(term))
  const income=rows.filter(r=>r.transaction_type==='income').reduce((s,r)=>s+Number(r.amount),0),expense=rows.filter(r=>r.transaction_type==='expense').reduce((s,r)=>s+Number(r.amount),0)
  const expenses=(ref.categories as any[]).filter(c=>c.kind==='expense'),incomes=(ref.categories as any[]).filter(c=>c.kind==='income')
  const defaultType=q.type==='income'?'income':'expense'
  return <AppShell roles={roles}><div className="grid gap-5"><MoneyNav/>
    <section className="glass-panel rounded-[26px] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.15em] text-violet-700">Money</div><h1 className="mt-1 text-3xl font-black">Transactions</h1><p className="muted mt-1">Search, filter and record family income or expenses.</p></div><Link href="/money" className="btn-secondary">Dashboard</Link></div></section>
    {q.error&&<div className="error">{q.error}</div>}{q.notice&&<div className="success">{q.notice}</div>}
    <section className="grid gap-3 sm:grid-cols-3"><div className="card p-4"><div className="card-title">Income</div><div className="metric mt-2 text-emerald-700">{taka(income)}</div></div><div className="card p-4"><div className="card-title">Expenses</div><div className="metric mt-2 text-rose-700">{taka(expense)}</div></div><div className="card p-4"><div className="card-title">Net</div><div className="metric mt-2">{taka(income-expense)}</div></div></section>
    <MoneyEntryForm month={bd.month} today={bd.today} expenseCategories={expenses} incomeCategories={incomes} accounts={ref.accounts as any[]} people={ref.people as any[]} returnTo="/money/transactions" defaultType={defaultType} defaultAccountId={q.account}/>
    <form className="card grid gap-3 p-4 md:grid-cols-5" method="get"><input className="input md:col-span-2" name="q" defaultValue={q.q??''} placeholder="Search description or notes..."/><select className="input" name="type" defaultValue={q.type??''}><option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select><select className="input" name="category" defaultValue={q.category??''}><option value="">All categories</option>{(ref.categories as any[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn-secondary" type="submit">Filter</button><select className="input" name="account" defaultValue={q.account??''}><option value="">All accounts</option>{(ref.accounts as any[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><select className="input" name="person" defaultValue={q.person??''}><option value="">All people</option>{(ref.people as any[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><Link className="btn-secondary text-center" href="/money/transactions">Clear</Link></form>
    <section className="card overflow-hidden"><div className="divide-y divide-slate-200">{rows.length===0?<p className="muted p-6">No matching transactions.</p>:rows.map(row=>{const c=(ref.categories as any[]).find(x=>x.id===row.category_id),a=(ref.accounts as any[]).find(x=>x.id===row.account_id),p=(ref.people as any[]).find(x=>x.id===row.person_id);return <div key={row.id} className="flex items-center gap-3 p-4"><div className="text-xl">{c?.icon??'•'}</div><div className="min-w-0 flex-1"><b className="block truncate">{row.description||c?.name||'Transaction'}</b><p className="muted truncate">{row.transaction_date} · {c?.name} · {a?.name} · {p?.name}</p>{row.note&&<p className="mt-1 truncate text-xs italic text-slate-500">{row.note}</p>}</div><b className={row.transaction_type==='income'?'text-emerald-700':'text-slate-950'}>{row.transaction_type==='income'?'+':'−'}{taka(row.amount)}</b><form action={deleteMoneyTransaction}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="return_to" value="/money/transactions"/><button className="text-xs font-bold text-rose-700">Delete</button></form></div>})}</div></section>
  </div></AppShell>
}
