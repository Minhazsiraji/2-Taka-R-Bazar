import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { MoneyNav } from '@/components/money-nav'
import { SubmitButton } from '@/components/submit-button'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'
import { dhakaToday, loadMoneyReference } from '@/lib/money-server'
import { deleteMoneyRecurring, postMoneyRecurringNow, saveMoneyRecurring } from '@/app/actions/money'

export const dynamic='force-dynamic'
type Q={error?:string;notice?:string;account?:string}

export default async function MonthlyIncomePage({searchParams}:{searchParams:Promise<Q>}){
  const {user,roles,supabase}=await requireOnboardedUser();const q=await searchParams;const bd=dhakaToday();const ref=await loadMoneyReference(supabase,user.id)
  const incomeCategories=(ref.categories as any[]).filter(c=>c.kind==='income')
  const defaultIncome=incomeCategories.find(c=>String(c.name).toLowerCase()==='salary')??incomeCategories[0]
  const defaultAccount=(ref.accounts as any[]).find(a=>a.id===q.account)??(ref.accounts as any[])[0]
  const defaultPerson=(ref.people as any[]).find(p=>p.name==='Me')??(ref.people as any[])[0]
  const {data:rows}=await supabase.from('money_recurring').select('*').eq('user_id',user.id).eq('transaction_type','income').eq('frequency','monthly').order('active',{ascending:false}).order('next_due_date')
  return <AppShell roles={roles}><div className="grid gap-5"><MoneyNav/>
    <section className="glass-panel rounded-[26px] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.15em] text-violet-700">Money</div><h1 className="mt-1 text-3xl font-black">Monthly income</h1><p className="muted mt-1">Set salary, rent, allowance or other regular monthly income once. Post it when the money actually arrives.</p></div><Link href="/money/accounts" className="btn-secondary">Accounts</Link></div></section>
    {q.error&&<div className="error">{q.error}</div>}{q.notice&&<div className="success">{q.notice}</div>}

    <form action={saveMoneyRecurring} className="card grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="return_to" value="/money/monthly-income"/>
      <input type="hidden" name="transaction_type" value="income"/>
      <input type="hidden" name="frequency" value="monthly"/>
      <label><span className="label">Amount (৳)</span><input className="input" name="amount" type="number" min="0.01" step="0.01" placeholder="e.g. 116000" required/></label>
      <label><span className="label">Income category</span><select className="input" name="category_id" defaultValue={defaultIncome?.id??''} required>{incomeCategories.map(c=><option key={c.id} value={c.id}>{c.icon??'•'} {c.name}</option>)}</select></label>
      <label><span className="label">Receiving account</span><select className="input" name="account_id" defaultValue={defaultAccount?.id??''} required>{(ref.accounts as any[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label><span className="label">Person</span><select className="input" name="person_id" defaultValue={defaultPerson?.id??''} required>{(ref.people as any[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span className="label">First income date</span><input className="input" name="start_date" type="date" defaultValue={bd.today} required/></label>
      <label><span className="label">End date (optional)</span><input className="input" name="end_date" type="date"/></label>
      <label className="md:col-span-2"><span className="label">Description</span><input className="input" name="description" maxLength={120} defaultValue="Monthly salary" placeholder="e.g. Monthly salary"/></label>
      <label className="md:col-span-2 xl:col-span-4"><span className="label">Note (optional)</span><input className="input" name="note" maxLength={300} placeholder="Employer, source or any reminder"/></label>
      <div className="md:col-span-2 xl:col-span-4"><SubmitButton>Save monthly income</SubmitButton></div>
    </form>

    <section className="card overflow-hidden"><div className="border-b border-slate-200 p-5"><div className="card-title">Saved monthly income</div><p className="muted mt-1">Nothing is added to an account until you press <b>Post now</b>. This avoids overstating balances when salary/payment is delayed.</p></div><div className="divide-y divide-slate-200">{(rows??[]).length===0?<p className="muted p-6">No monthly income set yet.</p>:(rows??[]).map((row:any)=>{const c=incomeCategories.find(x=>x.id===row.category_id),a=(ref.accounts as any[]).find(x=>x.id===row.account_id),p=(ref.people as any[]).find(x=>x.id===row.person_id);return <div key={row.id} className="flex flex-wrap items-center gap-3 p-4"><div className="text-xl">💰</div><div className="min-w-0 flex-1"><b>{row.description||c?.name||'Monthly income'}</b><p className="muted">next {row.next_due_date} · {a?.name} · {p?.name}</p></div><b className="text-emerald-700">+{taka(row.amount)}</b><span className={`chip ${row.active?'text-emerald-700':'text-slate-500'}`}>{row.active?'Active':'Ended'}</span>{row.active&&<form action={postMoneyRecurringNow}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="transaction_date" value={bd.today}/><input type="hidden" name="return_to" value="/money/monthly-income"/><button className="btn-primary">Post now</button></form>}<form action={deleteMoneyRecurring}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="return_to" value="/money/monthly-income"/><button className="text-xs font-bold text-rose-700">Delete</button></form></div>})}</div></section>
  </div></AppShell>
}
