# LOCKED — Final 2TBR Home Hero V2.3

**Approved by product owner:** 2026-10-19. **Branch:** `feat/mobile-expo-locked-home-v1`, **Draft PR:** #123.

This replaces all earlier experimental hero versions (V1.7–V2.2) as the sole visual reference. Do not reintroduce right-edge arrows, extra cart layers, text backplates, strong shadows, tall artwork, vegetables, or altered color schemes.

## Authoritative approved assets

- Source PNG supplied by owner: `Vibrant Grocery Cart on Teal Background.png`
- Original dimensions: **1672 × 941 px**; SHA-256: `8192b9e067397f44f5386f44502c8b8c6b687e0606dd532bf56513aec6283caf`.
- Approved browser artifact: `2TBR-App-V2.3-Final-Hero.html`; SHA-256: `0a7eed089a251784ea26b2873494d5e3ce3004f6406e0428df8bfb9d295c5b36`.
- **Asset status:** Both are attached in the originating conversation, but the binary PNG is **not yet committed under the mobile repository**. Do not claim the Expo SVG fallback is identical to the approved artwork. For native parity, bundle this exact asset locally and use a static local `require()` rather than network/CDN images in the final builds.

## Locked behavior

- Banner remains compact at **174px** native design height (web 166–176px across 360/390/412 mobile widths). No automatic vertical growth.
- Single supplied grocery-cart background: clear teal area left for copy; pantry products on right; no perishable vegetables.
- Headline, subhead and CTA render as real EN/BAN text overlay with **no shadow, blur, separate pane or colored plate**.
- Permanent top kicker **✦ SMART SHOPPING. REAL SAVINGS!** stays **one line**, with a responsive font size.
- All four text pairs auto-rotate; use left and right bottom arrows plus exactly four bottom dots. Never add another oversized arrow at the cart's right edge.
- CTA Explore group deals works. No overlap between controls, text or CTA even on the longest slide; small type adaptation may be slide-specific but overall height stays fixed.
- Logo, header, four savings tiles, Group Deals, Exclusive Products, Pools, Footer, Cart/Checkout, Account/Orders and all locked theme/typography remain unchanged.

## Technical progress

- Browser reference: approved V2.3, self-contained HTML.
- Expo native structure: compact 174px layout, one-line kicker, responsive text sizing, four dots and bottom arrows wired; supports **optional HTTPS approved image** through `EXPO_PUBLIC_APPROVED_HERO_IMAGE_URL` for development.
- Native image **is still a pantry-cart SVG fallback** if `EXPO_PUBLIC_APPROVED_HERO_IMAGE_URL` is missing. Do not label this fallback as final visual parity.
- Before the final Android APK/iOS release, commit and bundle the exact owner PNG, remove reliance on remote image runtime, test at 360/390/412dp, verify EN/BAN and carousel/CTA on device, and confirm the output against the V2.3 browser reference.
- Production purchases, auth gates and financial operations remain unchanged and disabled where previously gated.

No merge, release, signing or live deployment is authorized by this design lock.
