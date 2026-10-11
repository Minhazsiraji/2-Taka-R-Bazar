# 2TBR profit-to-cash read-only release gate — 2026-10-09

**Scope:** Existing Finance + Treasury + Procurement branch `feat/finance-treasury-integrated-20261009`, draft PR #55. **Not Production-certified and not authorized for merge without owner confirmation.**

## New product

- Owner-only `/super-admin/profit-breakdown` for month, community, pool and product filtering. Displays benchmark customer savings separately from revenue and margin; matches actual sold units to approved posted supplier invoices and shows supplier invoice sources.
- Full-company gross/operating/financing/tax flow is computed in integer BDT cents, with negative margins/losses supported. Delivery fee revenue is not savings. Direct delivery cost is separated from overhead; vendor settlement is not counted twice.
- The product returns `certifiedNetProfit: null` for all cases until an authorized closing workflow proves completed sales journals, approved COGS, returns/refunds, collection-to-COD/bank suspense, company overhead allocation, approved tax policy, VAT, and locked financial periods.
- Pool, community and SKU scope do **not** apportion shared expenses or produce a fake net profit. Where procurement invoice coverage is less than sold units, COGS/profit are unavailable.
- Dedicated `/super-admin/cash-bridge` reconciles opening physical cash + external inflows − external outflows to closing cash. Internal bank transfers excluded from external movement, loans principal excluded from profit, credit cards excluded from cash, COD and delivery fee receipts separated and explicitly not automatically classified as earned revenue.
- RPCs `finance_profit_source(date,uuid,uuid)` and `treasury_cash_bridge_source(date)` are **read-only**, `SECURITY DEFINER`, authenticated **Super Admin only**, with blank `search_path` and exact execute grants; no raw customer PII.
- All demo records are immutable hard-coded synthetic fixtures; no fixture writes to hosted Supabase or Production. Hosted Preview financial write lock stays on.

## Representative synthetic scenario (AMT-01 October)

| Meaning | Calculation | Demo amount |
| --- | --- | ---: |
| Ordered cooking oil, 5 L | 100 × 950 | ৳95,000 purchase commitment (not P&L) |
| Supplier received/invoiced | 95 × 950 | ৳90,250 verified cost |
| Invoice already settled | 70 × 950 | ৳66,500 bank payment (not COGS twice) |
| Supplier payable still open | 25 × 950 | ৳23,750 |
| Hypothetically completed order sales | 95 × 950 | ৳90,250 product revenue |
| Benchmark customer saving | 95 × (1,000 − 950) | ৳4,750 **customer** saving |
| Hypothetical product COGS | 95 × 950 | ৳90,250 |
| Gross product profit | product sale less cost | ৳0 |
| Delivery fee revenue | synthetic fulfilled deliveries | ৳400 |
| Actual delivery cost | carved out of already displayed ৳880 logistics | ৳300 |
| Other operating accrual expenses | 1,200 marketing + 580 other logistics + 700 IT | ৳2,480 |
| Interest and financing fee | principal repayment excluded | ৳600 |
| Profit before tax | 0 + 400 − 300 − 2,480 − 600 | **−৳2,980** |
| Illustrative tax on profit | 15% **demo assumption only**, taxable surplus is zero | ৳0 |
| After-tax *illustrative* result | −2,980 − 0 | **−৳2,980** (never certified net profit) |

The 95 hypothetical completed sales are **illustrative** and are NOT proof that 95 actual customer orders completed or reconciled. A real margin improvement requires a legitimately lower approved supplier invoice (e.g., negotiated cost), **not** changing cost in a management report.

### Synthetic book cash bridge

Opening cash ৳255,140 + product COD cash ৳16,000 + delivery cash ৳360 − supplier settlement ৳66,500 − operating payment ৳1,200 − loan principal ৳10,000 − interest/fees ৳600 = closing physical book cash **৳193,200**. Internal own-account transfer ৳10,000 affects neither external cash flow nor total company cash. Arithmetic difference **৳0**; external bank certification **not complete** (two unmatched synthetic statements).

## Source integrity / release blockers

1. Profit source recognizes completed orders using `orders.completed_at`, not commitments or supplier quote prices. Supplier COGS uses independently posted invoices and accepted goods coverage. Own-product lanes or missing invoices block cost certification.
2. Actual sales and COGS are still **not journal-posted** to accounts 4000/4010/5000 through a reviewed close. No UI is permitted to claim finalized company Net Profit from this read model.
3. Payment status alone cannot prove COD or bank receipt; suspense 2210/2211 must be independently reconciled to delivery/order-level recognized revenue, including refunds/returns and prepaid gateways.
4. For a month, expenses are accrued once. Payment outflows (including supplier invoice settlement) are not added to incurred costs a second time; scoped allocated overhead and delivery revenue must be verified.
5. Bangladesh tax/VAT rates and applicable tax base are **not derived from a hypothetical flat 15%**; authorized finance signoff and real taxable profit adjustments remain required.
6. Cash bridge is financial-book arithmetic only until independent external bank statements and physical cash handover close; unclassified cash is shown separately, never forced into profit.
7. Security Gate, real independent maker/checker browser UAT, audited forecast coverage, refunds, inventory lot costing, community COD/order matching and IAS 7 presentation remain pre-Production release gates. Existing Production Supabase has not received these migrations.
8. These features can pass **code/preview merge review** without certifying financial statements. Do not change Production aliases, Supabase Production schema or merchant gateways via this branch without explicit owner permission.

## Automated verification targets

- Domain tests: deterministic pure calculation for 95-unit case, customer saving vs platform margin, negative profits, narrowed scopes, incomplete invoices, returns, unclassified cash, loan principal separation.
- PostgreSQL pgTAP: 14 new isolated read-model tests for Super Admin authorization, invalid month rejection, empty period, physical ledger opening, exact book cash movement; all wrapped in ROLLBACK.
- Existing Finance/Treasury database assertions and combined procurement/COD UAT must remain green.
- Playwright in GitHub Actions against disposable local Supabase, desktop/tablet/mobile 1440/768/360, including screenshot/artifact, new breakdown/bridge pages and legacy transaction posting.
- Vercel Preview must be READY at the exact tested head commit; no claim of isolated Vercel Preview DB (hosted demo remains write-locked).

## Scope of proposed merge

The new **read-only reporting routes, arithmetic and authorized source RPCs** are suitable for developer review after CI passes. The existing combined PR still contains other finance/procurement integrations with independent final Production certification obligations. Never mark the entire financial accounting system certified just because this reporting portion is test-green.
