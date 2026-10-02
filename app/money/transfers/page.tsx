import { AppShell } from '@/components/app-shell'
import { MoneyNav } from '@/components/money-nav'
import { SubmitButton } from '@/components/submit-button'
import { requireOnboardedUser } from '@/lib/auth'
import { taka } from '@/lib/format'
import { dhakaToday, loadMoneyReference } from '@/lib/money-server'
import { deleteMoneyTransfer, saveMoneyTransfer } from '@/app/actions/money'

export const dynamic='force-dynamic'
type Q={error?:string;notice?:string;from?:string;to?:string}

export default async function TransfersPage({searchParams}:{searchParams:Promise<Q>}){
  const {user,roles,supabase}=await requireOnboardedUser();const q=await searchParams;const bd=dhakaToday();const ref=await loadMoneyReference(supabase,user.id)
  const accounts=ref.accounts as any[]
  const defaultFrom=accounts.some(a=>a.id===q.from)?q.from??'':''
  const defaultTo=accounts.some(a=>a.id===q.to)&&q.to!==defaultFrom?q.to??'':''
  const {data:transfers}=await supabase.from('money_transfers').select('*').eq('user_id',user.id).order('transfer_date',{ascending:false}).order('created_at',{ascending:false}).limit(500)
  return <AppShell roles={roles}><div className="grid gap-5"><MoneyNav/>
    <section className="glass-panel rounded-[26px] p-5"><div className="text-xs font-black uppercase tracking-[.15em] text-violet-700">Money</div><h1 className="mt-1 text-3xl font-black">Transfers</h1><p className="muted mt-1">Move money between your own accounts without counting it as income or expense.</p></section>
    {q.error&&<div className="error">{q.error}</div>}{q.notice&&<div className="success">{q.notice}</div>}
    <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700"><b>Example:</b> salary enters Brac Bank as <b>Income</b>. If you later move ৳10,000 from Brac Bank to bKash, record it here as a <b>Transfer</b>. Your total family income and expense do not change.</section>
    <form action={saveMoneyTransfer} className="card grid gap-3 p-5 md:grid-cols-2"><input type="hidden" name="return_to" value="/money/transfers"/><label><span className="label">From account</span><select className="input" name="from_account_id" defaultValue={defaultFrom} required><option value="">Choose account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label><span className="label">To account</span><select className="input" name="to_account_id" defaultValue={defaultTo} required><option value="">Choose account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label><span className="label">Amount (৳)</span><input className="input" name="amount" type="number" min="0.01" step="0.01" required/></label><label><span className="label">Date</span><input className="input" name="transfer_date" type="date" defaultValue={bd.today} required/></label><label className="md:col-span-2"><span className="label">Note</span><input className="input" name="note" maxLength={300} placeholder="e.g. Move monthly spending money to bKash"/></label><div className="md:col-span-2"><SubmitButton>Record transfer</SubmitButton></div></form>
    <section className="card overflow-hidden"><div className="divide-y divide-slate-200">{(transfers??[]).length===0?<p className="muted p-6">No transfers yet.</p>:(transfers??[]).map((row:any)=>{const from=accounts.find(a=>a.id===row.from_account_id),to=accounts.find(a=>a.id===row.to_account_id);return <div className="flex items-center gap-3 p-4" key={row.id}><div className="text-xl">⇄</div><div className="min-w-0 flex-1"><b>{from?.name??'Account'} → {to?.name??'Account'}</b><p className="muted">{row.transfer_date}{row.note?` · ${row.note}`:''}</p></div><b>{taka(row.amount)}</b><form action={deleteMoneyTransfer}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="return_to" value="/money/transfers"/><button className="text-xs font-bold text-rose-700">Delete</button></form></div>})}</div></section>
  </div></AppShell>
}
