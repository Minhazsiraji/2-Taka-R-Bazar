# 2-TAKA-R-BAZAR — Step 1 Community Pool MVP

Mobile-first PWA for operating the first 30–200 community-pool households, starting in Savar. Step 1 intentionally stops before supplier self-service, online payment gateways, paid membership/1TAKA Pass, advanced Maps APIs, AI, and delivery-fleet functionality.

## Pilot business flow

1. Household signs up and joins a community.
2. Admin approves a local-market price benchmark.
3. Admin creates a community Pool and adds products using benchmark snapshots.
4. Customer commits desired quantity while the Pool is `open`.
5. Admin freezes demand (`pricing`) and manually records competing supplier quotations.
6. Admin selects a quotation for commercial/reliability reasons and publishes a final customer price.
7. Pool enters `confirmation`; the customer explicitly confirms the purchase.
8. Order moves to `ordered`, then `ready_for_pickup`.
9. Assigned pickup operator marks the order collected.
10. The database creates each positive verified saving once and only once.
11. Customer monthly/lifetime savings and community aggregate savings update from the verified ledger.

A commitment is never silently converted into an order.

## Architecture

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS.
- **PWA:** Next metadata manifest, 192/512 icons, maskable icon, lightweight service-worker shell cache. Transactional writes always require the live server.
- **Auth:** Supabase passwordless Bangladesh mobile authentication with 6-digit SMS OTP and cookie-based SSR sessions. Email is not required for customer signup or sign-in. A configured Supabase SMS provider is required for live OTP delivery.
- **Database:** Supabase Postgres with normalized relational tables, foreign keys, checks, RLS, transactional RPCs and audit events.
- **Hosting:** Vercel.
- **Authorization:** browser/server requests use only the Supabase publishable key plus the signed-in user's session. Admin access is enforced by RLS/roles; customer community statistics and pickup contact access use narrowly scoped database RPCs. No service-role/secret key is required by the app runtime.

### Main modules

Customer PWA:
- `/home`
- `/pool`
- `/orders`
- `/savings`
- `/community`
- `/pickup`
- `/profile`
- `/feedback`

Operations:
- `/admin`
- `/admin/communities`
- `/admin/customers`
- `/admin/products`
- `/admin/market-prices`
- `/admin/suppliers`
- `/admin/pools`
- `/admin/commitments`
- `/admin/orders`
- `/admin/pickup-points`
- `/admin/savings`
- `/admin/feedback`
- `/admin/issues`

Pickup operator:
- `/pickup-ops`

### Admin CRUD and historical integrity

Communities, products, suppliers and pickup points support create/read/update plus **soft deactivation**. Records already referenced by pools, quotations, orders or savings are intentionally not hard-deleted so the pilot audit trail remains intact.

## Database model

Core tables:

- `profiles`
- `user_roles`
- `communities`
- `pickup_points`
- `pickup_operator_assignments`
- `products`
- `market_price_observations`
- `market_price_benchmarks`
- `suppliers`
- `pools`
- `pool_items`
- `commitments`
- `supplier_quotes`
- `orders`
- `order_items`
- `fulfilments`
- `savings_ledger`
- `payment_records`
- `feedback`
- `operational_issues`
- `audit_events`

### Critical database-owned rules

- Active Pool commitments can only be made through `commit_to_pool()`.
- Customer purchase confirmation is performed by `confirm_commitment_order()` only while the Pool is in `confirmation` and a final price exists.
- Admin Pool transitions are validated by `admin_set_pool_status()`.
- Quote selection/final customer price is written through `admin_finalize_pool_item()`.
- Pickup completion and savings generation are atomic in `mark_order_collected()`.
- `savings_ledger.order_item_id` is unique, so retrying collection cannot double-credit an item.
- Savings use `max(benchmark snapshot - final unit price, 0) × fulfilled quantity`.
- Cancelled or uncollected orders never create verified savings.

## Security model

Every public table has RLS enabled.

- **Customer:** own private profile, commitments, orders, fulfilment state, savings, payment records and feedback; local safe Pool/benchmark information.
- **Admin:** operational access through admin role policies and guarded admin RPCs.
- **Pickup operator:** only assigned pickup orders. Customer profile rows are not opened through RLS for pickup staff; a guarded RPC returns only the name/phone attached to assigned pickup orders.
- **Supplier commercial data:** admin only.
- **Community public views:** application returns aggregate counts/savings only; individual household purchases are never exposed.

Authorization uses `user_roles`, not user-editable Auth metadata.

## Local setup

Requirements: current Node.js 22+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never commit `.env*` values. The publishable key is safe for browser use when RLS is correctly enabled; no privileged database key is required by this app.

## Supabase setup

1. Create a dedicated Supabase project.
2. Apply all SQL migrations in `supabase/migrations/` in filename order.
3. Apply `supabase/seed.sql`.
4. Run `supabase/step1_validation.sql` to inspect RLS and core constraints.
5. Enable Supabase Phone Auth and configure an SMS provider for live OTP delivery. Customer phone OTP does not use an email callback.
6. Use a **publishable key** in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The Step-1 web app does not require a service-role/secret key.

The seed contains the three pilot communities and clearly labeled demo products. It deliberately does **not** invent supplier prices, benchmarks, orders, savings or production KPIs.

## Initial admin bootstrap

Create the owner account through normal `/signup`, then use the Supabase SQL editor once to grant the role:

```sql
insert into public.user_roles(user_id, role)
select id, 'admin'
from auth.users
where phone = '+8801XXXXXXXXX'
on conflict do nothing;
```

No production OTP, password, or user ID is stored in source control.

### Pickup operator bootstrap

Have the operator create a normal account, then grant the role:

```sql
insert into public.user_roles(user_id, role)
select id, 'pickup_operator'
from auth.users
where phone = '+8801XXXXXXXXX'
on conflict do nothing;
```

After that, use **Admin → Pickup points** to assign that user to one or more pickup locations.

## Pilot operating setup

Before the first real order:

1. Confirm the seeded community names.
2. Create at least one real pickup point for Amin Model Town.
3. Replace/extend demo products with the 5–10 pilot SKUs actually chosen.
4. Record multiple real local market observations.
5. Approve each benchmark only after review.
6. Add real suppliers manually.
7. Create a Pool and add only products that have an active approved benchmark.

## Testing

Pure domain tests:

```bash
npm test
```

They cover the core savings rule, negative-savings prevention, invalid quantity, and median benchmark helper.

Before pilot authorization, execute the full deployed journey:

1. Create customer.
2. Complete community onboarding.
3. Admin creates/activates product.
4. Record market observations and approve benchmark.
5. Create draft Pool and add product.
6. Open Pool.
7. Customer commits quantity.
8. Move Pool to pricing.
9. Enter at least two supplier quotes where practical.
10. Select quote and final customer price.
11. Move to final price, then confirmation.
12. Customer explicitly confirms purchase.
13. Move Pool to ordered.
14. Move Pool to ready for pickup.
15. Assigned pickup operator marks collected.
16. Verify one and only one savings-ledger entry per order item.
17. Verify customer month/lifetime saving.
18. Verify community aggregate saving.

Negative/security checks:

- Customer A cannot read Customer B private rows.
- Customer cannot access admin routes/actions.
- Pickup operator sees only assigned pickup locations/orders.
- Cancelled order creates no savings.
- Uncollected order creates no savings.
- Final price above benchmark never produces negative savings.
- A second collection attempt fails and cannot double-credit savings.
- Supplier quotations are not customer-readable.

Responsive/browser QA targets: 360px, 768px, and 1440px with no horizontal page overflow and usable touch controls.

## Deployment to Vercel

1. Import the GitHub repository into Vercel.
2. Framework preset: Next.js.
3. Add all three environment variables for Preview and Production as appropriate.
4. Set `NEXT_PUBLIC_SITE_URL` to the final deployed HTTPS origin.
5. Deploy Preview first.
6. Execute the full critical-flow and security QA against Preview.
7. Promote only after the Preview passes.

## PWA behavior

- Installable manifest and mobile icons are included.
- Service worker caches a light application shell/static assets.
- **Offline order/commitment/payment mutations are intentionally not supported.** All transactional actions require live server confirmation.

## Known Step-1 limitations by design

- Phone OTP requires a configured SMS provider; provider charges/limits are external to this repository.
- Manual supplier outreach and quotation entry.
- Manual payment states; no bKash/payment-gateway integration.
- Local pickup only; no owned delivery fleet.
- Google Maps uses saved share links only.
- Social sharing uses Web Share/copy-link, not Facebook API automation.
- No supplier portal/bidding automation.
- No 1TAKA Pass or paid membership.
- No AI.

These are Step-1 scope choices, not hidden missing functionality.

## Step 2 — proposal only, not implemented

Possible next work after real pilot evidence: supplier RFQ/bidding portal, supplier performance scoring, automated notifications, stronger pickup tooling, payment integration, Maps/Places integration, price intelligence, referrals, richer analytics, repeat-order tools and social-proof tooling for 200–1,000 households.

**1TAKA Pass remains outside this repository's current Step-1 authority.**
