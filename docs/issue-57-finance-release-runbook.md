# Issue #57 — controlled UAT and one bulk release

## Qualification and shared database preparation

1. Record `git rev-parse HEAD` and keep every implementation/fix in PR #58's existing branch. Require application tests, typecheck, lint, production build/audit, from-zero migrations/pgTAP, complete supply/customer SQL lifecycle, independent browser UAT, real concurrency and isolated restore jobs to pass at that head.
2. Confirm the existing Vercel project ID and exact head-bound READY Preview deployment. Inspect branch-scoped configuration without printing credentials. Do not create a replacement project or change settings for Production or the concurrently active storefront branch.
3. For real operational data, verify an actual recoverable backup of the shared hosted schema/data and a separate backup of private original file bytes. On 2026-10-12 the owner explicitly confirmed all current hosted data are dummy and waived the hosted database-backup prerequisite for this qualification. Retain isolated restore testing and already verified original-file byte retention; this waiver does not authorize discarding audit records or apply to future real customer data. PostgreSQL `storage.objects` metadata alone does not back up files. Record restore ownership, RLS/grants, migration versions and previous Production deployment. Disposable test restoration is additional evidence, not a substitute.
4. Capture existing hosted journal/audit/source counts and independent bank/cash balances. Apply the reviewed candidate migrations in dependency order, in an atomic UAT schema preparation transaction where practical. Reconcile hosted migration-history entries with the exact repository filenames; never blindly replay already-installed DDL. Do not backfill historical revenue/COGS or alter old audit rows.
5. Verify the database gate rejects direct authenticated financial RPC writes without an operator lease, even for finance roles, and cannot be unlocked with JWT user metadata. Recheck fixed definer search paths, public/anonymous privileges, RLS, protected evidence and unchanged ordinary customer operations. Root/no-JWT maintenance access is an operator trust boundary, never an application credential.

## Hosted recovery and the current dummy-data exception

The 2026-10-12 owner instruction to proceed without a hosted database backup supersedes that prerequisite for the current dummy dataset. Do not request the database password or reset it for a backup that the owner waived. The following recovery procedure remains applicable before handling real operational financial data.

The authenticated scheduled-backups page for `sukabonfjcnaavjgjyuy` explicitly reports that the Free plan does not include project backups. Do not treat a disposable restore as a live restore point. Use an operator-managed connection configured securely outside chat to produce a private manual PostgreSQL schema/data/roles backup, then restore it into an isolated destination and verify original audit and financial fingerprints, ownership, RLS/grants and migration versions. Back up private object bytes separately and verify restored hashes and denied unauthorized downloads. Never put database credentials, password hashes or backup contents in git/PR/CI logs. Choosing a paid plan is an owner action; no upgrade is authorized by this implementation task. Do not restore over the operating Production database for a qualification test.

## Temporary reviewer lifecycle

- Provision two distinct synthetic reviewer identities through supported Supabase Auth administration, with normal authentication; one maker and one independent Super Admin checker. Do not change an existing customer's/staff member's password. Keep credentials out of PRs, reports, logs and chat. Do not invent phone numbers or send SMS.
- Operator-only `private.finance_uat_leases` stores actor, expiry and reason; leases last at most eight hours. Lease only temporary accounts, because financial parent scope is checked against leased origins. Explicitly register synthetic `order`, `group_commitment` and `ops_day` source IDs in `private.finance_uat_entities`. Never register real customer sources.
- Scope `FINANCE_UAT_LOGIN_ENABLED=true`, `FINANCE_WRITES_ENABLED=true`, `FINANCE_PREVIEW_SUPABASE_URL=<approved endpoint>` and, for the shared project, `FINANCE_SHARED_DB_UAT_ENABLED=true` to the **finance branch Preview only**. Normal Production settings remain locked. The reviewer form is `/finance-uat/login`; it validates password, finance role and current lease. It is unavailable in Production and with mismatched endpoints.
- Run maker and checker in distinct browser sessions. Browser-assisted existing-user credential entry must use secure authentication controls; never paste secrets into chat or inject hosted session cookies. The no-OTP storefront demonstration is not an authenticated financial reviewer.
- Revoke leases after UAT, then withdraw every temporary elevated role through independently authorized role management and revoke Auth sessions. Lease revocation protects writes; it does not by itself withdraw role-based report/original access. Check an existing token/browser session cannot mutate finances or read reports/originals after role withdrawal. Preserve the reviewer identity and existing audit/journal records; append the role-revocation audit. Never remove an existing operator's roles or the last Super Admin. Reset branch Preview enablement flags to locked after the supervised test window.

## Mandatory hosted walkthrough

Use only registered synthetic sources and capture original-file hashes, object IDs, journal IDs and reviewer audit evidence. Cover invoice/receipt/PDF print and original downloads, rejected alteration/overwrite, duplicate uploads, immutable reasoned void/archive, supplier partial payment/return/credit/recovery, every customer model's fulfilment and cost lot, COD custody, delivery revenue/cost, AR collection, partial return/refund, advances/cancellations, budget/expense attribution, source reporting and ended-period close. Confirm maker self-review, cross-role ledger/original access, excess payment/return, stale snapshot/replay and expired/revoked authorization fail closed. Verify mobile/tablet/desktop forms and relevant upload/validation error paths.

Match independent source totals to journal debit/credit, AP, AR, refund payable, supplier receivable, physical cash/bank, inventory cost/quantity and unallocated COD/advances. Document unmatched external statements and actual follow-up. Do not certify after-tax profit without the authorized tax/VAT policy and verified complete sources. Manual documents remain explicitly manual evidence.

## Release and rollback

- Keep PR #58 draft until the final exact SHA, hosted browser/security/accounting evidence, applicable recovery evidence (with the current owner-approved dummy-data backup exception recorded), immutable original retention and rollback deployment all satisfy mandatory gates. The user's merge authorization is conditional on completing these gates.
- Prepare one final PR description/report listing exact SHA, deployment ID/URL, workflow jobs, completed/failed tests, accounting totals, security findings and remaining limitations. Any mandatory blocker means **HOLD**, with the affected feature, evidence and resolution; do not merge to satisfy a request by hiding gaps.
- Once qualified, merge the existing PR once. Production financial-write enablement remains a separate gated change; the current default-deny lease system does not provide a broad Production unlock switch. Do not grant permanent leases or register real source IDs as UAT to simulate Production authorization.
- Before Production promotion, record the previous verified Production deployment and confirm backward compatibility. If application verification fails, restore that deployment while retaining database default-deny restrictions. Preserve posted financial/audit/original data. Restore a database only through the tested recovery procedure and an incident-specific plan; never drop candidate tables or delete journals as an improvised rollback.

## Retention and recovery

Retain original bytes and hashes, lifecycle events, source snapshots, posted journals/lines, stock movements, approvals, operator lease/source audit and statement evidence. No automatic destructive retention task is added by this candidate. The owner must supply the applicable retention schedule before any purge; archive is the reversible operational action. Unlinked failed uploads remain private and require a documented review before cleanup. Back up private storage bytes separately from database metadata, verify exact byte hashes after restore and recheck unauthorized downloads. Store backup material privately; synthetic CI backups stay in temporary directories and are not uploaded as artifacts.

## Hosted preparation evidence — 2026-10-12

Candidate controls were applied to the existing project through named migrations. The connector assigns hosted timestamps, so match source filenames by migration name rather than replaying their timestamps. Supplier partial-payment request and review definitions were installed separately; the legacy `treasury_one_supplier_bill_payment` index remains because its removal repeatedly returned `INVALID_ARGUMENT: Invalid or expired requestState`. Resolve that index removal through a reviewed, authorized connector fallback before partial-payment acceptance. Never classify this incomplete migration as a passed hosted test.

Live checks passed: all 29 financial tables have RLS and the common write-lock trigger; direct authenticated Super Admin financial RPC writes without a lease fail; forged caller metadata cannot unlock writes; unleased reviewer sessions fail closed; no direct anon/authenticated financial DML grants, anonymous financial RPC grants or unfixed financial definer search paths. No operator leases or synthetic source registrations have been issued. The original two journals and 346 audit events retain their full-row fingerprints, and all five original evidence objects remain. Hosted independent browser/accounting UAT is still required; PR #58 remains draft and Production financial writes remain disabled.
# Password sign-in follow-up — 2026-10-12

Owner deferred paid SMS OTP integration to the first week of November 2026.
Existing verified mobile accounts may use Supabase password authentication;
no fixed test OTP expiry is extended, phone ownership is not auto-confirmed,
and no identity, credential, or permanent role is changed by the application.
The normal login defaults to mobile/password. Existing OTP code remains available
at `/login?method=otp`; new customer registration still requires phone verification.
Preview finance reviewers may use email/password or verified mobile/password,
with the same database-backed independent role and expiring UAT lease checks.
Passwords are never trimmed, logged, committed, or included in redirect URLs.
New branch changes require new exact-SHA CI, READY Preview, and hosted UAT;
the prior SHA64 qualification cannot certify this follow-up. Production remains HOLD.
November reminder creation failed because all five automation slots are occupied.
