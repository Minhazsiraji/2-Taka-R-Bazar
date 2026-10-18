# Approved 2TBR mobile homepage — 18 October 2026

**Source of truth:** owner-provided vertical “Carousel Grocery Marketplace App Mockup.png” screenshot in ChatGPT project discussion. The screenshot is a **layout reference**, not proof that the pictured brands, stock, prices, savings, or participant counts are real. Do not copy illustrative commerce facts into Production.

## Mobile visual structure — maximum 767 px

1. Header: original black basket-2 logo, full brand “2-TAKA-R-BAZAR”, permanent EN/BN slogans, right-hand BAN/EN, theme, bell, account, menu. Search takes a complete second line.
2. Compact location row: location icon, “Your community”, chosen community selector, a conspicuous DEMO DATA marker only for actual demo mode. Location detection is user-initiated.
3. Teal grocery hero with brand headline, rotating 4 informative slides, dots, arrows, one valid section link and existing original hero artwork. Reduced-motion users receive a static slide.
4. Section “01 · Community savings” / **Group Deals** — 44%-wide contained product photo; right copy with actual published price, reference strike/savings *only if confirmed and verifiable*, joined-count/threshold, progress and visible product/deal navigation. Zero deals => informative empty state, no invented listings.
5. Section “02 · Curated for you” / **Exclusive Products** — exactly two columns with image + product copy, package, real price or “Ask for price”; direct Add to Cart only if approved Commerce cart is actually available; otherwise current nonpayable product booking or Demo preview link.
6. Section “03 · Buy in a Pool” / **Community Pools** — compact horizontal thumbnail strip, period tag, actual progress, one details link; no synthetic engagement unless visibly marked DEMO.
7. Keep the existing legal/contact footer, and use the screenshot's five mobile dock destinations **Home, Pools, Deals, Exclusive, Cart**, with icons. The top account icon remains the entry to Account.

## Technical details / change boundaries

- Mobile layout lives in `components/mobile-marketplace-home.tsx` and `app/marketplace-mobile-approved.css`.
- The original desktop homepage markup is preserved under `.market-legacy-home`. It remains visible on tablets/desktop (>=768 px), is visually hidden on phones (<=767 px).
- The two locked navigation files were specifically re-approved for the new mobile reference; their SHA256 values are updated in `docs/approved-home-design-lock.json`. No Finance or admin UI styling was changed.
- The new mobile layout reads **existing** public `offers`, `featured`, `pools`, and communities, and shares the same EN/BAN state, location selection and search.
- Tests check 320, 360, 393, 640, 767, 768, 790, 820, 1024, 1100, 1440, 1920 widths, light/dark modes, one fixed mobile dock, no horizontal scroll, same domain-safety and source-data rules.

## Relaunch mapping

This design is the **approved UI shell**, not authorization to turn on the unfinished payment engine. During the clean v2 relaunch, route action links must be rebound to the single new `store_*` order/cart backend; remove historical “pilot booking” links only after that replacement has passed real-order UAT. Do not merge this long-running draft PR as a complete Production relaunch.
