# 2TBR Mobile — Home Screen Design Lock

**Approval:** User locked the Home page on 18 October 2026, after accepting the compact revision.  
**Scope:** iOS/Android Expo app and the associated browser review.  
**Status:** Approved design baseline; do not redesign or alter Home without a new explicit user instruction.  
**Code lane:** Draft PR #123, `feat/mobile-expo-locked-home-v1`. This is a documented design lock, not a GitHub-protected file or a production release.

## Preserve exactly
- Branded responsive header: exact 2TBR logo, name, English and Bangla permanent slogans, EN/BAN, theme, notification, account, menu; search underneath.
- Community selector and clearly identified DEMO DATA when previewing sample values.
- A single compact teal hero with transparent text overlay and pantry shopping-cart illustration; no separate text shadow/panel; rotate the four existing bilingual message pairs.
- Savings directly underneath hero: This Month, Previous Month, Lifetime, Community, all four compact cards in one horizontal row; no extra demo explanatory paragraph on Home.
- Home section sequence and compact styling: **Group Deals → Exclusive Products → Community Pools**. Display only the main section headings and View All actions; remove numbered/eyebrow section headings and divider lines previously marked in red.
- Group Deal cards: photo left, offer price, verified reference savings, blue joined icon and clock deadline, progress, two compact buttons right.
- Exclusive Product cards: approved two-column product grid, prominent real product photos, small consistent typography, price/reference/saving, stock, cart action.
- Pools: weekly/monthly cards with product count and thumbnail strip, ACTIVE live indicator, joining progress, commitment deadline/day(s) left, Explore Pool.
- Compact informative footer including two-column business/customer contact.
- Bottom navigation exactly Home, Pools, Deals, Exclusive, Cart; account in header only; cart badge shows distinct lines.
- The same product may appear in multiple offer types but must reference shared stock and one master product ID.

## Protect while developing other screens
1. No Home re-layout, replacement imagery, typography adjustments, card reshaping or hero/savings changes without the user's **specific approval**.
2. Changes on detail screens must not accidentally change shared Home card styles; prefer isolated components/classes.
3. Existing `mobile/tests/locked-design.test.mjs` is a minimum automated guard, not a pixel-perfect snapshot; add image/device visual regression checking before shipping.
4. Keep customer ordering in demo/read-only mode until security, business rules, authentication, checkout and production release gates pass.
5. PR remains a draft; this lock is **design acceptance**, not authorization to merge or deploy.

## Next screen for customer approval
**Group Deal Details**, with an easy-to-read product image, market retail price, 3/5/10-person eligibility accurately reflecting backend rules (3 is not yet supported in production), correct joined progress, offer deadlines, group fill/next-circle handling, unfulfilled expiry behavior, and clear CTA that does not pretend to place a live order.
