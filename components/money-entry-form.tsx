'use client'

import { useState } from 'react'
import { saveMoneyTransaction } from '@/app/actions/money'
import { SubmitButton } from '@/components/submit-button'

type Category={id:string;name:string;icon:string|null}
type Account={id:string;name:string;account_type:string}
type Person={id:string;name:string}
type Props={month:string;today:string;expenseCategories:Category[];incomeCategories:Category[];accounts?:Account[];people?:Person[];returnTo?:string;compact?:boolean;defaultCategoryId?:string;defaultType?:'expense'|'income';defaultAccountId?:string}

export function MoneyEntryForm({month,today,expenseCategories,incomeCategories,accounts=[],people=[],returnTo='/money',compact=false,defaultCategoryId,defaultType='expense',defaultAccountId}:Props){
  const expenseDefault=defaultCategoryId||expenseCategories.find(c=>c.name==='Groceries')?.id||expenseCategories[0]?.id||''
  const incomeDefault=incomeCategories.find(c=>c.name==='Salary')?.id||incomeCategories[0]?.id||''
  const [type,setType]=useState<'expense'|'income'>(defaultType)
  const [categoryId,setCategoryId]=useState(defaultType==='income'?incomeDefault:expenseDefault)
  const categories=type==='expense'?expenseCategories:incomeCategories
  const changeType=(value:'expense'|'income')=>{setType(value);setCategoryId(value==='expense'?expenseDefault:incomeDefault)}
  const selectedAccount=accounts.some(account=>account.id===defaultAccountId)?defaultAccountId:accounts[0]?.id??''
  return <form action={saveMoneyTransaction} className={`${compact?'glass-panel':'card'} grid gap-4 p-5`}>
    <input type="hidden" name="month" value={month}/><input type="hidden" name="return_to" value={returnTo}/>
    <div><div className="card-title">Quick entry</div><h2 className="section-title mt-1">{compact?'Add expense from Home':type==='income'?'Add money / income':'Add today\'s money'}</h2><p className="muted mt-1">{type==='income'?'Choose the account receiving the money. Income increases that account balance.':'Groceries is ready by default. Change only what you need.'}</p></div>
    <div className={`grid gap-3 ${compact?'sm:grid-cols-2 lg:grid-cols-4':'sm:grid-cols-2'}`}>
      <label><span className="label">Type</span><select className="input" name="transaction_type" value={type} onChange={event=>changeType(event.target.value as 'expense'|'income')}><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label><span className="label">Amount (৳)</span><input className="input" name="amount" type="number" min="0.01" max="100000000" step="0.01" inputMode="decimal" placeholder="e.g. 450" required/></label>
      <label><span className="label">Category</span><select className="input" name="category_id" value={categoryId} onChange={event=>setCategoryId(event.target.value)} required>{categories.map(category=><option key={category.id} value={category.id}>{category.icon??'•'} {category.name}</option>)}</select></label>
      <label><span className="label">Date</span><input className="input" name="transaction_date" type="date" defaultValue={today} required/></label>
      <label><span className="label">Account</span><select className="input" name="account_id" defaultValue={selectedAccount}>{accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label><span className="label">Person</span><select className="input" name="person_id" defaultValue={people.find(p=>p.name==='Me')?.id??people[0]?.id??''}>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label><span className="label">Paid via</span><select className="input" name="payment_method" defaultValue={type==='income'?'bank':'cash'}><option value="cash">Cash</option><option value="mobile_wallet">Mobile wallet</option><option value="bank">Bank</option><option value="card">Card</option><option value="other">Other</option></select></label>
      <label><span className="label">Description</span><input className="input" name="description" maxLength={120} placeholder={type==='income'?'e.g. Monthly salary':'e.g. Weekly groceries'}/></label>
      {!compact&&<label className="sm:col-span-2"><span className="label">Note (optional)</span><input className="input" name="note" maxLength={300} placeholder="Any extra detail"/></label>}
    </div>
    {compact&&<input type="hidden" name="note" value=""/>}
    <SubmitButton>{type==='expense'?'Add expense':'Add income'}</SubmitButton>
  </form>
}
