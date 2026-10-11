import Link from 'next/link'
import {AdminShell} from '@/components/admin-shell'
import {requireAdmin} from '@/lib/auth'
import {FinanceExpenseAllocationForm} from '@/components/finance-expense-allocation-form'
import {requestCampaignBudget,reviewCampaignBudget,reviewExpenseAttribution} from '@/app/actions/finance-attribution'
export const dynamic='force-dynamic'
type Budget={id:string;code:string;month_start:string;channel:string;amount:number;status:string}
type Allocation={id:string;expense_id:string;status:string;allocations:Array<{amount:number;cost_center:string;budget_id?:string}>}
export default async function AttributionPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
 const {supabase}=await requireAdmin();const q=await searchParams
 const [{data,error},{data:communities},{data:products}]=await Promise.all([
  supabase.rpc('finance_attribution_source'),supabase.from('communities').select('id,name').eq('active',true),supabase.from('products').select('id,name').eq('active',true)])
 const d=(data??{}) as {budgets?:Budget[];attributions?:Allocation[];expense_sources?:Array<{id:string;description:string;amount:number;attributed:boolean}>}
 const site=process.env.NEXT_PUBLIC_SUPABASE_URL??''
 const enabled=process.env.VERCEL_ENV==='preview'&&process.env.FINANCE_WRITES_ENABLED==='true'&&Boolean(site)&&site===process.env.FINANCE_PREVIEW_SUPABASE_URL&&(!site.includes('sukabonfjcnaavjgjyuy')||process.env.FINANCE_SHARED_DB_UAT_ENABLED==='true')
 const input='w-full min-w-0 rounded-lg border p-2 text-sm'
 return <AdminShell><div className="mx-auto grid w-full max-w-5xl gap-4 p-4">
  <h1 className="text-2xl font-bold">Expense attribution & campaign budgets</h1><Link href="/super-admin/finance" className="underline">Finance intelligence</Link>
  {(error||q.error)&&<p role="alert" className="rounded-lg bg-rose-50 p-3">{q.error??error?.message}</p>}{q.notice&&<p role="status" className="rounded-lg bg-teal-50 p-3">{q.notice}</p>}
  {!enabled&&<p>Financial writes are locked. Read-only records remain available.</p>}
  <section className="grid gap-3 rounded-xl border p-4"><h2 className="text-lg font-bold">Campaign budget request</h2>
   <form action={requestCampaignBudget} className="grid gap-2 sm:grid-cols-2">
    <label>Campaign code<input name="code" required minLength={4} maxLength={80} className={input}/></label><label>Accounting month<input name="month" type="month" required className={input}/></label>
    <label>Marketing channel<select name="channel" className={input}>{['offline','facebook','google','youtube','other_online'].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    <label>Budget BDT<input name="amount" type="number" min=".01" step=".01" required className={input}/></label><label className="sm:col-span-2">Budget reason<input name="reason" required minLength={10} maxLength={1000} className={input}/></label>
    <button disabled={!enabled} className="rounded-lg bg-teal-700 p-3 font-bold text-white disabled:opacity-40">Request campaign budget</button>
   </form>
   {d.budgets?.map(b=><div key={b.id} className="rounded-lg border p-3"><p>{b.code} · {b.month_start} · {b.channel} · BDT {b.amount} · {b.status}</p>{b.status==='pending'&&<form action={reviewCampaignBudget} className="mt-2 grid gap-2"><input type="hidden" name="budget_id" value={b.id}/><label>Independent review reason<input name="reason" required minLength={10} className={input}/></label><div className="flex gap-2"><button name="decision" value="approve" disabled={!enabled} className="rounded-lg border p-2">Approve budget</button><button name="decision" value="reject" disabled={!enabled} className="rounded-lg border p-2">Reject budget</button></div></form>}</div>)}
  </section>
  <section className="grid gap-3 rounded-xl border p-4"><h2 className="text-lg font-bold">Allocate approved expense</h2><FinanceExpenseAllocationForm expenses={d.expense_sources?.filter(e=>!e.attributed)??[]} budgets={d.budgets?.filter(b=>b.status==='approved')??[]} communities={communities??[]} products={products??[]} disabled={!enabled}/></section>
  <section className="grid gap-3 rounded-xl border p-4"><h2 className="text-lg font-bold">Independent attribution review</h2>{d.attributions?.map(a=><div key={a.id} className="rounded-lg border p-3"><p>{a.status} · BDT {a.allocations.reduce((n,r)=>n+Number(r.amount),0)} · {a.allocations.map(r=>r.cost_center).join(', ')}</p>{a.status==='pending'&&<form action={reviewExpenseAttribution} className="mt-2 grid gap-2"><input type="hidden" name="attribution_id" value={a.id}/><label>Independent allocation review<input name="reason" required minLength={10} className={input}/></label><div className="flex gap-2"><button name="decision" value="approve" disabled={!enabled} className="rounded-lg border p-2">Approve expense allocation</button><button name="decision" value="reject" disabled={!enabled} className="rounded-lg border p-2">Reject expense allocation</button></div></form>}</div>)}</section>
 </div></AdminShell>
}
