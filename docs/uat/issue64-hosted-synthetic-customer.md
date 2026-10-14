# Issue 64: controlled hosted customer qualification

A normal password login is insufficient for customer checkout when the account
has no verified phone or completed household profile. Paid SMS is not authorized.
The owner has already confirmed Preview login, Account, empty Orders and the
disabled Cart screen. These do not qualify a purchase.

The new synthetic customer fixture is operator-issued, private, audited and
expires within eight hours. It also requires an unexpired test-sign-in lease,
a confirmed `@example.invalid` Auth email with no phone, active community, normal
Supabase session and the existing Preview proof. It does not change Auth,
profiles, roles, verified households, GPS verification or Finance leases.

Its offer allowlist permits only independently approved synthetic SOLO offers
in the fixture's community. Quote and final checkout both check that allowlist.
Normal stock, prices, policy consent, promotion limits, atomic reservations and
idempotency still apply. Ordinary customer onboarding and Pool/Group commitment
checks are unchanged. The checkout screen labels this as a synthetic test and
cannot save an address as a verified customer profile. No real payment occurs.

Operator sequence after this exact change passes all CI gates:

1. Preserve before/after Auth and genuine-account/profile/role fingerprints.
2. Stage this migration; create a synthetic community, pickup, SKU/cost/stock.
3. Use separate actor IDs and the normal offer request/review RPCs. No self-review.
4. Issue finite sign-in and customer fixtures for the existing email QA account;
   allow only the reviewed SOLO offer. No phone claims or financial grants.
5. Put a fresh random proof only in the integration branch's Preview environment
   and its hash in private configuration. Never put it in public reports or URLs.
6. Owner uses the normal password login and completes a synthetic pickup order;
   independently check quote, order, unpaid COD and reserved inventory in the DB.
7. Continue physical evidence, custody, independent Finance posting and returns
   qualification with separately authorized staff identities and finite leases.
8. Remove fixture/proof/branch configuration when the test window closes. Preserve
   order/audit/evidence history and restore only explicitly staged fixture data.

This fixture qualifies a supervised synthetic SOLO purchase only. It cannot
certify production phone onboarding, Group GPS, five distinct households, or the
remaining staff/Finance hosted tests. Merge remains held until required hosted
qualification is complete. Production purchases stay disabled.
