export function normalizeMoneyMonth(value, fallback) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? '')) ? String(value) : fallback
}

export function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  return { start: `${month}-01`, next: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01` }
}

export function shiftMoneyMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function summarizeMoney(transactions = [], budgets = []) {
  const income = transactions.filter(row => row.transaction_type === 'income').reduce((sum,row)=>sum+Number(row.amount||0),0)
  const expense = transactions.filter(row => row.transaction_type === 'expense').reduce((sum,row)=>sum+Number(row.amount||0),0)
  const budget = budgets.reduce((sum,row)=>sum+Number(row.amount||0),0)
  return { income, expense, net: income - expense, budget }
}

export function summarizeBudget(transactions = [], budgets = []) {
  const budget = budgets.reduce((sum,row)=>sum+Number(row.amount||0),0)
  const ids = new Set(budgets.map(row=>row.category_id).filter(Boolean))
  const budgetSpent = transactions.filter(row=>row.transaction_type==='expense'&&ids.has(row.category_id)).reduce((sum,row)=>sum+Number(row.amount||0),0)
  return { budget, budgetSpent, budgetLeft: budget - budgetSpent }
}

export function accountBalances(accounts = [], transactions = [], transfers = []) {
  const balances = new Map(accounts.map(account => [account.id, Number(account.opening_balance || 0)]))
  for (const row of transactions) { if (!balances.has(row.account_id)) continue; const amount=Number(row.amount||0); balances.set(row.account_id,balances.get(row.account_id)+(row.transaction_type==='income'?amount:-amount)) }
  for (const row of transfers) { const amount=Number(row.amount||0); if(balances.has(row.from_account_id))balances.set(row.from_account_id,balances.get(row.from_account_id)-amount); if(balances.has(row.to_account_id))balances.set(row.to_account_id,balances.get(row.to_account_id)+amount) }
  return accounts.map(account=>({...account,balance:balances.get(account.id)??0}))
}

export function categoryTotals(transactions = []) { const totals=new Map(); for(const row of transactions.filter(row=>row.transaction_type==='expense'))totals.set(row.category_id,(totals.get(row.category_id)||0)+Number(row.amount||0)); return totals }
export function personTotals(transactions = []) { const totals=new Map(); for(const row of transactions.filter(row=>row.transaction_type==='expense'))totals.set(row.person_id,(totals.get(row.person_id)||0)+Number(row.amount||0)); return totals }
export function savingsRate(income=0,expense=0){const i=Number(income||0),e=Number(expense||0);return i>0?((i-e)/i)*100:0}
export function monthKey(dateValue){return String(dateValue||'').slice(0,7)}
export function monthlySeries(transactions=[],endMonth,count=12){const months=Array.from({length:count},(_,i)=>shiftMoneyMonth(endMonth,i-count+1));const map=new Map(months.map(month=>[month,{month,income:0,expense:0}]));for(const row of transactions){const bucket=map.get(monthKey(row.transaction_date));if(!bucket)continue;const amount=Number(row.amount||0);if(row.transaction_type==='income')bucket.income+=amount;else if(row.transaction_type==='expense')bucket.expense+=amount}return months.map(month=>map.get(month))}
export function nextRecurringDate(dateValue,frequency){const [year,month,day]=String(dateValue).split('-').map(Number);const date=new Date(Date.UTC(year,month-1,day));if(frequency==='weekly')date.setUTCDate(date.getUTCDate()+7);else if(frequency==='yearly')date.setUTCFullYear(date.getUTCFullYear()+1);else date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString().slice(0,10)}
