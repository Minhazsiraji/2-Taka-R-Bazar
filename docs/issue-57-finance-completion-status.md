# Issue #57 — integrated finance candidate and release gates

Date: 11 October 2026. Branch: `feat/finance-complete-release-uat-20261011`.
Tracking: https://github.com/Minhazsiraji/2-Taka-R-Bazar/issues/57
Draft PR: https://github.com/Minhazsiraji/2-Taka-R-Bazar/pull/58

**Production decision: HOLD. Merge is authorized only after every mandatory gate passes.** This document supersedes the earlier 194-application / 141-SQL checkpoint. Implementation has advanced across all eight packages; hosted qualification and release preparation must still be completed. No application-test count alone qualifies the release.

## Candidate implementation

| Package | Implemented behavior | Qualification still required |
| --- | --- | --- |
| Documents | Immutable original attachments and SHA-256 verification; authenticated original download, printable registers and direct PDF; separate maker/checker void/archive events retain original files and accounting; duplicate detection; manual original invoice, receipt, statement and credit-note uploads | Hosted original-byte, lifecycle and failure-path UAT; approved original-file retention and recovery evidence |
| Maker-checker | Separate authenticated maker/checker roles; self-review rejection; time-limited operator-issued leases, revocation and fixture-only parent restrictions; Preview-only reviewer password sign-in without phone numbers or SMS | Supervised hosted sign-in and reviewer lifecycle on the exact Preview; leases only for temporary identities |
| Procurement | Selected quote/PO price locks, independent accepted-goods matching, immutable invoice posting, partial payment reservations, supplier inventory returns/credit notes, partial recovery of credits from already-paid invoices, original evidence links | Hosted supplier/payment/credit scenario and original statement reconciliation |
| Customer lifecycle | Actual fulfilled source snapshots for Pools, Group Deals and Direct Products; exact source-line invoice-lot allocation; separate product revenue, delivery fees and actual delivery cost; AR, COD custody allocation, collections, partial credits, physical restock and refund payable/cash; unearned deposits, cancellation refunds and prepaid fulfilment | Hosted all-model walkthrough and source-to-ledger reconciliation; legacy fulfilled Group Deals with missing snapshots remain explicit blockers |
| Expenses/marketing | Existing categories and accruals; exact amount-to-source allocation by cost center/community/pool/product/staff; independent campaign-budget approval and reserved spend; commission staff validation; real QR campaign conversion reporting | Hosted attribution, budget and approval UAT; external campaign effectiveness is not inferred from spend |
| Treasury | Physical bank/cash movements, capital, loans/principal/interest/fees, cards and restricted balances; supplier/customer cash and original statement evidence; exact statement matching; unallocated COD/deposits; existing explicitly provisional forecasts | Hosted bank/cash reconciliation and source completeness review; no automatic bank transfer or gateway settlement |
| Reporting/close | Posted-ledger product revenue, fees, COGS and expense reconciliation; company/model/community/pool/product reports; cash bridge, source AP/AR/refunds/supplier receivables, stock valuation and trial balance; allocation/bank/source blockers; independent ended-period close with ledger fingerprint and month lock; paginated immutable audit export | Hosted close and audit export; tax/VAT policy and external statement/physical cash signoff remain separate obligations |
| Security/resilience/release | Database default-deny financial triggers, fixed definer search paths, RLS and explicit grants; fixture-only scopes, cross-role/storage attacks and lease revocation; actual concurrent cash/AP/return/close sessions; isolated PostgreSQL and original-byte restore harnesses | All current-SHA CI jobs, hosted security UAT, verified live backup/restore plan, rollback deployment and final release decision |

The database gate does not trust application flags or caller-editable JWT metadata. API callers need an active operator-issued lease, and linked financial parents/source registrations must be synthetic. Existing customer ordering and fulfilment tables are not globally write-locked. Production financial Server Actions remain fail-closed outside an explicitly approved Preview.

## Verification evidence

Evidence must identify the exact commit. Do not attribute a previous run to a later head.

Implementation candidate: `e40aece3132378f0a67d6bd551132e24bd975978`. All three workflows completed successfully at this exact SHA:

| Check | Result | GitHub evidence |
| --- | --- | --- |
| Application tests | 203 passed; zero failures | Step 1 CI run 38154072208, job 114513298427 |
| Security/build/static checks | Production dependency audit: zero vulnerabilities; typecheck, lint and production build passed (lint warnings remain) | Same verify job |
| From-zero migrations and SQL | 10 pgTAP suites, 199 assertions passed | Job 114513298329 |
| Integrated SQL lifecycle | Supply handover; Finance/Treasury/Procurement/COD; all buying-model revenue/COGS/credits/refunds; source report reconciliation; supplier partial credit recovery; customer advances/fulfilment/cancellation refunds passed | Same migrations job |
| Independent browser UAT | 27 stages; desktop/tablet/mobile 1440/768/360; normal password form sign-in without SMS; separate maker/checker; forged original rejected before posting; lifecycle, collections/refunds, budget, close, cross-role/RPC/storage attacks and revoked lease passed | Run 38154072210, job 114513298391 |
| Real concurrent sessions | Cash spend, replay, supplier AP reservation, remaining-unit return and period-close/posting: five passed | Run 38154072220, job 114513298222 |
| Full isolated database restore | Exact financial/audit/document/Auth fingerprint; RLS and financial grants retained; fresh isolated PostgreSQL server without network passed | Same resilience job |
| Original-file recovery | Exact byte/hash restoration and private/unauthorized access checks passed | Browser job 114513298391 |

Earlier restore harness and browser assertion failures were fixed and rerun; they are not counted as passes. Disposable database restore covers database metadata. Original file bytes are separately restored in the storage check. These are synthetic isolated tests, not hosted backup certification or a hosted finance walkthrough. Report commit `58e3f3d9a1c341e520a64b0484e58e978af8629c` also passed all three workflows: Step 1 CI 38155020484, browser 38155020536, resilience 38155020473. Its READY Preview is https://2-taka-r-bazar-j50hirp76-minhazs-projects-d28f7aed.vercel.app (`dpl_8WvneDNKrmvpcUmr4S9dkrfzx9iE`). Subsequent report updates require their own CI qualification.

## Independent accounting validation

The disposable fixture checks exact source-derived values rather than changing cost or price to obtain a target profit. After all three buying models, supplier returns, collections, COD allocations and customer credits/refunds:

| Measure | Exact synthetic BDT |
| --- | ---: |
| Product revenue after credits | 1,970 |
| Earned delivery fees | 50 |
| Inventory COGS after returned stock | 1,900 |
| Actual delivery expenses | 27 |
| Profit before tax | 93 |
| Remaining inventory | 8,750 |
| Supplier/delivery expense payable | 4,027 |
| Customer AR / customer refund payable | 0 / 0 |
| Unallocated COD custody | 40 |
| Supplier return receivable before recovery | 950 |
| Supplier return receivable after 400 + 550 actual recovery | 0 |
| Physical bank after supplier credit recovery | 93,380 |
| Physical cash | 2,030 |

Customer advances, cancelled orders/Group Deals and a prepaid sale followed by a full return/refund end with the same bank and profit totals. Deposits remain liability 2200 until applied or refunded; supplier recovery reduces receivable 1300. Neither becomes additional revenue. Internal transfers and loan principal remain outside profit. Deferred journal balance constraints are explicitly forced before transaction completion.

Reports retain `profit_after_tax = null`: no tax rate, VAT amount or certified statutory net profit is invented. A close request rejects missing source posting, incomplete expense allocation, mismatched inventory/AP, pending financial approvals or unmatched bank evidence. Closing does not execute real payments.

## Hosted state and remaining blockers

Read-only check on `sukabonfjcnaavjgjyuy` found **two existing journals**, no installed `private.finance_uat_leases`, and no installed `finance_customer_events`. Therefore the candidate database security gate is implemented/tested in the branch, **not yet installed on the shared hosted database**. Existing role-protected RPCs there still lack this new common database gate. Do not claim the live system is protected by uninstalled code.

The existing Vercel project is accessible: `prj_lADdm8GGkXmEYiowqbo4QnAzlwtC`, `2-taka-r-bazar`. Omitting optional team selectors resolves the erroneous connector 404. No replacement project was created. Verified implementation candidate `e40aece3132378f0a67d6bd551132e24bd975978` has READY deployment `dpl_DLEKGW9ZVZSw7h2yXoaC8NtfjMUP` at https://2-taka-r-bazar-64phfy41f-minhazs-projects-d28f7aed.vercel.app. Its homepage loads in the browser; this is not authenticated hosted finance UAT. Production rollback evidence is READY deployment `dpl_iYF4sHWTzfsKvNyvB7DigA1gP2BS`, main SHA `e74b798b60c4fa779876998ad96ccac5c300d20a`, target Production and marked rollback candidate. No alias or Production environment was changed.

Supabase dashboard authentication is now positively verified after secure user takeover. The actual project backup page shows **Free Plan does not include project backups**. Consequently there is no verified managed restore point. The earlier selected Google-provider connection failure is resolved and is no longer the access blocker. The connected plugin exposes neither backup download nor Auth identity provisioning. A recoverable manual database export plus separate private original-byte backup must be securely prepared and restore-verified before hosted schema preparation; alternatively the owner may choose a paid managed-backup plan. No plan upgrade, subscription charge, replacement project or live database restore was performed.

| Blocker | Evidence | Resolution |
| --- | --- | --- |
| Final report commit qualification | Implementation and report SHA 58e3f3d both passed every isolated workflow; subsequent report update needs its own checks | Record exact final head and completed CI/deployment evidence |
| Hosted candidate schema/gate | Candidate objects absent; live two-journal baseline retained | Verify recoverable hosted backup, apply the reviewed candidate schema atomically for authorized UAT, verify baseline/customer operations and default-deny gate |
| Hosted independent identities | Ordinary application sign-in requires mobile OTP; no usable maker/checker sessions established | Use the new scoped Preview reviewer form with two operator-issued temporary accounts and expiring leases; secure credential handling, no unnecessary phones/SMS |
| Hosted Preview settings | Candidate financial writes/sign-in require explicit approved branch settings | Set only the finance branch Preview flags after schema and role/fixture restrictions pass; leave Production and the other active storefront branch unchanged |
| Live recovery/release evidence | Authenticated backup dashboard explicitly reports Free Plan has no project backups; no recoverable manual hosted DB/original backup verified | Verify actual hosted backup availability, recovery procedure and previous Production deployment before release |
| Final release | Hosted mandatory UAT/signoff incomplete | Keep PR draft and Production financial writes locked; qualify then merge once as authorized |

## Security findings and limitations

Current hosted security advisors (11 October 2026) report 33 RLS-without-policy informational notices, two anonymous QR definer warnings, 128 authenticated definer warnings, and leaked password protection disabled. [Password protection remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No blanket permissive policy or live credential setting was changed. The earlier hosted catalog checks found RLS on every finance/procurement/treasury table, no direct anon/authenticated financial DML grants, no anonymous financial RPC grants, and fixed empty search paths on public financial definer functions. Advisors also reported RPC-only RLS-without-policy notices, public QR definer warnings, application-wide authenticated definer notices and leaked-password-protection configuration. These require scoped assessment, not blanket permissive policies or a claim that all notices are exploits.

Original-byte checks detect alteration relative to the captured upload hash. Manual bank/provider files and internal printable documents do not prove independent external bank authenticity. Forecast completeness remains explicit and provisional; unknown maturity/source dates are not fabricated. Legacy source records are not silently backfilled with inferred fulfilment price/date or cost.

Original attachments, posted journals, inventory movements, customer source snapshots and financial audit history are retained. Voiding/archiving changes document lifecycle only and never deletes source evidence or reverses money; use independently reviewed credit/refund events for accounting corrections. Revoke temporary leases/sessions after UAT; preserve identities referenced by audit and finance rows. Do not delete old hosted audit records or fixtures to manufacture clean totals.

Automatic approval review rejected a protected Vercel share-link request because it could expose the Preview to an unspecified audience. No bypass link was created or used; direct access to the verified candidate subsequently worked. Earlier local Supabase initialization was rejected for unsolicited telemetry and was not retried through an indirect workaround. Repository CI uses the already configured disposable database workflow.

See `docs/issue-57-finance-release-runbook.md` for the remaining bulk-release sequence. This candidate has not merged, changed a Production alias, enabled Production financial writes, executed a real bank payment or mutated a real customer order.
