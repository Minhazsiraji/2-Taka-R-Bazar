# APPROVED — Weekly and Monthly Pool Details Design Lock

**Owner approval:** 18 October 2026, after review of the English and Bangla pricing-tier corrections. 
**Applies to:** Mobile React Native Expo screen and the existing `2TBR-Design-V1.3-Interactive-Review.html` walkthrough.
**Status:** Locked design baseline (documentation and regression tests, not branch protection or merge authorization).
**Development:** Draft PR #123 / `feat/mobile-expo-locked-home-v1`.

## Required visible layout
1. Existing shared header, search and five-tab bottom navigation; approved V1 Signature Teal in light/dark. Do not alter locked Home, Group Deal Details or Individual Product Details.
2. Weekly and Monthly Pool title, ACTIVE status, clearly marked demo data, commitment close date and days left.
3. Households joined, unlimited participation message, and progress to next pricing milestone. **Household counts are only progress measurements**, never prices.
4. Up to 20 distinct master products. Show correct product media, bilingual product names, pack units, individual retail price and current Pool price, potential unit savings, next-tier price, and Product Details navigation.
5. +/− controls support choosing **only desired products**, with quantities. No selection must leave Join disabled.
6. **How Pool prices unlock** shows three selected-product **monetary totals**, in this order:
   - Starting total = sum of each selected product's initial Pool price × selected quantity
   - Current Pool total = sum of each selected product's current tier price × selected quantity
   - Next-tier total = sum of each selected product's future qualifying price × selected quantity
   No selection: show an em dash in each value and ask the customer to select products.
   The selected values are illustrative, never finalized prices or proven savings.
7. **Your Pool basket** shows retail benchmark total, estimated current Pool total, potential savings and next-tier estimated total; quantities and units are always synchronized.
8. EN/BAN show coherent numbers, prices, pack sizes and dates; UI must remain readable at mobile widths 360, 390 and 412 px.
9. Sticky Review Join Pool demo CTA remains reachable without covering the basket, disclaimers or participation rules. Preview never books actual stock, charges customers or creates orders.

## QA completed
- Browser interaction checks on both Pool types for zero selection and multi-quantity selection.
- English/Bangla totals verified: weekly 2 butter + 1 Chinigura rice gives starting ৳2,475, current ৳2,340, next ৳2,230; monthly 2 Chinigura rice + 1 ghee gives starting ৳1,030, current ৳970, next ৳920. Bengali presentation uses Bengali numerals.
- `mobile/tests/locked-design.test.mjs` protects the monetary tier cards.
- React Native CI and actual iOS/Android device QA are separate gates. The browser walkthrough is not an installable native binary.

## Follow-on without violating lock
Real offer pricing/household milestones must be provided by a server-authoritative quote with stock, period, community, price-tier and version checks. Confirm actual commitment rules before checkout. Never use demo prices to transact.

**Next screen to review:** Cart & Checkout, including combined Solo/Exclusive/Group Deal/Pool lines and protected transaction flows. Do not merge or deploy without security, device and release qualification.
