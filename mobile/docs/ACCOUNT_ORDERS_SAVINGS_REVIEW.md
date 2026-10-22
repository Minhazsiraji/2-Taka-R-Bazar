# Account, Orders, Order Tracking & Savings — REVIEW ONLY

**Project:** 2TBR mobile Expo, Draft PR #123. **Status:** New review screens; *not yet owner approved/locked*. No live deployment or production data has changed.

## Screens implemented
- Account: guest-demo profile, sample community, orders counts, lifetime savings, Cart line count, recent orders, account shortcuts. Account features not yet integrated remain marked soon/unavailable. Header Account entry only, no duplicate bottom Account tab.
- Orders: All, In Progress, Completed, Cancelled filters; item previews, order totals and saved amounts (earned only for completed sample orders). No real order claim.
- Order Details: a status timeline, selected master products, quantities, payment/delivery placeholders and customer support notes. Cancelled sample earns zero.
- Savings: This Month, Previous Month, Lifetime and Community metrics; completed order ledger and explanation of actual verified-savings formula (reference retail − final selling price) × eligible fulfilled quantity, net of returns/refunds. Samples reconcile with previously approved Home demo figures: Oct ৳1,250, Sep ৳1,060, lifetime ৳8,450. Community aggregate ৳248,620 is an independently illustrative community figure, never personal cash.

## Unchanged locked baseline
Home, Group Deal, Individual Product, Pool Details, Cart & Checkout visual and behavioral requirements are unchanged. Cart's demo checkout remains unable to reserve stock, transact, post Finance entries, issue payment confirmation, or convert a pending request.

## Native production blockers
Customer-scoped Supabase Auth (Google/email/phone, route redirects, account recovery), JWT/RLS/IDOR verification, server-sourced immutable order timeline and line items, deliveries/returns/refunds, Finance-approved qualified realized savings and privacy-safe community aggregates, app push notifications and account deletion. Do not mix synthetic records with real customer views. Avoid exposing another customer's ledger.

## Owner review
In existing browser walkthrough (same filename), tap top Account icon → My Orders → filter status → select order → inspect tracking, then back → Savings Report, switch EN/BAN and dark/light. Also review the 360/390/412 px device layouts. This is **design review**, not approval or native physical-device qualification.
