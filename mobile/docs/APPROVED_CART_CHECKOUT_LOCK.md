# APPROVED — Cart & Checkout Design Lock

**Owner approval:** 18 October 2026, following screenshots and the three requested final corrections.
**PR:** Draft #123; branch `feat/mobile-expo-locked-home-v1`.
**Scope:** The Cart and checkout **design and non-transactional demo** on Android/iOS and the same browser review file.
**Status:** Approved design baseline. No automatic GitHub branch protection, store publication, financial approval or authorization to transact is implied.

## Preserve without redesign
- Shared V1 Signature Teal header, search and exact bottom tabs. Keep Home, Group Deal Details, Individual Product Details and Pool Details locked.
- Direct / Exclusive items shown as orderable demo lines with correct quantities, line prices and direct subtotal.
- Group Deal section named **Group Deal requests · Pending** (Bangla: **গ্রুপ ডিলের অনুরোধ · অপেক্ষমাণ**). These are **requests/drafts**, not confirmed commitments or purchases.
- Pool selections grouped by their originating Pool with item quantities, indicative Pool total, Edit quantities and Remove draft.
- **Three categories remain separate:** Group/Pool drafts must not be combined with payable Direct lines, final price, stock reservation or COD/payment.
- Bottom Cart badge counts distinct lines. A compact cart-summary explanation shows: **Direct line count + Group Deal line count + Pool product line count = badge total**; quantities do not inflate badge line count.
- Cart summary keeps Direct subtotal separate, and delivery fee is calculated only after real address and service validation.
- Checkout preview retains item review, Home Delivery/Pickup, COD and Online (future). **Online (future) is visibly disabled and cannot be selected**, in both EN/BAN, until secure payment integration is qualified.
- Final payable amount is **not quoted** when delivery, taxes, stock, price snapshots or eligibility are not confirmed.
- Preview cannot place a real order, join a Pool, commit to a Group Deal, reserve stock, accept payment or create Finance entries.

## Regression verification
- Browser DOM and interaction checks on the same preview at widths 360, 390 and 412 px, EN/BAN: dynamic 2 Direct + 1 Group + 2 Pool = 5-line Cart explanation; correct pending wording; disabled online button; no JS errors; click does not change COD.
- Native `mobile/tests/cart-checkout.test.mjs` guards the design contract alongside pre-existing navigation and Pool locks.
- TypeScript/native Android + iOS JavaScript export CI remains a separate required gate.
- Native device screenshots, authenticated checkout and real transaction security tests must be completed before any release.

## Next screen
Account, Orders and Verified Savings, followed by native authentication and server-authoritative commerce qualifications. This lock does not imply backend checkout readiness or release.
