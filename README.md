# 2-TAKA-R-BAZAR — Savar Pilot Community Pool PWA

Mobile-first PWA for the first ~30–200 households in one/few nearby Savar communities. The pilot is deliberately **not** a normal online grocery marketplace: demand is collected first, community volume unlocks a customer-price ceiling, Operations negotiates against frozen demand, suppliers deliver one consolidated handover to the community, and customers collect locally.

## Pilot Mode

`PILOT_MODE` is centrally enabled for the first ~3–4 months. The existing subscription engine is preserved, but customer Membership navigation/billing CTAs are hidden, automatic subscription billing is dormant, and pool participation is not blocked by membership. Referral Coins accumulate but are not redeemed automatically.

## Pilot business flow

1. Household signs up by Bangladesh mobile OTP and joins a community; an optional referral code can be carried safely through OTP/onboarding.
2. Admin approves a real local-market benchmark and adds a small curated SKU set to a Draft Pool.
3. Before opening, Operations manually records supplier planning tiers such as `50 units → max ৳128`, `100 → ৳125`, `150 → ৳122`, including delivery to the designated community receiving point.
4. While the Pool is `open`, customers see normal market price, current community demand, current unlocked maximum price, next improving tier and units still needed. Supplier/private cost is never shown.
5. `open → pricing` atomically freezes committed quantity, eligible tier and customer-price ceiling per active SKU. Zero-demand SKUs retire from that Pool.
6. Operations performs the second/final supplier negotiation for the exact frozen quantity. Final customer price may improve but can never exceed the frozen ceiling or fall below selected delivered supplier cost during pilot.
7. Pool enters `confirmation`; customer explicitly accepts the final price and chooses one of that Pool's enabled pickup points. A commitment is never silently converted into an order.
8. Supplier handover occurs at `supplier_delivery_at`; Operations/pickup staff records expected vs received quantity and any shortage/damage. `ordered → ready_for_pickup` is blocked until required selected-supplier deliveries are fully received.
9. Customer collects locally. Pickup completion atomically records verified savings once only.
10. If this is a referred neighbour's first genuine collected order, the referrer receives exactly +10 2-Taka Coins once and an existing-system notification.

Verified saving remains `max(benchmark snapshot - final customer unit price, 0) × fulfilled quantity` and is credited only after successful collection.

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
- `/community` (aggregate community + referral/2-Taka Coin progress)
- `/pickup`
- `/profile`
- `/feedback`
- `/notifications`
- `/subscription` remains implemented but is intentionally hidden/dormant from normal navigation while Pilot Mode is active

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
- `supplier_quotes` (planning tiers + final quotes)
- `supplier_receipts`
- `orders`
- `order_items`
- `fulfilments`
- `savings_ledger`
- `payment_records`
- `referrals`
- `coin_ledger`
- `pilot_settings`
- subscription/coupon/invoice tables (preserved, dormant in Pilot Mode)
- notification/push-subscription tables
- `feedback`
- `operational_issues`
- `audit_events`

### Critical database-owned rules

- Active Pool commitments can only be made through `commit_to_pool()`.
- Customer purchase confirmation is performed by `confirm_commitment_order()` only while the Pool is in `confirmation` and a final price exists.
- Admin Pool transitions are validated by `admin_set_pool_status()`.
- Every active Draft SKU needs at least one delivered planning tier before Open.
- `open → pricing` atomically freezes committed quantity, highest eligible planning tier and its customer-price ceiling; zero-demand SKUs retire from that Pool.
- Quote selection/final customer price is written through `admin_finalize_pool_item()`. A selected quote must be a `final` quote for the exact frozen quantity, include delivery, and the final customer price must satisfy `landed cost <= final customer price <= frozen unlocked ceiling` whenever a ceiling exists.
- `supplier_delivery_at < pickup_at`; `ordered → ready_for_pickup` is blocked until every required selected-supplier receipt is fully received.
- Pickup completion and savings generation are atomic in `mark_order_collected()`.
- `savings_ledger.order_item_id` is unique, so retrying collection cannot double-credit an item.
- A pending referral earns +10 Coins only on the referred household's first genuine completed/collected order. `referrals.referred_user_id`, `coin_ledger.referral_id` and reward event keys prevent repeat credit.
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
8. Choose the designated supplier receiving point and customer pickup options.
9. Enter at least one delivered planning tier per active SKU before opening, e.g. 50 / 100 / 150 units.
10. Set confirmation close → supplier handover target → customer pickup start in that order.

## Testing

Pure domain tests:

```bash
npm test
```

They cover the core savings rule plus pilot tier selection, below-threshold behavior, next-tier progress, final-price ceiling/cost guards, receipt readiness and first-order referral reward idempotency. Static contract checks also assert the new database-owned guards.

Before pilot authorization, execute the full deployed journey on an isolated Preview database:

1. Customer A signs up and receives a referral code/link.
2. Customer B follows that link through mobile OTP and onboarding; referral is pending and A has zero Coins.
3. Admin creates a Pool, adds benchmark-backed product(s), chooses receiving/pickup points and records 50/100/150-style planning tiers.
4. Pool opens; customers see demand/current unlocked ceiling/next tier and commit quantities.
5. Demand crosses tiers; `open → pricing` freezes quantity and ceiling.
6. Operations enters final delivered supplier quote(s) for exact frozen quantity. A final customer price above frozen ceiling or below delivered cost must fail; a lower compliant price must pass.
7. Pool enters confirmation; customer explicitly accepts final price and selects a Pool-enabled pickup point.
8. Pool enters ordered. Attempting `ready_for_pickup` before required supplier receipts must fail.
9. Operations/pickup staff records supplier handover expected vs received quantity; shortage may create an operational issue.
10. After full receipt, Pool moves ready; customer collects.
11. Verify exactly one Savings Ledger entry per fulfilled item and no negative savings.
12. Customer B's first genuine collection changes referral to rewarded; Customer A gets exactly +10 Coins and one notification.
13. Retry/refresh cannot create another Coin reward or another saving.
14. Community page shows updated referral/Coin progress without exposing neighbour phone/order details.

Negative/security checks:

- Customer A cannot read Customer B private rows.
- Customer cannot access admin routes/actions.
- Pickup operator sees only assigned pickup locations/orders.
- Cancelled order creates no savings.
- Uncollected order creates no savings.
- Final price above benchmark never produces negative savings.
- Final customer price above the frozen unlocked ceiling fails; below selected delivered supplier cost fails during pilot.
- `ordered → ready_for_pickup` fails until every required supplier receipt is complete.
- A second collection attempt fails and cannot double-credit savings or referral Coins.
- Signup, commitment, confirmation, cancellation and uncollected orders give zero referral Coins.
- Customers cannot inspect another household's referral relationship or Coin ledger.
- Supplier names/private quotations, landed cost and platform margin are not customer-readable.
- Pilot Mode keeps subscription enforcement OFF even if billing infrastructure already exists.

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

## Pilot limitations by design

- Phone OTP requires a configured SMS provider; provider charges/limits are external to this repository.
- Supplier outreach, planning-tier entry and final negotiation remain manual; there is no supplier portal or automated bidding.
- Product payment states remain manual; there is no online bKash/payment-gateway integration in this iteration.
- Supplier performs one consolidated delivery to the designated community receiving point; there is no owned delivery fleet, routing or rider management.
- PWA remains the customer platform; no native Android/iOS app and no AI/recommendation engine.
- Referral reward is one simple currency only: 10 Coins after a referred neighbour's first genuine collection. No cash withdrawal, wallet, badges, levels or complex gamification.
- Subscription infrastructure exists but stays hidden/dormant and unenforced during the first ~3–4 pilot months. Coins are not auto-redeemed.
- **Family Essential Basket is deliberately deferred** until roughly three months of real SKU demand, supplier-price and household-purchase evidence exists. It should later become another Pool type based on actual patterns, not a guessed basket.

These are pilot scope choices, not hidden missing functionality.

## Post-pilot roadmap — not implemented now

After real pilot evidence: decide membership launch and Coins→free-month redemption; evaluate Family Essential Basket from observed purchasing patterns; then consider supplier RFQ/self-service, payment gateway, richer price intelligence, repeat-order convenience and broader area scaling. Home-delivery fleet, routing, native apps, AI, franchise/corporate procurement and private-label expansion remain outside the current pilot.
