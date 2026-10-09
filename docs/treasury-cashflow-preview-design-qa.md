# 2TBR Treasury & Cash Flow — Architecture, Audit and Release Gate
Date 2026-10-09 | PREVIEW ONLY | BDT-only phase | NO Production merge.

## Single source of truth
Super Admin sees 3+ bank accounts, office cash, mobile wallets, corporate credit cards, business bank loans and private lenders. All book amounts derive from the EXISTING finance_journals and finance_journal_lines, never a second cashbook. Customer My Money is isolated.

## Ten operational stages
1. Register cash, wallet, bank and card account with only last 4 digits, opening statement reference, opening date, starting balance, card limit and restricted funds.
2. Register bank loan/private borrowing contract, original principal, outstanding principal, APR, maturity and payment day; opening liability never counted as new-period borrowing.
3. Finance staff drafts a transfer, loan draw, loan repayment, card-bill payment, approved expense payment by cash/card, owner contribution or drawings.
4. Independent Super Admin approves or rejects; simultaneous liquidity risk checked against locked bank/loan records before posting.
5. Atomically write double-entry journal with stable event key; posted financial records are immutable.
6. Imported bank/card statement lines start UNMATCHED. Duplicate bank line IDs blocked.
7. Separate checker matches external amount, real account leg, date and reference to posted journal; wrong amount/account rejected.
8. Track cash, restricted cash, credit card liabilities, loans, short-term contractual obligations and forecast income WITHOUT adding uncollected receipts to cash.
9. Report bank/location balances, six-month finance activity, lender principal progress, 13-week due-event list and rejected/unmatched items.
10. Financial Controller closes month only after full operations, procurement, payment gateway and lender statements reconcile.

## Accounting events (debit / credit)
- Bank-to-bank: Receiving asset / Sending asset. Zero consolidated cash flow or P&L.
- Business loan draw: Bank asset / Loan payable. Financing inflow only.
- Owner capital: Bank asset / Owner equity. Financing inflow only.
- Loan principal paid: Loan payable / Bank asset. Financing outflow; no operating expense.
- Interest and fees paid: Finance expense / Bank asset. Cash classification policy requires accounting review.
- Approved operating expense accrued: Expense / Expense payable.
- Expense settled from bank: Expense payable / Physical bank asset. No second expense.
- Expense charged to card: Expense payable / Credit-card liability. Noncash at charge.
- Card statement paid: Card liability / Bank asset. No second expense.
- Owner withdrawal: Drawings (equity) / Bank asset. No new business expense.
- Opening cash or borrowing: Opening equity clearing offset to asset/liability. Excluded from current period cash flow.

## Loopholes protected in current PREVIEW
T01: No unrestricted cash negative on approved outflow.
T02: Card charge cannot exceed credit limit.
T03: Principal repayment cannot exceed outstanding loan balance.
T04: Maker cannot review own transfer or disbursement.
T05: Duplicate account-based bank payment references rejected.
T06: Same approved expense cannot settle twice.
T07: Generic legacy account settlement blocked after creating physical Treasury accounts.
T08: Wrong/missing external statement line cannot mark bank payment reconciled.
T09: Duplicate statement line and matching the same account leg twice rejected.
T10: Transfer of money between own banks cannot create a profit, expense or gross cash flow.
T11: Borrowed money and unused card credit never counted as sales/profit.
T12: Credit-card purchase and later repayment cannot be double-expensed.
T13: Backdated posting to locked financial month prevented.
T14: Cash, card, loan and lender data are private/RLS-restricted; staff options omit balances.
T15: Preview finance mutations require isolated approved Supabase endpoint and fail closed against Production ref.
T16: Forecasts carry contractual vs provisional label; predicted receipts are never treated as actual cash.
T17: No secret account numbers or card credentials stored.
T18: Exact BDT numeric values; two fractional digits only.
T19: Opening balances are journalled but explicitly NOT marked statement-verified.
T20: Posted entries use immutable balanced finance journals.
T21: Explicit separate interest, principal and fees for debt repayment.
T22: Credit card statement cash payments are UNALLOCATED until linked to underlying costs/policy.
T23: All manual account corrections require new accounting events, no posted journal edits.
T24: As-of ledger cash/loan balances are taken from posted entries, not staff estimates.

## Synthetic end-to-end acceptance
- Accounts: Bank A, B, C, office cash, mobile wallet, corporate card; facilities: bank loan and private borrowing.
- Scenarios: opening asset/debt, linked bank transfer, loan draw, principal+interest+fees, card bill, approved expense/card charge, approved expense/bank payment, owner contribution/drawing.
- Expected after scenario: opening cash BDT 180000; final cash BDT 193200; card payable BDT 6000; loan+private debt BDT 53000; loan+card liabilities BDT 59000; net cash movement BDT +13200; expense accrual BDT 4200 (no duplicate).
- Negative scenarios: customer role cannot create accounts; maker cannot approve; duplicate payment; overdraft; duplicate transfer; loan overpayment; mismatched statement; statement import replay; closed period posting.
- Liquidity scenario: BDT 100000 operating reserve and BDT 20000 contractual supplier payment imply management deployable BDT 73200 from BDT 193200 cash.
- Disposable test database and explicit BEGIN/ROLLBACK guarantee no synthetic customer money inserted into Production.

## International reporting alignment
IAS 7 operating, investing and financing, direct/indirect cash-flow reconciliation, financing liability disclosure, restricted cash and cash equivalents rules are ultimate goals. This preview is NOT certified IAS 7, because customer collections, exact purchase/inventory invoices, financial gateway settlements, supplier payments, loan schedules, investing assets, card classifications and bank verification are not yet fully connected.

## Hard release blockers
1. All current commit tests, npm build/lint/typecheck, full DB reset and synthetic pgTAP must PASS.
2. Vercel preview URL at exact commit, and DIFFERENT approved Supabase project from Production.
3. Two separate maker/checker logins for real UI UAT across 360px/768px/1440px.
4. External bank/card statement origin validated, uploaded evidence with appropriate access/retention.
5. Actual Community Ops cash-in-transit and COD orders integrated into Treasury ledgers.
6. Approved supplier POs, bills, inventory COGS and accounts payable integrated with actual cash movements.
7. Automatic 13-week cash forecast from real AR/AP, loan installments and vendor commitments.
8. Cards classified by original purchase and repaid amounts to prepare IAS 7 statements.
9. Cash recovery time, DSO/DIO/DPO/CCC and debt service ratios use REAL matched data.
10. Security & compliance acceptance and explicit owner confirmation before merge to main.

Never call sample dashboard figures real bank statements; never certify final P&L or IAS 7 statements from this preview foundation.
