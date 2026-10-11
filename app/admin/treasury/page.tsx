import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/auth'
import { treasurySubmitTransaction, treasuryImportStatement } from '@/app/actions/treasury'

export const dynamic='force-dynamic'
type Opt={id:string;name:string;kind:string;institution?:string;last_four?:string|null}
type Loan={id:string;lender:string;kind:string}
type Expense={id:string;description:string;vendor:string;amount:number|string}
type Options={accounts:Opt[];facilities:Loan[];approved_expenses:Expense[]}
const kinds=[
 ['transfer','Internal cash transfer'],
 ['loan_draw','Borrowing received'],
 ['loan_repay','Loan or borrowing repayment'],
 ['card_bill','Credit card bill payment'],
 ['expense_cash','Pay an approved expense — cash/bank'],
 ['expense_card','Charge approved expense to credit card'],
 ['owner_capital','Owner capital contribution'],
 ['owner_draw','Owner withdrawal'],
]
const input='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'
export default async function TreasuryMaker({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
 const {supabase}=await requireAdmin()
 const params=await searchParams
 const {data,error}=await supabase.rpc('treasury_request_options')
 const options=(data??{accounts:[],facilities:[],approved_expenses:[]}) as Options
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})
 return <AdminShell><div className="grid gap-4">
  <div className="rounded-[24px] bg-[linear-gradient(120deg,#062d40,#0d766f)] p-6 text-white">
   <div className="text-xs font-black tracking-[.2em] text-cyan-200">MAKER / FINANCE OPERATIONS</div>
   <h1 className="mt-2 text-3xl font-black tracking-tight">Treasury requests</h1>
   <p className="mt-2 max-w-lg text-sm text-teal-100">Submit a payment or transfer for independent Super Admin review. No money moves automatically.</p>
  </div>
  {params.error&&<p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{params.error}</p>}
  {params.notice&&<p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{params.notice}</p>}
  {error&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Treasury database migration is not available in this environment. No writes are possible.</p>}
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
   Transaction entry records a request, not a verified payment. A separate checker must approve posting and then reconcile external bank statement evidence.
  </div>
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
   <h2 className="text-lg font-black">Create payment or transfer request</h2>
   <p className="mt-1 text-sm text-slate-500">Select only the fields applicable to the chosen transaction type. Nonapplicable accounts must remain blank.</p>
   <form action={treasurySubmitTransaction} className="mt-5 grid gap-3 sm:grid-cols-2">
    <input name="return_path" type="hidden" value="/admin/treasury"/>
    <label className="col-span-full text-xs font-bold text-slate-600">Transaction type<select name="kind" className={input} required>{kinds.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">Pay from account<select name="source_account_id" className={input}><option value="">Not applicable</option>{options.accounts.map(x=><option key={x.id} value={x.id}>{x.name} · {x.kind}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">Receive into account / card<select name="target_account_id" className={input}><option value="">Not applicable</option>{options.accounts.map(x=><option key={x.id} value={x.id}>{x.name} · {x.kind}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">Loan / borrowing<select name="facility_id" className={input}><option value="">Not applicable</option>{options.facilities.map(x=><option key={x.id} value={x.id}>{x.lender} · {x.kind}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">Approved expense<select name="expense_id" className={input}><option value="">Not applicable</option>{options.approved_expenses.map(x=><option key={x.id} value={x.id}>{x.vendor} · ৳{x.amount}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">Amount (BDT)<input name="amount" type="number" min="0.01" step="0.01" required className={input}/></label>
    <label className="text-xs font-bold text-slate-600">Transaction date<input name="business_date" type="date" required defaultValue={today} className={input}/></label>
    <label className="text-xs font-bold text-slate-600">Interest (for loan payment only)<input name="interest_amount" type="number" min="0" step="0.01" defaultValue="0" className={input}/></label>
    <label className="text-xs font-bold text-slate-600">Fees (for loan payment only)<input name="fee_amount" type="number" min="0" step="0.01" defaultValue="0" className={input}/></label>
    <label className="col-span-full text-xs font-bold text-slate-600">Bank/transaction reference<input name="external_reference" required minLength={4} className={input}/></label>
    <label className="col-span-full text-xs font-bold text-slate-600">Business purpose & evidence note<textarea name="memo" required minLength={6} className={input+' min-h-24'}/></label>
    <button className="col-span-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-black text-white">Send for independent treasury approval →</button>
   </form>
  </div>
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
   <h2 className="text-lg font-black">Import bank statement line</h2><p className="mt-1 text-sm text-slate-500">Normalized signed amount: cash inflow positive, cash outflow negative; credit-card charges positive and card bill repayments negative. Import requires independent matching.</p>
   <form action={treasuryImportStatement} className="mt-4 grid gap-3 sm:grid-cols-2">
    <input name="return_path" type="hidden" value="/admin/treasury"/>
    <label className="text-xs font-bold text-slate-600">Account<select name="account_id" required className={input}><option value="">Choose account</option>{options.accounts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-600">Statement date<input type="date" name="statement_date" defaultValue={today} required className={input}/></label>
    <label className="text-xs font-bold text-slate-600">Statement line ID<input name="external_line_id" minLength={4} required className={input}/></label>
    <label className="text-xs font-bold text-slate-600">Signed value (BDT)<input type="number" name="signed_amount" step="0.01" required className={input}/></label>
    <label className="col-span-full text-xs font-bold text-slate-600">Bank transaction reference<input name="reference" minLength={4} required className={input}/></label>
    <button className="col-span-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">Import for independent bank reconciliation →</button>
   </form>
  </div>
  <p className="text-sm text-slate-500"><Link className="font-bold text-teal-700 underline" href="/admin">Back to Operations</Link> · Finance managers should not approve their own transactions.</p>
 </div></AdminShell>
}
