# Issue #57 — Finance completion qualification

Date: 11 October 2026. Branch: `feat/finance-complete-release-uat-20261011`.
Tracking: https://github.com/Minhazsiraji/2-Taka-R-Bazar/issues/57
Draft PR: https://github.com/Minhazsiraji/2-Taka-R-Bazar/pull/58

**Decision: BLOCKED. This is a qualification checkpoint, not a completed integrated finance implementation or a Production release.** All eight work packages remain open until their remaining requirements are implemented and tested. No main merge, Production alias change, hosted schema migration, financial-write enablement, real payment or customer-order mutation was performed in this lane.

## Changes in this candidate

- Added the completion branch to application/database and browser workflow triggers. Browser qualification also runs for its draft pull request.
- Prepared a read-only reporting migration: monthly operating expense trends include posted physical Treasury expense settlements, matching the central Finance report. The old trend returned zero for a Treasury-paid expense while the central report returned the correct amount.
- Updated three legacy settlement suites to use an actual Treasury account and independent reviewer; explicitly retained a test rejecting the generic settlement route once physical Treasury exists.
- Made shared-database cash assertions compare exact fixture movements against captured starting balances. Existing dummy accounts are not erased to manufacture an empty baseline.
- Made cash-bridge opening checks reconcile to an independent physical-account ledger query and retained empty-community and uncertified-profit assertions.
- Added disposable local Supabase configuration, with no hosted project credentials. Synthetic fixtures use independent accounts and do not request SMS OTP.

## Verified results

| Check | Result | Scope and evidence |
| --- | --- | --- |
| Application suite | PASS: 194/194 | `npm test`; no skipped tests |
| Typecheck | PASS | `npm run typecheck` |
| Lint | PASS with warnings | Existing accessibility/react warnings; no lint errors |
| Next production build | PASS | Placeholder database configuration; no hosted database access |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high`: zero vulnerabilities |
| Finance foundation SQL | PASS: 16/16 | Independent approval, expense posting, Treasury settlement, generic-route rejection |
| Finance negative SQL | PASS: 38/38 | Unauthorized customer, duplicate invoice/hash/reference, failed approvals, immutability and retries |
| Category/period-lock SQL | PASS: 20/20 | Seven expense categories, BDT 3,108 accrual, BDT 111 settlement, corrected trend, period lock |
| Treasury SQL | PASS: 53/53 | Transfer, capital, loans/principal/interest/fees, card liability, liquidity, statement matching and duplicates |
| Profit/cash-bridge SQL | PASS: 14/14 | Restricted diagnostics, independent cash reconciliation, no invented certification or tax rate |
| Hosted SQL total | PASS: 141/141 | Five suites on the authorized shared dummy DB; every transaction ends ROLLBACK |
| Initial branch CI | PASS | Commit `7c6f22a250854ac21527a00ce520e0ac88c3fb82`; Actions run `38119251464`, application job and disposable migration/supply E2E job all passed |
| Public browser smoke | PASS, limited | Homepage and FAQ at `https://2takarbazar.com/faq`; free pickup and BDT 20/30 optional delivery visible. This does not establish authenticated ordering or finance UAT |
| Hosted supply E2E through MCP | UNVERIFIED | API returned `Invalid or expired requestState`; do not count this attempt as a pass. Separate disposable supply E2E passed in the initial CI run |
| Hosted authorized finance browser UAT | BLOCKED | No authenticated maker/checker browser session or verified accessible candidate deployment |

SQL tests that exercised the candidate reporting function applied its definition **inside their rolled-back transaction**. The reporting migration was not installed on the shared hosted database. Final CI must be assessed at the candidate SHA; initial CI results must not be attributed to later commits.

## Accounting validation

- Shared baseline and post-test checks: two existing journals, zero unbalanced journals, zero retained suite fixture users.
- Synthetic openings, expense accruals and settlements balance debit and credit exactly.
- Internal bank transfers preserve company-wide cash and do not become revenue or expense.
- Owner capital/drawings, loan principal and card repayments remain financing/equity/liability movements. Financing interest and fees are separate.
- Supplier goods and COD suspense remain distinct from earned revenue and actual COGS. Synthetic statement matching proves internal matching behavior, not external bank authenticity.
- Revenue, inventory-lot cost, refunds, tax, overhead allocation and final company net profit are **not certified** by these tests.

## Security findings

Read-only catalog checks on the shared project found zero finance/procurement/treasury tables without RLS, zero direct INSERT/UPDATE/DELETE grants for anon/authenticated on those tables, zero anonymous finance RPC execute grants, and zero public finance SECURITY DEFINER functions without a fixed empty search path.

Supabase advisors returned 33 RLS-without-policy informational findings (including RPC-only tables), two anonymous SECURITY DEFINER warnings for public QR functions, 128 authenticated SECURITY DEFINER warnings across the application, and a leaked-password-protection warning. These are review findings, not proof that every function is exploitable. Individual RPC authorization, storage access and cross-role browser verification are still required; do not replace deny-by-default tables with permissive policies simply to remove informational findings. Password-protection configuration requires assessment against the mobile OTP design.

Production application financial actions still fail closed outside an approved Preview. Database RPC safety and release authorization must be assessed separately; an application environment guard alone is not a complete database-write release gate.

Automatic approval review rejected the local Supabase initialization invocation because it attempted unsolicited telemetry to PostHog. No retry or indirect workaround for that rejected command was performed. Connected SQL verification and already configured repository CI were used for unaffected work.

## Work-package blockers and resolution

| Issue #57 package | Evidence / remaining gap | Required resolution |
| --- | --- | --- |
| Evidence/documents | Existing printable PDF and attachments cover a foundation; authenticated original-byte/hash UAT, void/archive, retention and source-linked credit-note lifecycle are not qualified | Implement reasoned immutable void/archive and credit-note/document lifecycle; test upload failure, original bytes, cross-user access and audit history |
| Maker-checker | SQL role checks pass; hosted browser reviewer lifecycle and two genuine sessions are unverified | Establish two temporary authorized test identities with expiry/revocation; verify sessions and independent browser approvals without unnecessary SMS |
| Procurement | `treasury_one_supplier_bill_payment` permits one active full-bill settlement; supplier returns/credits and independent vendor statement lifecycle remain absent | Implement partial allocation with bill/account locks and overpayment prevention, credit notes/returns and statement reconciliation; run race and retry tests |
| Customer lifecycle | Profit source deliberately reports unposted/uncertified sales; invoice-average cost is not an allocated inventory cost layer | Implement actual fulfilment-linked revenue/COGS, inventory valuation and return/refund events for Pools, Group Deals and own-brand/direct products; reconcile COD and earned delivery separately |
| Expenses/marketing | Categories and accruals pass; campaign codes alone do not provide a complete budget/allocation model | Add validated campaign/cost-center attribution, budgets, commissions and exact sum-to-source allocations; validate against completed-buyer attribution |
| Treasury | Core treasury assertions pass; forecasts/manual statements do not provide verified external source evidence | Add supported bank/provider provenance, unallocated-cash handling and operational forecast source links; retain provisional bank/cash-flow labels |
| Reporting/close | Trend bug fixed in candidate; final net profit, allocation completeness, controlled close and audit exports remain unqualified | Complete source event reconciliation, AP/AR/stock/close controls and authorized exports, then compare independent ledger totals by all required dimensions |
| Security/release | Full role browser, concurrency, backup/restore and retention qualification remains missing | Execute authenticated cross-user/storage attacks, concurrent posting/race suites, tested restore and retention procedures; record signoff at the final commit |

## Environment blockers

The Vercel connector lists four projects in team `team_t9Rz1iIa8Pyb5bZJqUIIoY2x`, none named 2TBR. Direct lookup of `2-taka-r-bazar` and the deployment referenced by GitHub status both returned HTTP 404. GitHub reported a successful Vercel status with inspector URL `https://vercel.com/minhazs-projects-d28f7aed/2-taka-r-bazar/DnN29g8p4fMS6L6ZM5iQRbSRAyN1`, but this does not provide a verified candidate deployment hostname, SHA binding or environment configuration.

Resolution: restore connector access to the existing 2TBR Vercel project and inspect the exact candidate deployment and branch-scoped Preview environment. Do not create a replacement project, change Production credentials or broaden financial permissions to work around the access gap. No preview URL is claimed until it is retrieved and verified.

## Release and rollback preparation

Keep PR #58 draft and Issue #57 open. Complete the blockers above, qualify one exact candidate SHA with all required automation and hosted browser tests, attach evidence and deployment URL, verify backups, then stage one bulk release. Production financial-write enablement requires the separate financial release signoff.

Current rollback is trivial: no Production change has been made. Reject or revert the candidate commits on this feature branch; no hosted data rollback is needed because fixtures and candidate SQL changes were transactionally rolled back. Any later deployment must document a verified previous Production deployment and a backward-compatible migration rollback plan before promotion.
