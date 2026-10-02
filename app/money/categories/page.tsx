import { AppShell } from '@/components/app-shell'
import { MoneyNav } from '@/components/money-nav'
import { SubmitButton } from '@/components/submit-button'
import { requireOnboardedUser } from '@/lib/auth'
import { createMoneyCategory, deleteMoneyCategory, createMoneyPerson, deleteMoneyPerson } from '@/app/actions/money'

export const dynamic='force-dynamic'
type Q={error?:string;notice?:string}

export default async function CategoriesPage({searchParams}:{searchParams:Promise<Q>}){
  const {user,roles,supabase}=await requireOnboardedUser();const q=await searchParams
  const [{data:categories},{data:people}]=await Promise.all([
    supabase.from('money_categories').select('*').eq('user_id',user.id).eq('active',true).order('kind').order('sort_order').order('name'),
    supabase.from('money_people').select('*').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
  ])
  const expense=(categories??[]).filter((c:any)=>c.kind==='expense'),income=(categories??[]).filter((c:any)=>c.kind==='income')
  return <AppShell roles={roles}><div className="grid gap-5"><MoneyNav/>
    <section className="glass-panel rounded-[26px] p-5"><div className="text-xs font-black uppercase tracking-[.15em] text-violet-700">Organise</div><h1 className="mt-1 text-3xl font-black">Categories & People</h1><p className="muted mt-1">Default categories are ready; add only what your family needs.</p></section>
    {q.error&&<div className="error">{q.error}</div>}{q.notice&&<div className="success">{q.notice}</div>}
    <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="card p-5"><div className="card-title">Categories</div><div className="mt-5 grid gap-6 md:grid-cols-2"><div><h2 className="font-black">Expense categories</h2><div className="mt-3 divide-y divide-slate-200">{expense.map((c:any)=><div className="flex items-center gap-3 py-3" key={c.id}><div className="text-lg">{c.icon??'•'}</div><div className="min-w-0 flex-1"><b>{c.name}</b><p className="muted">{c.is_default?'Default':'Custom'}</p></div>{!c.is_default&&<form action={deleteMoneyCategory}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="return_to" value="/money/categories"/><button className="text-xs font-bold text-rose-700">Delete</button></form>}</div>)}</div></div><div><h2 className="font-black">Income categories</h2><div className="mt-3 divide-y divide-slate-200">{income.map((c:any)=><div className="flex items-center gap-3 py-3" key={c.id}><div className="text-lg">{c.icon??'•'}</div><div className="min-w-0 flex-1"><b>{c.name}</b><p className="muted">{c.is_default?'Default':'Custom'}</p></div>{!c.is_default&&<form action={deleteMoneyCategory}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="return_to" value="/money/categories"/><button className="text-xs font-bold text-rose-700">Delete</button></form>}</div>)}</div></div></div><form action={createMoneyCategory} className="mt-6 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-[160px_1fr_100px_auto] sm:items-end"><input type="hidden" name="return_to" value="/money/categories"/><select className="input" name="kind"><option value="expense">Expense</option><option value="income">Income</option></select><input className="input" name="name" maxLength={60} placeholder="New category" required/><input className="input" name="icon" maxLength={8} placeholder="❤️"/><SubmitButton>Add category</SubmitButton></form></div>
      <div className="card p-5"><div className="card-title">Spending by person</div><p className="muted mt-1">Tag transactions to Me, Shared, spouse, child or another family member.</p><div className="mt-4 divide-y divide-slate-200">{(people??[]).map((p:any)=><div className="flex items-center gap-3 py-3" key={p.id}><div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100">👤</div><div className="flex-1"><b>{p.name}</b><p className="muted">{p.is_default?'Default':'Custom'}</p></div>{!p.is_default&&<form action={deleteMoneyPerson}><input type="hidden" name="id" value={p.id}/><input type="hidden" name="return_to" value="/money/categories"/><button className="text-xs font-bold text-rose-700">Delete</button></form>}</div>)}</div><form action={createMoneyPerson} className="mt-5 grid gap-3"><input type="hidden" name="return_to" value="/money/categories"/><input className="input" name="name" maxLength={60} placeholder="e.g. Spouse" required/><SubmitButton>Add person</SubmitButton></form></div>
    </section>
  </div></AppShell>
}
