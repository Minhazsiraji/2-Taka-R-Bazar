'use client'
import {useState} from 'react'
import {requestExpenseAttribution} from '@/app/actions/finance-attribution'
type Option={id:string;name:string}
export function FinanceExpenseAllocationForm({expenses,budgets,communities,products,disabled}:{
 expenses:Array<{id:string;description:string;amount:number}>,budgets:Array<{id:string;code:string}>,communities:Option[],products:Option[],disabled:boolean}){
 const [count,setCount]=useState(1)
 const input='w-full min-w-0 rounded-lg border p-2 text-sm'
 return <form action={requestExpenseAttribution} className="grid gap-3">
  <label>Approved source expense<select name="expense_id" required className={input}><option value="">Choose expense and exact source total</option>{expenses.map(e=><option key={e.id} value={e.id}>{e.description} · BDT {e.amount}</option>)}</select></label>
  {Array.from({length:count},(_,i)=><fieldset key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><legend className="text-sm font-bold">Allocation {i+1}</legend>
   <label>BDT amount<input name={'allocation_amount_'+i} type="number" min=".01" step=".01" required className={input}/></label>
   <label>Cost center<select name={'cost_center_'+i} className={input}>{['company','staff','technology','marketing','logistics','commission','operations'].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <label>Approved campaign budget<select name={'budget_id_'+i} className={input}><option value="">No campaign</option>{budgets.map(b=><option key={b.id} value={b.id}>{b.code}</option>)}</select></label>
   <label>Community<select name={'community_id_'+i} className={input}><option value="">Company-wide</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>Product<select name={'product_id_'+i} className={input}><option value="">All products / company cost</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>Staff / commission beneficiary ID<input name={'staff_user_id_'+i} className={input} placeholder="Required for commission expenses"/></label>
  </fieldset>)}
  <button type="button" disabled={count>=50||disabled} onClick={()=>setCount(n=>n+1)} className="rounded-lg border p-2">Add allocation row</button>
  <label>Allocation basis and reason<input name="reason" required minLength={10} maxLength={1000} className={input}/></label>
  <p className="text-xs">Every row must sum exactly to the source expense. Pending campaign allocations reserve budget. Approval does not post or pay the expense again.</p>
  <button disabled={disabled} className="rounded-lg bg-teal-700 p-3 font-bold text-white disabled:opacity-40">Submit expense allocation</button>
 </form>
}
