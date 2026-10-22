# 2TBR Mobile — Individual Product Details Design Lock

**Approved by owner:** 18 October 2026.
**Scope:** Dedicated individual Product Details page opened from a Group Deal or other offer; applies to React Native app and corresponding browser preview.
**Branch / PR:** `feat/mobile-expo-locked-home-v1`, Draft PR #123.
**Status:** Approved screen design and content-field contract; do not redesign without an explicit new request. This document is a design baseline and is **not** repository-level branch protection or release authorization.

## Exact layout and functionality to preserve

1. Responsive site-wide branded header, search and persistent Home/Pools/Deals/Exclusive/Cart bottom navigation, as already locked on Home. Use approved V1 Signature Teal colors in both themes.
2. Tall product photo first, filling the available image card; readable product name, pack size, SKU.
3. One **Market retail reference price** card, displaying the product's retail reference price only. No Group Deal/Pool tier prices, checkout price confusion or unsupported savings claim here.
4. Compact **Product information** card: Name, **Product Brand**, Package, SKU, Category. Brand is optional and is never guessed from imagery or marketing assets.
5. Three collapsed/expandable blocks: **Description & specifications (SEO)**, **Questions & answers (AEO)**, and **Local availability (GEO)**. Use the declared optional master-product fields in `mobile/src/product-content.ts`, with EN/BAN labels and actual authorized values.
6. Unfilled or unverified fields show **Not provided yet** (or Bangla equivalent). Do not assert unsupported manufacturer, origin, ingredients, certification, allergy, storage or expiration claims.
7. Navigation returns to the originating Group Deal or other offer without changing it or the approved Home page.
8. Public metadata such as SEO title, canonical URL, slug, alt text and structured-data status are reserved for the shared product/content layer and website's SEO publication mechanism; mobile alone does not publish an indexable webpage.
9. Avoid invented admin controls on the customer page. Additional fields must be populated through a separately qualified Admin product-create/update workflow and shared backend.

## Engineering boundaries

- Treat Product ID/SKU as a shared master record linked to individual, Deal and Pool offers. Maintain one product identity and shared stock.
- The native app currently has optional display fields and an optional read-only public brand mapping, **not** a completed Admin field editor or persisted expanded catalog API.
- Changes in other pages must not alter the locked details layout, visible retail-only price semantics, master fields or disclosure behavior.
- Do not merge, ship to stores or enable real ordering without security/checkout/native-device release qualification.

## Next approval page

**Weekly and Monthly Pool Details.** Review 1–20 products, unbounded households, ACTIVE status and closing date, accurate price tiers, individual product navigation, quantity selection, and an honest preview Join Pool action. The current implementation is incomplete for quantity/total and requires explicit review before we lock it.
