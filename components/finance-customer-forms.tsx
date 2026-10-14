'use client'
import {useRef,useState} from 'react'
import {requestCustomerSale,requestCustomerCredit} from '@/app/actions/finance-customer'
export type Source={kind:string;id:string;label:string;delivery_amount:number;lines:Array<{line_id:string;product_id:string;name:string;quantity:number;unit_price:number}>}
export type Lot={bill_id:string;product_id:string;product:string;reference:string;unit_cost:number;available:number;reserved_returns:number}
export type Sale={id:string;label:string;product_amount:number;delivery_amount:number;receivable:number;refund_payable:number;allocations:Array<{line_index:number;line_id:string;bill_id:string;product_id:string;quantity:number;unit_price:number;unit_cost:number;model:string}>}
const input='w-full min-w-0 rounded-lg border p-2 text-sm'
export function CustomerSaleForm({sources,lots,disabled}:{sources:Source[];lots:Lot[];disabled:boolean}){
 const [value,setValue]=useState(''),[rows,setRows]=useState<Array<{id:number;lineId:string;quantity:number}>>([])
 const nextRowId=useRef(0)
 const source=sources.find(s=>s.kind+':'+s.id===value)
 const maxRows=Math.min(50,source?.lines.reduce((sum,line)=>sum+line.quantity,0)??0)
 return <form action={requestCustomerSale} className="grid gap-3" encType="multipart/form-data">
  <label>Completed customer source<select value={value} onChange={e=>{const s=sources.find(s=>s.kind+':'+s.id===e.target.value);setValue(e.target.value);setRows(s?.lines.map(l=>({id:nextRowId.current++,lineId:l.line_id,quantity:l.quantity}))??[])}} required className={input}><option value="">Choose completed order or Group Deal fulfilment</option>{sources.map(s=><option key={s.kind+':'+s.id} value={s.kind+':'+s.id}>{s.label} · {s.kind}</option>)}</select></label>
  <input type="hidden" name="source_kind" value={source?.kind??''}/><input type="hidden" name="source_id" value={source?.id??''}/>
  {source&&<p className="text-xs">Source prices are fixed. Allocate every fulfilled unit exactly. Separate earned delivery charge: BDT {source.delivery_amount}.</p>}
  {source&&rows.map((row,i)=>{const line=source.lines.find(l=>l.line_id===row.lineId);return <fieldset key={value+':'+row.id+':'+row.lineId} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3"><legend>Inventory allocation {i+1}</legend>
   <label>Source line<select name={'line_id_'+i} value={row.lineId} onChange={e=>setRows(r=>r.map(v=>v.id===row.id?{...v,lineId:e.target.value,quantity:source.lines.find(l=>l.line_id===e.target.value)?.quantity??1}:v))} className={input}>{source.lines.map(l=><option key={l.line_id} value={l.line_id}>{l.name} · {l.quantity} units · BDT {l.unit_price}</option>)}</select></label>
   <label>Matched cost lot<select name={'bill_id_'+i} required className={input}><option value="">Choose verified invoice lot</option>{lots.filter(l=>l.product_id===line?.product_id&&l.available-l.reserved_returns>0).map(l=><option key={l.bill_id} value={l.bill_id}>{l.reference} · {l.available-l.reserved_returns} units · BDT {l.unit_cost}</option>)}</select></label>
   <label>Allocated units<input name={'quantity_'+i} type="number" min="1" max={line?.quantity} step="1" defaultValue={row.quantity} required className={input}/></label>
   <button type="button" disabled={rows.length<=1} aria-label={'Remove inventory allocation '+(i+1)} onClick={()=>setRows(r=>r.filter(v=>v.id!==row.id))} className="rounded-lg border p-2 sm:col-span-3">Remove allocation</button>
  </fieldset>})}
  <button type="button" disabled={disabled||!source||rows.length>=maxRows} onClick={()=>{if(!source?.lines[0])return;const row={id:nextRowId.current++,lineId:source.lines[0].line_id,quantity:1};setRows(r=>[...r,row])}} className="rounded-lg border p-2">Add inventory allocation</button>
  <label>Fulfilment and cost review basis<input name="reason" minLength={10} maxLength={1000} required className={input}/></label>
  <label>Original fulfilment and actual delivery-cost proof<input name="original_file" type="file" required accept=".pdf,.jpg,.jpeg,.png" className={input}/></label>
  <button disabled={disabled||!source} className="rounded-lg bg-teal-700 p-3 font-bold text-white disabled:opacity-40">Request customer sale posting</button>
 </form>
}
export function CustomerCreditForm({sales,disabled,today}:{sales:Sale[];disabled:boolean;today:string}){
 const [value,setValue]=useState('');const sale=sales.find(s=>s.id===value)
 return <form action={requestCustomerCredit} className="grid gap-3" encType="multipart/form-data">
  <label>Original posted sale<select name="sale_id" value={value} onChange={e=>setValue(e.target.value)} required className={input}><option value="">Choose original sale</option>{sales.map(s=><option key={s.id} value={s.id}>{s.label} · BDT {s.product_amount} products + {s.delivery_amount} delivery</option>)}</select></label>
  {sale?.allocations.map((a,i)=><fieldset key={value+':'+a.line_index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><legend>{a.model} · original BDT {a.unit_price} · {a.quantity} units</legend><input type="hidden" name={'line_index_'+i} value={a.line_index}/><label>Credited / returned units<input name={'credit_quantity_'+i} type="number" min="0" max={a.quantity} step="1" defaultValue="0" className={input}/></label><p className="text-xs">Original lot cost BDT {a.unit_cost}. Prior credits are checked again in the database.</p></fieldset>)}
  <label>Separate delivery refund BDT<input name="delivery_refund" type="number" min="0" max={sale?.delivery_amount??0} step=".01" defaultValue="0" className={input}/></label>
  <label className="flex items-center gap-2"><input name="restock" type="checkbox" value="yes"/>Physical return received and fit for restocking (original proof required)</label>
  <label>Credit date<input name="business_date" type="date" defaultValue={today} required className={input}/></label>
  <label>Credit / return reason<input name="reason" required minLength={10} maxLength={1000} className={input}/></label>
  <label>Original credit note and physical return proof<input name="original_file" type="file" required accept=".pdf,.jpg,.jpeg,.png" className={input}/></label>
  <button disabled={disabled||!sale} className="rounded-lg bg-teal-700 p-3 font-bold text-white disabled:opacity-40">Request customer credit note</button>
 </form>
}
