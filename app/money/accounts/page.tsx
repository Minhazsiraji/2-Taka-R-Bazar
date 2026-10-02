import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { MoneyNav } from '@/components/money-nav'
import { SubmitButton } from '@/components/submit-button'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'
import { accountBalances } from '@/lib/money.mjs'
import { moneyAccountTypeLabel } from '@/lib/money-server'
import { createMoneyPerson, deleteMoneyAccount, deleteMoneyPerson, saveMoneyAccount } from '@/app/actions/money'

export const dynamic='force-dynamic'
type Q={error?:string;notice?:string}

export default async function AccountsPage({searchParams}:{searchParams:Promise<Q>}){
  const {user,roles,supabase}=await requireOnboardedUser();const q=await searchParams
  const [{data:accounts},{data:transactions},{data:transfers},{data:people}]=await Promise.all([
    supabase.from('money_accounts').select('*').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
    supabase.from('money_transactions').select('account_id,transaction_type,amount').eq('user_id',user.id),
    supabase.from('money_transfers').select('from_account_id,to_account_id,amount').eq('user_id',user.id),
    supabase.from('money_people').select('*').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
  ])
  const rows=accountBalances((accounts??[]) as any[],(transactions??[]) as any[],(transfers??[]) as any[])
  return <AppShell roles={roles}><div className="grid gap-5"><MoneyNav/>
    <section className="glass-panel rounded-[26px] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.15em] text-violet-700">Money</div><h1 className="mt-1 text-3xl font-black">Accounts & people</h1><p className="muted mt-1">Manage where money is kept and who a household expense belongs to.</p></div><div className="flex flex-wrap gap-2"><Link className="btn-primary" href="/money/transactions?type=income">+ Add money</Link><Link className="btn-secondary" href="/money/monthly-income">Monthly income</Link><Link className="btn-secondary" href="/money/transfers">⇄ Transfer</Link></div></div></section>
    {q.error&&<div className="error">{q.error}</div>}{q.notice&&<div className="success">{q.notice}</div>}

    <section className="grid gap-4"><div><h2 className="text-xl font-black">Accounts</h2><p className="muted mt-1 text-sm">Opening balance is only the starting point. Add salary or other incoming money as Income; move money between your own accounts with Transfer.</p></div>
      <form action={saveMoneyAccount} className="card grid gap-3 p-5 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end"><input type="hidden" name="return_to" value="/money/accounts"/><label><span className="label">Account name</span><input className="input" name="name" placeholder="e.g. bKash or Bank Account" required/></label><label><span className="label">Type</span><select className="input" name="account_type" defaultValue="cash"><option value="cash">Cash</option><option value="bank">Bank</option><option value="credit_card">Credit card</option><option value="mobile_wallet">Mobile wallet</option><option value="other">Other</option></select></label><label><span className="label">Opening balance</span><input className="input" name="opening_balance" type="number" step="0.01" defaultValue="0"/></label><SubmitButton>Add account</SubmitButton></form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row:any)=><article key={row.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-2xl">{row.account_type==='bank'?'🏦':row.account_type==='credit_card'?'💳':row.account_type==='mobile_wallet'?'📱':'💵'}</div><h3 className="mt-3 text-lg font-black">{row.name}</h3><p className="muted">{moneyAccountTypeLabel(String(row.account_type))} · BDT</p></div><form action={deleteMoneyAccount}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="return_to" value="/money/accounts"/><button className="text-xs font-bold text-rose-700">Delete</button></form></div><div className={`mt-5 text-2xl font-black ${Number(row.balance)<0?'text-rose-700':'text-slate-950'}`}>{taka(row.balance)}</div><p className="muted mt-1">Opening {taka(row.opening_balance)}</p><div className="mt-4 flex flex-wrap gap-2"><Link className="btn-secondary text-xs" href={`/money/transactions?type=income&account=${row.id}`}>+ Add money</Link><Link className="btn-secondary text-xs" href={`/money/monthly-income?account=${row.id}`}>Monthly income</Link><Link className="btn-secondary text-xs" href={`/money/transfers?from=${row.id}`}>⇄ Transfer</Link><Link className="btn-secondary text-xs" href={`/money/transactions?account=${row.id}`}>History</Link></div></article>)}</div>
    </section>

    <section className="grid gap-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Household people</h2><p className="muted mt-1 text-sm">Use Me, Shared, or add family members so reports can show spending by person.</p></div><Link href="/money/reports" className="btn-secondary">View family spending report</Link></div>
      <form action={createMoneyPerson} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end"><input type="hidden" name="return_to" value="/money/accounts"/><label><span className="label">Person name</span><input className="input" name="name" placeholder="e.g. Spouse, Child, Mother" maxLength={60} required/></label><SubmitButton>Add person</SubmitButton></form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(people??[]).map((person:any)=><article key={person.id} className="card flex items-center justify-between gap-3 p-4"><div><div className="text-lg font-black">👤 {person.name}</div><p className="muted mt-1 text-xs">{person.is_default?'Default household option':'Family member / spender'}</p></div><div className="flex items-center gap-2"><Link href={`/money/transactions?person=${person.id}`} className="text-xs font-bold text-violet-700">History</Link>{!person.is_default&&<form action={deleteMoneyPerson}><input type="hidden" name="id" value={person.id}/><input type="hidden" name="return_to" value="/money/accounts"/><button className="text-xs font-bold text-rose-700">Delete</button></form>}</div></article>)}</div>
    </section>
  </div></AppShell>
}
