# 2-TAKA-R-BAZAR — Finance + Treasury + Procurement + Community Ops integration gate
Date: 9 October 2026. Status: DRAFT PREVIEW ONLY. No Production merge.

## Architecture integrated
The branch merges the tested Finance Expense + Treasury Cash Flow foundation with current Supply Control and Community Ops handover code (including fraud/security hardening). Dedicated operational procurement screens and isolated Server Actions add PO approval, verified dispatch matching, supplier invoice verification, and supplier bank payment approval.

## Accounts and event lifecycle
- Pool supplier quote (final, selected, frozen quantity, not expired) -> pending PO -> independent owner approval.
- Supplier dispatch (approved source, seal, blind receipt, verification/variance) -> PO-to-dispatch linkage, accepted quantity from immutable received lines.
- Supplier bill (real receipt document, hash, exact PO unit cost and max unbilled accepted quantity) -> independent approval -> Dr 1200 inventory, Cr 2100 supplier payable.
- Approved supplier settlement request -> independent Super Admin check -> Dr 2100 payable, Cr unique physical bank account -> bank statement line imported and matched separately by independent reviewer.
- Community officer cash -> independent officer/admin handover -> closed, no-variance Community Ops day -> separate owner-ledger approval into a **physical community cash** account; Dr physical cash, Cr product COD suspense 2210 and delivery-fee suspense 2211. This is **not yet earned product revenue or final net profit**.
- Cash movements report reconciles verified community cash custody and matched procurement supplier cash outflows. Liquidity includes open supplier payables so it cannot be shown as unencumbered cash.
- All financial mutations remain locked unless on a Vercel Preview with a separately approved Supabase database URL and FINANCE_WRITES_ENABLED=true. No user data or live account movements were created.

## Synthetic test coverage
- 73 Finance PostgreSQL assertions.
- 53 Treasury PostgreSQL assertions.
- The main Supply Control synthetic E2E and new PO / supplier-bill / bank settlement / COD extension run in one disposable Postgres transaction ending ROLLBACK.
- Negative paths include invalid final pricing stage, duplicate PO, improper supplier or dispatch, over-billed goods and price variance, duplicate invoice, self approval, duplicate supplier payment, and duplicate community cash custody posting.
- An operational bank settlement must match an imported independent external statement line. Imported synthetic lines are **NOT external verified provider evidence**.
- Application npm tests, lint, typecheck, Next build and vulnerability audit in CI.

## Controls built
1. Select only locked final supplier quotes.
2. Require dual maker-checker roles for PO, invoice, bank payment.
3. Link physical handover to supplier, product, destination and permitted PO quantity.
4. Invoice only verified goods, not dispatched but missing/damaged goods.
5. Idempotent unique invoices, documentary hashes and bank payment references.
6. Prevent inventory or payable journals from being manually edited.
7. Debit the correct bank, do not count supplier payments twice as operating expense.
8. Keep supplier payable in liquidity until settled.
9. Preserve Community Ops product COD and delivery fee separation.
10. Accept only genuinely closed/accepted exception-free cash handovers.
11. Require a different ledger poster than the cashier and original receiver.
12. Never falsely mark COD suspense as verified revenue before actual order COGS reconciliation.
13. Preserve existing supplier source and buyer blind verification fraud holds.

## Outstanding release blockers — NOT complete
- Independent **paid or separately approved** Supabase Preview DB, environment variables and real role-based browser UAT; existing Preview URL may point at Production DB and therefore all mutations are deliberately disabled.
- External authenticated bank/payment statement source. Manual statement entry alone cannot prove money arrived.
- Comprehensive sales/COGS events and inventory-lot valuation after order completion, including Group Deals, returns, refunds, spoiled/unsold stock and Direct Products.
- Order-level matching of COD suspense to specific completed order sales and verified collection; delivery fees to earned service and actual delivery operating cost. Current module deliberately holds them as liabilities.
- Supplier PO creation is manually initiated from a selected quote, dispatch-to-PO linking is a manual controlled stage; automated supplier issuance/confirmation and supplier-account statements remain pending.
- Partial supplier settlements and credit notes, vendor rebates, returns and bank reconciliation enhancements. Current supplier payment is exact **full-bill** settlement.
- Automatic 13-week forecasts from confirmed orders, suppliers/AP due dates, debt EMI schedules and employee payroll.
- Full tax, loan interest accrual, authenticated card purchase statements, investing activity, certified IAS 7 direct/indirect statement and financial year close.
- Concurrent workflow/race and live browser accessibility UAT; broad Security Gate signoff.
- Merge to main requires final explicit approval; production remains untouched.

## Release policy
Do not equate green CI with financial Production readiness. The Super Admin Finance screen must retain UNAVAILABLE_UNTIL_REVENUE_COGS_RECONCILED and Treasury must retain MANAGEMENT_ONLY accounting labels. Never claim actual net profit, ROI, CCC or cash-to-return date from the current incomplete source transactions.

Deployment integrity: use one exact READY Vercel Git Preview matching the final audited commit; do not change the Production alias.
