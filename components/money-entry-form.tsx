'use client'

import { useState } from 'react'
import { saveMoneyTransaction } from '@/app/actions/money'
import { SubmitButton } from '@/components/submit-button'

type Category={id:string;name:string;icon:string|null}

export function MoneyEntryForm({month,today,expenseCategories,incomeCategories}:{
  month:string;today:string;expenseCategories:Category[];incomeCategories:Category[]
}){
  const [type,setType]=useState<'expense'|'income'>('expense')
  const categories=type==='expense'?expenseCategories:incomeCategories
  return <form action={saveMoneyTransaction} className="card grid gap-4 p-5">
    <input type="hidden" name="month" value={month}/>
    <div><div className="card-title">Quick entry</div><h2 className="section-title mt-1">Add today&apos;s money</h2><p className="muted mt-1">Designed to take only a few seconds.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label><span className="label">Type</span><select className="input" name="transaction_type" value={type} onChange={event=>setType(event.target.value as 'expense'|'income')}><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label><span className="label">Amount (৳)</span><input className="input" name="amount" type="number" min="0.01" max="100000000" step="0.01" inputMode="decimal" placeholder="e.g. 450" required/></label>
      <label><span className="label">Category</span><select className="input" name="category_id" defaultValue="" key={type} required><option value="" disabled>Choose {type} category</option>{categories.map(category=><option key={category.id} value={category.id}>{category.icon??'•'} {category.name}</option>)}</select></label>
      <label><span className="label">Date</span><input className="input" name="transaction_date" type="date" defaultValue={today} required/></label>
      <label><span className="label">Paid via</span><select className="input" name="payment_method" defaultValue="cash"><option value="cash">Cash</option><option value="mobile_wallet">Mobile wallet</option><option value="bank">Bank</option><option value="card">Card</option><option value="other">Other</option></select></label>
      <label><span className="label">Note (optional)</span><input className="input" name="note" maxLength={300} placeholder="e.g. weekly vegetables"/></label>
    </div>
    <SubmitButton>{type==='expense'?'Add expense':'Add income'}</SubmitButton>
  </form>
}
