# 2TBR Cart & Checkout Review — NOT YET APPROVED OR LOCKED

Draft PR #123 / mobile Expo Android and iOS. The current website and approved Home, Group Deal, Individual Product and Pool Details screens are **not changed**.

## Cart distinctions
1. Direct/Exclusive lines: quantity, visible price and direct subtotal; only explicitly ready/direct offers may enter the checkout review.
2. Group Deal commitments: a *demo draft* only, with current indicative qualified price, join progress and closing time. Excluded from payable Direct subtotal.
3. Pool selections: a *demo draft* snapshot from selected products and quantities, grouped by Pool, editable by returning to Pool. Excluded from payable Direct subtotal.
4. Cart badge represents distinct offer/product lines, including draft lines, not summed quantities. All data remains in transient memory.
5. Items with the same master product but different offer sources remain separate, never combined into a single price or inventory transaction.

## Checkout review
- Direct items only. Empty Direct cart: disabled checkout CTA.
- Options for home delivery and pickup; placeholders only for address/service area and delivery fees.
- COD/online selectors are for preview, not eligibility or payment.
- No final amount payable is asserted while delivery fees and server quote are unknown.
- No group/pool enrollment, financial posting, stock reservation, checkout, delivery fee, real order or payment can be performed by this app stage.

## Production implementation release blockers
Must use server-authoritative cart/order quotes; signed-in identity/RLS; address validation; stock reservation with idempotency and expiry; verified price/retail snapshots; community eligibility; protected COD/payment integration; notification integrity; Finance maker-checker; returns/refunds; mobile device QA; release owner authorization. Demo Pool/Group drafts must never be auto-converted into real purchases.

## Test next
From Exclusive, add two items (repeat quantities). Open Cart: badge counts lines, direct subtotal is correct. Add Group Deal request via Group Deal Details; it should appear separately pending. Add Pool selection via Pool Details; it appears separately with no payable impact. Continue direct checkout and switch delivery/payment examples, then verify no payment/real order. Test EN/BAN and light/dark.
