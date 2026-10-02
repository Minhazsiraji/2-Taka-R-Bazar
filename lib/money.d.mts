export type MoneyTransactionSummaryRow = { transaction_type: 'income' | 'expense'; amount: number | string; category_id?: string }
export type MoneyBudgetSummaryRow = { amount: number | string; category_id?: string }

export function normalizeMoneyMonth(value: unknown, fallback: string): string
export function monthBounds(month: string): { start: string; next: string }
export function shiftMoneyMonth(month: string, delta: number): string
export function summarizeMoney(
  transactions?: MoneyTransactionSummaryRow[], budgets?: MoneyBudgetSummaryRow[],
): { income: number; expense: number; net: number; budget: number }
export function summarizeBudget(
  transactions?: MoneyTransactionSummaryRow[], budgets?: MoneyBudgetSummaryRow[],
): { budget: number; budgetSpent: number; budgetLeft: number }
