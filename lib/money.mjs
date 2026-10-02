export function normalizeMoneyMonth(value, fallback) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? '')) ? String(value) : fallback
}

export function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  return {
    start: `${month}-01`,
    next: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  }
}

export function shiftMoneyMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function summarizeMoney(transactions = [], budgets = []) {
  const income = transactions.filter(row => row.transaction_type === 'income').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const expense = transactions.filter(row => row.transaction_type === 'expense').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const budget = budgets.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  return { income, expense, net: income - expense, budget, budgetLeft: budget - expense }
}
