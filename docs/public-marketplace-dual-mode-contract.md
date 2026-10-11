# Public marketplace and dual-mode buying architecture
2026-10-11 | Design contract, NOT an indication that individual checkout is live.

## Scope
**Buy Alone: both 2TBR stocked products AND authorized supplier-listed products.**
Visitors browse without login. OTP only at transact/join. Continue the existing separate Community Pool and verified-neighbour Group Deal mechanisms.

## Server-authoritative stock and seller validation
- OWN_STOCK: verified receiving, reservable stock by serving location; idempotent order-time stock reservation and release.
- SUPPLIER_STOCK: authorized supplier-product listing with verified current sell price, stock/availability, coverage, service-level agreement, return ownership and supplier acknowledgment. Never pretend third-party stock is already owned/received.
- Track seller/source per order line. A supplier can opt into one or both buying modes only after controls. Do not expose supplier private metadata to public browsing.
- Solo price is independently approved. Never generate it from a market reference benchmark or an unearned group-tier target.

## Unified intent cart
- Cart intent line: product, source/offer ID, area, mode (SOLO, GROUP, POOL), quantity, verified price snapshot/expiry, and fulfillment choice.
- At checkout, revalidate price, availability, authorization, region and customer status server-side. Split orders and reservations by mode where group terms are not yet fulfilled. Do not create a fake one-person Pool or charge for a potential group discount.
- Mixed supplier and stock baskets require allocation of fulfillment costs, returns and revenue without double counting, as well as idempotent callbacks and retries.

## Delivery and identity
- Free pickup at enabled community point.
- Within-community home delivery is ৳20 for product basket <=৳1,000 and ৳30 if higher, separate from product savings. Fee assessed on confirmed basket, not automatically per seller line; any order split must allocate transparently.
- Area browsing is manually selectable. Guest GPS permission must be requested explicitly and only coarse matching occurs on-device; that is not a qualification to Group Deal, for which OTP/onboarding and secure location verification remain necessary.
- Exact address and availability must be confirmed by customer at checkout.

## Trust, feedback and finance
- Public testimonial only after fulfilled order, independent explicit PUBLICATION consent and moderation; current testimonial_permission field indicates permission to contact, NOT publication permission.
- Account separately for solo vs pool/group cost of goods sold, seller payable, logistics expense, delivery fee, refund, marketing, discounts and verified customer product saving.
- Reconcile supplier liabilities and actual stock receipts with Finance controls. No implicit paid status, no double counted payments, no unverified savings, and no fabricated public KPIs.

## Rollout gates
A. Public storefront, category filtering, geolocation manual fallback and truthful bottom sections (current Preview).
B. Approved supplier/stock solo price availability model and seller portal publishing rules.
C. Secure individual order/cart lifecycle with pickup/delivery, payment/refund and mixed-basket reconciliation.
D. Synthetic end-to-end UAT: negative paths, duplicate submissions, oversell, stale prices, location spoofing, RLS, refunds, and browser/mobile checks; approval before changing Production.

## Test cases
Empty catalog and unpublished feedback; no fake social activity. Solo supply stock exhausted or supplier unresponsive. Concurrent carts, price changes, invalid supplier access and cross-community access. Delivery thresholds ৳1,000 and ৳1,000.01; guest GPS declined; duplicate callbacks; returns/reconciliation; genuine group thresholds.
