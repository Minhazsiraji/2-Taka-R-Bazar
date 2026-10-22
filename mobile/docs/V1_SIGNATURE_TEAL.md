# 2TBR Mobile — Approved V1 Signature Teal Colors

**Source of truth:** Owner-approved V1 Signature Teal swatch, 18 Oct 2026.
**Scope:** Native Android/iOS app + the existing downloadable browser walkthrough. Website colors and layout are not changed in this PR.

| Role | HEX |
|---|---|
| Primary teal — buttons, links and retail prices | `#007F83` |
| Accent aqua — indicators, progress and highlights | `#2CD6CE` |
| Primary text/navy | `#17233B` |
| App background/light mode | `#F4F1F6` |

Implementation:
- Shared native tokens: `mobile/src/theme.ts` (single source for all native screens)
- Browser walk-through: identical tokens are applied to existing `2TBR-Design-V1.3-Interactive-Review.html`, without creating a new mockup or changing card positions
- Light: white cards, soft teal highlights, navy text; primary teal with white button text
- Dark: dark navy surfaces, off-white text, aqua controls and accessible focus; dark text over aqua buttons
- Red badges, verified green active status, warning colors and blue participation icons remain status-specific. White product-image backgrounds and photo colors are not re-tinted.
- Text contrast: primary `#007F83` on white approx 4.81:1; aqua `#2CD6CE` against navy `#17233B` approx 8.67:1. Tiny labels on the light app background should use `#006D71`, which is darker than the primary.
- Preserve the Home design lock (`mobile/docs/APPROVED_HOME_DESIGN_LOCK.md`) and accepted Group Deal Details arrangement. No changes to their geometry, copy or navigation.

## Tests
- `mobile/tests/brand-palette.test.mjs` verifies tokens, modes and use by existing screens.
- `mobile/tests/locked-design.test.mjs` protects key Home and details-page controls.
- Manual browser checks: phone widths 360 / 390 / 412 px, no script errors and consistent teal tokens in light/dark.
- Full physical Android and iOS device QA remains a release gate; JavaScript export is not an installable native build.

**Next owner review page:** Individual Product Details: canonical photos, verified description/packaging, retail reference only, and a clear return to originating Group Deal/Pool.
