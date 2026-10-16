'use client'

import {useState} from 'react'
import {enterPlanningTier} from '@/app/actions/pilot'
import {SubmitButton} from '@/components/submit-button'
import {taka} from '@/lib/format'

type Supplier={id:string;business_name:string}
export function EasyTierForm({poolId,itemId,suppliers,benchmark,count}:{poolId:string;itemId:string;suppliers:Supplier[];benchmark:number;count:number}){
 const [quoted,setQuoted]=useState('')
 const [delivery,setDelivery]=useState('0')
 const [handling,setHandling]=useState('0')
 const [customer,setCustomer]=useState('')
 const [threshold,setThreshold]=useState('')
 const num=(v:string)=>v.trim()===''?null:Number(v)
 const q=num(quoted),d=num(delivery),h=num(handling),c=num(customer)
 const landed=q===null||d===null||h===null?null:Math.round((q+d+h)*100)/100
 const saving=c===null?null:Math.round((benchmark-c)*100)/100
 const margin=c===null||landed===null?null:Math.round((c-landed)*100)/100
 const valid=landed!==null&&landed>0&&q!==null&&q>0&&d!==null&&d>=0&&h!==null&&h>=0&&c!==null&&c>=landed&&c<=benchmark&&Number.isInteger(Number(threshold))&&Number(threshold)>0
 return <form action={enterPlanningTier} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 sm:grid-cols-2 lg:grid-cols-3">
  <input type="hidden" name="return_to" value="/admin/easy-business"/>
  <input type="hidden" name="pool_id" value={poolId}/>
  <input type="hidden" name="pool_item_id" value={itemId}/>
  <input type="hidden" name="landed_unit_price" value={landed??''}/>
  <div className="sm:col-span-2 lg:col-span-3">
   <b>Price tier {count+1} of 2–3</b>
   <p className="muted text-sm">Enter verified supplier costs. Landed cost, customer savings and estimated gross contribution calculate automatically. Values are per unit in ৳.</p>
  </div>
  <label><span className="label">Supplier</span><select name="supplier_id" className="input" required defaultValue=""><option value="">Choose supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.business_name}</option>)}</select></label>
  <label><span className="label">Unlock at units (not customers)</span><input name="threshold_quantity" className="input" type="number" min="1" step="1" required placeholder="e.g. 5" value={threshold} onChange={e=>setThreshold(e.target.value)}/></label>
  <label><span className="label">Supplier price / unit (৳)</span><input name="quoted_unit_price" className="input" type="number" min="0.01" step="0.01" required value={quoted} onChange={e=>setQuoted(e.target.value)}/></label>
  <label><span className="label">Delivery / unit (৳)</span><input name="delivery_cost" className="input" type="number" min="0" step="0.01" required value={delivery} onChange={e=>setDelivery(e.target.value)}/></label>
  <label><span className="label">Other handling / unit (৳)</span><input className="input" type="number" min="0" step="0.01" value={handling} onChange={e=>setHandling(e.target.value)}/></label>
  <label><span className="label">Customer unlock price / unit (৳)</span><input name="customer_ceiling_price" className="input" type="number" min="0.01" step="0.01" required value={customer} onChange={e=>setCustomer(e.target.value)}/></label>
  <label><span className="label">Supplier quote valid until</span><input name="valid_until" className="input" type="date"/></label>
  <label className="sm:col-span-2 lg:col-span-3"><span className="label">Private supplier evidence (optional)</span><input name="notes" className="input" placeholder="Reference, verbal quotation date, delivery conditions"/></label>
  <div className="grid gap-2 sm:col-span-2 lg:col-span-3 sm:grid-cols-3" role="status" aria-live="polite">
   <div className="rounded-xl border border-slate-200 p-3"><span className="label">Total landed cost</span><b className="block">{landed===null?'Enter supplier costs':taka(landed)}</b></div>
   <div className="rounded-xl border border-slate-200 p-3"><span className="label">Customer saving vs. benchmark</span><b className="block">{saving===null?'Enter customer price':taka(saving)}</b></div>
   <div className="rounded-xl border border-slate-200 p-3"><span className="label">Gross contribution (not net profit)</span><b className="block">{margin===null?'Awaiting prices':taka(margin)}</b></div>
  </div>
  <p className="muted text-xs sm:col-span-2 lg:col-span-3">Benchmark: {taka(benchmark)}. Each higher-quantity tier must offer the same or lower customer price. These values are planning estimates; settlement and accounting stay separately controlled.</p>
  {!valid&&quoted&&customer&&<p role="alert" className="text-sm font-bold text-red-700 sm:col-span-2 lg:col-span-3">Check positive quantity and costs: customer price must cover landed cost and must not exceed the verified market benchmark.</p>}
  <div className="sm:col-span-2 lg:col-span-3"><SubmitButton className="btn-primary" disabled={!valid||suppliers.length===0}>Save price tier</SubmitButton></div>
 </form>
}
