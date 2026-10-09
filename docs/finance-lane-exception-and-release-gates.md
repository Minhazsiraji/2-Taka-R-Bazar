# 2-TAKA-R-BAZAR — Finance Lane: exception architecture and release gates
Date: 2026-10-09 | Branch: feat/finance-ledger-preview-20261009 | Status: DRAFT / NO PRODUCTION APPROVAL

## Non-negotiable principles
1. Customer My Money remains private and separate from 2TBR company accounting.
2. Order GMV, confirmed commitments, customer savings and cash received are not net profit.
3. Orders, fulfilments, supplier invoices, payment sources and physical stock must have distinct event owners.
4. Journal posting is exact-decimal, idempotent, two-sided and immutable. Corrections require reasoned reversal journals.
5. Approval and disbursement are independent. An employee cannot approve their own submission.
6. No revenue or product COGS becomes *final* from mere supplier quotations or customer demand.
7. "Unknown", "pending evidence", "unreconciled", "estimated" and "zero" are five different states.
8. Company, community, pool, SKU, marketing campaign and supplier dimensions must be traceable without duplicate cost allocation.
9. Database and file evidence are private; production data is never used for synthetic financial UAT.
10. This branch is a first finance slice. Live end-to-end net profit is expressly unimplemented and must not be represented as complete.

## Canonical economic flow
| Step | Operational event | Accounting event / control | Exception |
| --- | --- | --- | --- |
| 01 | QR scan or referral | Campaign attribution only | No paid customer or profit assumed |
| 02 | Pool demand / group deal forming | No revenue, no procurement expense | Withdrawn, bot, duplicate, cancellation |
| 03 | Price and supplier shortlist | Quote and provisional cost only | Vendor price expires; currency/tax/freight mismatch |
| 04 | Purchase order approved | Purchase commitment, no automatic revenue | Unauthorized PO, wrong unit pack, mismatched tier |
| 05 | Physical goods received | Verify receipt, shortage, damage, expiry, inventory | Undelivered, partially received, extra units, expired goods |
| 06 | Supplier invoice received | PO/receipt/invoice three-way match; landed-cost basis | Duplicate invoice; wrong VAT/tax; rebates unverified |
| 07 | Customer price confirmed | Frozen unit/customer price; remains unearned | Later repricing, refunds, promo discounts |
| 08 | Fulfilment collected/delivered | Earn sales and actual COGS after qualifying fulfillment | Uncollected, partial, failed COD, return, damaged order |
| 09 | Customer pays | Cash/bank or receivable cleared only when verified | Failed gateway, replay callback, overpayment, unpaid invoice |
| 10 | Community cash handover | Reconcile product COD separately from delivery-fee cash | Officer shortage/excess, late deposit, missing receipt |
| 11 | Supplier paid | Settle authorized AP against verified bank/cash movement | Partial payout, beneficiary change, bank rejection |
| 12 | Daily operating expense | Evidence → maker → independent checker → accrued payable | Duplicate receipt, missing proof, owner override |
| 13 | Vendor expense payment | Separate proof → independent verifier → cash/bank movement | Same transfer ID reused, payout rejected, wrong method |
| 14 | Month end | Match AR/AP, inventory, cash/bank, refunds, tax, accruals | Unposted exceptions or unresolved unknown expenses |
| 15 | Period close | Owner certifies report; period locked; corrections journalled | Unauthorized reopen or backdated hidden transaction |

## Chart of accounts / accounting classification
- Assets: Cash, bank, mobile wallet, accounts receivable, inventory, prepayments, fixed assets.
- Liabilities: Supplier AP, accrued vendor expenses, customer advances, tax payables, deferred revenue.
- Equity: Owner capital, retained earnings, owner withdrawals (NOT expense).
- Revenue: Product sales when principal; commission when agent; earned delivery fee and other earned services.
- COGS: Actual sold inventory, supplier fulfillment cost, qualifying purchase freight and purchase-adjustment credits.
- Opex: Delivery service ops, community hub operations, sales commissions, offline and online marketing, staff/office, infrastructure, depreciation, bad-debt provisions, other overhead.
- No double booking of freight between inventory landed cost and logistics opex.
- Supplier purchase rebates adjust relevant acquisition costs unless independently earned revenue by contract.
- Promotional discounts and rewards require accounting policy to avoid simultaneous expense and sales-reduction double counting.
- VAT/tax/supplier withholding must follow validated applicable local policy before final certification.

## Specific loopholes and required closures
| Risk ID | Loophole / exception | Prevention / detection | Preview foundation status |
| --- | --- | --- | --- |
| F-01 | Browser directly changes finance data | Revoked CRUD, RLS, role-guarded RPC | Implemented, DB integration pending |
| F-02 | Preview silently writes Production | Vercel preview + approved separate endpoint + hard deny production ref | Implemented |
| F-03 | Same receipt entered twice with case change | Case-normalized vendor+document unique index | Implemented |
| F-04 | Expense without original receipt | Private storage upload, immutable file, hash, review links | Implemented, real upload UAT pending |
| F-05 | Maker approves own expense | DB compares creator and reviewer | Implemented |
| F-06 | Payment submission equals verified bank payment | Independent settlement review; still needs bank statement match | Partially implemented |
| F-07 | Same expense paid twice / bank ID reused | Pending/verified unique partial indexes; rejected attempt retained | Implemented |
| F-08 | Approval retried after success | Locked expense status and unique posting event key | Implemented |
| F-09 | Unbalanced journal or stealth history edit | Deferred balance trigger, immutable line/header triggers | Implemented |
| F-10 | Posting after period locked | Locked-period rejection | Implemented; close workflow not built |
| F-11 | Purchase invoice does not match goods received | PO → goods receipt → invoice 3-way match | Pending |
| F-12 | Wrong units/carton/weight and bulk discount | Normalized SKU/unit cost and receipt validation | Pending |
| F-13 | Supplier rebate/brand support double-counted | Reconciliation to original PO/invoice and source event | Pending |
| F-14 | Own-product inventory valuation incorrect | Cost layers, returns, damage, FIFO/weighted policy | Pending |
| F-15 | Failed collection reported as revenue | Confirmed fulfillment and refund/return rules | Pending |
| F-16 | Cash handover variance silently ignored | Existing community ops exception log; finance integration | Pending |
| F-17 | Duplicate gateway callback or COD payment | External ID uniqueness; event ledger/idempotency | Pending |
| F-18 | Partial settlement cannot be represented | Payment allocation table with outstanding balance | Pending; current MVP supports full expense settlement only |
| F-19 | Shared expense allocated twice across communities | Documented allocation basis with sum-to-source constraint | Pending |
| F-20 | Marketing scan falsely counted as acquired buyer | Existing QR campaign funnel; completed-buyer attribution | Existing operational tracking; finance cost join pending |
| F-21 | Owner invests cash counted as revenue | Equity ledger with source type | Pending |
| F-22 | Large asset purchases immediately expensed | Fixed asset ledger / depreciation policies | Pending |
| F-23 | Missing tax liability improves profit | VAT/tax/withholding classification and accountant review | Pending |
| F-24 | Procurement cost quoted rather than invoiced | Verified landed cost and invoice/receipt reconciliation | Pending |
| F-25 | Supplier portal can view private margin or payout | Supplier-scoped financial authorization tests | Pending |
| F-26 | Staff sees unrelated community/customer finance | Restricted per-role & per-community finance views | Pending |
| F-27 | Expense belongs to fake community/campaign | FK community, campaign link for QR cost attribution | Community FK implemented; campaign FK pending |
| F-28 | Media upload executable/oversized | JPEG/PNG/PDF only, max 1.5MB Server Action, private storage | Implemented; content sniffing/AV pending |
| F-29 | Expense change after approval | Immutable journals; corrections require reversal & audit | Journal immutable; correction workflow pending |
| F-30 | A neat-looking chart claims verified net profit prematurely | Explicit UNAVAILABLE net profit gate; synthetic demo watermark | Implemented |

## Dashboard contract and integrity
Show distinct metrics:
- Confirmed revenue vs confirmed receipts, refunded revenue, recognized COGS, gross profit.
- Delivery revenue vs rider/hub and transport costs.
- Marketing offline vs online spend; ROI/CAC measured only against attribution-qualified **completed buyer** events.
- Accrued operating costs vs paid settlements, bank reconciliation state.
- Company / community / product profitability and confidence/completeness signal.
- Daily/weekly/monthly trends, budget variance, cash runway, supplier AP and customer AR.
- Audit log with actor/time, source document, reason, prior/new state and source journal link.
- Excel/CSV/PDF exports only after permissions/redaction tests; include period and reconciliation status.
The initial cockpit intentionally displays verified or submitted operating-expense data only, plus a separately labeled synthetic demonstration.

## Remaining build streams (release dependencies)
Phase B: Actual supplier POs, supplier bills, invoice matching, inventory cost layers, return/damage accounting.
Phase C: Fulfillment-based revenue/COGS posting, online/COD collection and refund allocations, cash and bank reconciliation.
Phase D: Campaign budgets, QR poster print batches, online media spend, referral rewards and attributed CAC/ROAS.
Phase E: Office/infrastructure capex/accrual, payroll, tax, community cost allocations and corporate consolidated P&L.
Phase F: Period close, trial balance, balance sheet, cash flow, management exceptions, history-safe corrections, document retention.
Phase G: Permission attack tests, full UI/device QA, receipt authenticity review and independent owner/accountant approval.

## Mandatory release checklist
- [ ] Branch GitHub CI: unit tests, lint, typecheck, build, dependency audit.
- [ ] Full migration reset passes in an isolated, disposable Supabase database.
- [ ] Preview Vercel READY at exact commit SHA; preview DB differs from production.
- [ ] Two distinct user roles (maker and checker) with seeded test accounts.
- [ ] Upload JPEG/PNG/PDF receipt; invalid extension, oversize, wrong community rejected.
- [ ] Expense approval and rejection; reject self-approval and duplicate invoice.
- [ ] Balanced journal posted one time; retries cannot double post.
- [ ] Settlement payment proof upload and independent verification.
- [ ] Rejected settlement can be resubmitted without erasing rejection trail.
- [ ] Existing order/receipt/return/delivery and COD workflows unaffected.
- [ ] Supplier bills, landed costs and actual COGS reconcile with units and invoices.
- [ ] Full revenue/receivable/cash/refund reconciliation complete.
- [ ] All shared costs allocate exactly once, preserving corporate consolidation.
- [ ] Dashboard product/pool/community/month totals match independent ledger query.
- [ ] Bank settlement and month-close controls tested with exception scenarios.
- [ ] Security Gate signoff + owner review of real-world operating flow.
- [ ] Finance owner explicitly authorizes merge to main and Production migration.

**Release decision:** BLOCKED until all financial lifecycle streams and UAT gates above are complete. No synthetic UAT record should be mistaken for real business performance.
